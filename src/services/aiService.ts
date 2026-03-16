import { GoogleGenAI, ThinkingLevel, Modality, Type } from "@google/genai";
import { AspectRatio } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const getAiClient = () => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");
  return new GoogleGenAI({ apiKey });
};

// Helper for retrying AI calls with exponential backoff
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorString = error?.toString() || '';
    const isRateLimit = errorString.includes('429') || errorString.includes('quota');
    
    if (isRateLimit && retries > 0) {
      console.log(`Rate limit hit, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const generateFastResponse = async (prompt: string, systemInstruction?: string, modelOverride?: string) => {
  const ai = getAiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: modelOverride || "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text;
  });
};

export const generateWorkerResponse = async (model: string, prompt: string, systemInstruction?: string) => {
  const ai = getAiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: model || "gemini-2.0-flash",
      contents: prompt,
      config: { systemInstruction }
    });
    return response.text;
  });
};

export const generateThinkingResponse = async (prompt: string, systemInstruction?: string) => {
  const ai = getAiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    });
    return response.text;
  });
};

export const generateMapsResponse = async (prompt: string, lat?: number, lng?: number) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: lat && lng ? {
          latLng: { latitude: lat, longitude: lng }
        } : undefined
      }
    }
  });

  const groundingUrls = response.candidates?.[0]?.groundingMetadata?.groundingChunks
    ?.map(chunk => chunk.maps?.uri)
    .filter((uri): uri is string => !!uri) || [];

  return {
    text: response.text,
    groundingUrls
  };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio) => {
  // Check for API key selection for Imagen/Veo models if needed, 
  // but gemini-3-pro-image-preview is a nano banana series model.
  // Actually, instructions say: "When using gemini-3-pro-image-preview ... users MUST select their own API key."
  
  if (!(window as any).aistudio?.hasSelectedApiKey()) {
    await (window as any).aistudio?.openSelectKey();
  }

  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ text: prompt }] },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize: "1K"
      }
    }
  });

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  }
  throw new Error("No image generated");
};

export const generateSpeech = async (text: string, voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' = 'Kore') => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (base64Audio) {
    return `data:audio/mp3;base64,${base64Audio}`;
  }
  throw new Error("No audio generated");
};

export const generateAudioAnalysis = async (base64Data: string, mimeType: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
        {
          text: 'Summarize this audio and provide insights. Analyze the content, extract key points, and suggest how this information can be useful for the virtual office and its workers.',
        },
      ],
    },
  });
  return response.text;
};

export const refineTaskWithAI = async (taskTitle: string) => {
  const ai = getAiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Translate and refine this task title into a professional, clear, and actionable set of instructions in English for an AI worker in a virtual office. 
      Original Task: "${taskTitle}"
      
      Return a JSON object with:
      {
        "refinedTitle": "short clear title",
        "refinedDescription": "detailed actionable instructions",
        "suggestedDepartment": "archive|logic|oracle|sonic|optic|dispatch|forge|insight|vault"
      }`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || '{}');
  });
};
