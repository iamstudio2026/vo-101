import { GoogleGenAI, Modality } from "@google/genai";
import { AspectRatio } from "../types";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const openRouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;

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
  // Routing logic: If it's a native Gemini model, use Google SDK.
  // Otherwise, use OpenRouter for DeepSeek, Qwen, etc.
  const isNativeGemini = model.startsWith('gemini-');
  
  if (isNativeGemini) {
    const ai = getAiClient();
    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: model || "gemini-2.0-flash",
        contents: prompt,
        config: { systemInstruction }
      });
      return response.text;
    });
  } else {
    return generateExternalResponse(model, prompt, systemInstruction);
  }
};

export const generateThinkingResponse = async (prompt: string, systemInstruction?: string) => {
  const ai = getAiClient();
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: { 
        systemInstruction
      }
    });
    return response.text;
  });
};

export const generateExternalResponse = async (model: string, prompt: string, systemInstruction?: string) => {
  if (!openRouterKey) throw new Error("OPENROUTER_API_KEY is not defined");
  
  return withRetry(async () => {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "Virtual Office 101"
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ]
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No response from model";
  });
};

export const generateMapsResponse = async (prompt: string, lat?: number, lng?: number) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return {
    text: response.text,
    groundingUrls: []
  };
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: { parts: [{ text: `Generate an image based on: ${prompt}` }] },
  });

  const candidate = response.candidates?.[0];
  if (candidate?.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
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
