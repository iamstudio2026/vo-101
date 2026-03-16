/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { Worker, Task, OperationType, AspectRatio, Citizen, ChatMessage, Knowledge } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Coffee, MessageSquare, Brain, AlertCircle, User, CheckSquare, ListTodo, Play, CheckCircle2, Package, X, ArrowRight, Archive, FileText, ExternalLink, Download, ClipboardCheck, Loader2, Sparkles, Terminal, Code, Cpu, Zap, Github, BookOpen, Image as ImageIcon, MapPin, Volume2, VolumeX, Send, Wand2 as WandIcon, Book, Plus, Trash2, Users, File, Link, HardDrive, Share2, Upload, Eye, Accessibility, Hand, Mic, FileAudio } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import * as aiService from '../services/aiService';

const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 15;

const WORK_AREA = { x: 2, y: 2, width: 4, height: 4 };
const STORAGE_AREA = { x: 14, y: 9, width: 4, height: 4 };
const BREAK_AREA = { x: 14, y: 2, width: 4, height: 4 };
const VISION_AREA = { x: 2, y: 9, width: 4, height: 4 };
const AUDIO_AREA = { x: 8, y: 5, width: 4, height: 4 };

const FURNITURE = [
  { id: 'f1', name: 'Coffee Machine', x: 16, y: 3, icon: Coffee },
  { id: 'f2', name: 'Server Rack', x: 3, y: 10, icon: Cpu },
  { id: 'f3', name: 'Plant', x: 1, y: 1, icon: Sparkles },
  { id: 'f4', name: 'Whiteboard', x: 18, y: 13, icon: ClipboardCheck },
  { id: 'f5', name: 'Water Cooler', x: 12, y: 1, icon: Coffee },
];

const CHAT_PROXIMITY = 1.2; // Distance to trigger chat
const CHAT_DURATION = 50; // Ticks (approx 5 seconds at 100ms interval)

export const Miniverse: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [viewingTaskResult, setViewingTaskResult] = useState<Task | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [worldTheme, setWorldTheme] = useState('Cozy Startup Office');
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);
  const [showQuickstart, setShowQuickstart] = useState(false);
  const [showWorldGen, setShowWorldGen] = useState(false);
  const [worldPrompt, setWorldPrompt] = useState('');
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioSummary, setAudioSummary] = useState('');
  const [audioError, setAudioError] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'fast' | 'thinking' | 'maps'>('fast');
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showImageGenModal, setShowImageGenModal] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatbotInput, setChatbotInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [newKnowledge, setNewKnowledge] = useState({ title: '', content: '', externalUrl: '' });
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [knowledgeTab, setKnowledgeTab] = useState<'text' | 'file' | 'drive' | 'notebooklm'>('text');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_access_token'));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const worldContainerRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState(40);

  useEffect(() => {
    if (!worldContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Calculate grid size to fit the world while maintaining aspect ratio
        const newGridSize = Math.min(
          (width - 16) / WORLD_WIDTH, // Subtract border width (8px * 2)
          (height - 16) / WORLD_HEIGHT
        );
        setGridSize(Math.max(10, newGridSize)); // Minimum grid size of 10px
      }
    });

    observer.observe(worldContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Load Google Identity Services script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      alert("Google Client ID is missing. Please configure VITE_GOOGLE_CLIENT_ID in the app settings.");
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      alert("Google Identity Services not loaded yet. Please try again in a moment.");
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
      callback: (response: any) => {
        if (response.access_token) {
          setGoogleAccessToken(response.access_token);
          localStorage.setItem('google_access_token', response.access_token);
        }
      },
    });
    client.requestAccessToken();
  };

  const handleGoogleLogout = () => {
    setGoogleAccessToken(null);
    localStorage.removeItem('google_access_token');
  };

  // Google Picker API
  const openPicker = () => {
    const token = googleAccessToken;
    if (!token) {
      handleGoogleLogin();
      return;
    }

    setIsDriveLoading(true);
    
    // Load the Google Picker API
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', {
        callback: () => {
          const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(token)
            .setDeveloperKey(import.meta.env.VITE_GOOGLE_API_KEY || '') // User might need to provide this
            .setCallback(async (data: any) => {
              if (data.action === window.google.picker.Action.PICKED) {
                const doc = data.docs[0];
                await addDoc(collection(db, 'knowledge'), {
                  officeId: currentOffice!.id,
                  ownerId: currentUser!.uid,
                  title: doc.name,
                  content: `Google Drive File: ${doc.name}`,
                  type: 'drive',
                  externalUrl: doc.url,
                  mimeType: doc.mimeType,
                  createdAt: new Date().toISOString()
                });
              }
              setIsDriveLoading(false);
            })
            .build();
          picker.setVisible(true);
        }
      });
    };
    document.body.appendChild(script);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !currentOffice) return;

    // Limit file size to ~750KB to stay safe with Firestore 1MB limit (base64 overhead)
    if (file.size > 750 * 1024) {
      alert("File is too large. Please upload files smaller than 750KB.");
      return;
    }

    setUploadingFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        await addDoc(collection(db, 'knowledge'), {
          officeId: currentOffice.id,
          ownerId: currentUser.uid,
          title: file.name,
          content: base64,
          type: 'file',
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          createdAt: new Date().toISOString()
        });
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'knowledge');
      setUploadingFile(false);
    }
  };

  const handleAddExternalKnowledge = async (type: 'drive' | 'notebooklm' | 'link') => {
    if (!currentUser || !currentOffice || !newKnowledge.title || !newKnowledge.externalUrl) return;

    setIsAddingKnowledge(true);
    try {
      await addDoc(collection(db, 'knowledge'), {
        officeId: currentOffice.id,
        ownerId: currentUser.uid,
        title: newKnowledge.title,
        content: `External link to ${type}: ${newKnowledge.externalUrl}`,
        type: type,
        externalUrl: newKnowledge.externalUrl,
        createdAt: new Date().toISOString()
      });
      setNewKnowledge({ title: '', content: '', externalUrl: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'knowledge');
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    if (currentOffice?.status === 'closed') return;
    setAnalyzingImage(true);
    setAnalysisResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1],
            },
          },
          {
            text: "Analyze this image in detail. What do you see? Provide a professional summary suitable for a virtual office environment.",
          },
        ],
      });

      setAnalysisResult(response.text || "No analysis could be generated.");
    } catch (error) {
      console.error("Image Analysis Error:", error);
      let errorMessage = "Error analyzing image. Please try again.";
      
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
          errorMessage = "AI Quota exceeded. Please wait a moment and try again, or check your API plan details.";
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      setAnalysisResult(errorMessage);
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setSelectedImage(base64);
        analyzeImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateAIResult = async (task: Task, worker: Citizen | Worker) => {
    if (currentOffice?.status === 'closed') return "Office is closed. Task processing paused.";
    try {
      const knowledgeContext = knowledge.length > 0 
        ? `\n\nRELEVANT KNOWLEDGE BASE:\n${knowledge.map(k => `--- ${k.title} ---\n${k.content}`).join('\n\n')}`
        : '';

      const model = worker.model || "gemini-1.5-flash";
      const systemInstruction = `You are an AI agent named ${worker.name} working in a digital Virtual Office. 
        You have just completed a task titled: "${task.title}".
        ${task.description ? `Task description: ${task.description}` : ''}
        
        ${knowledgeContext}

        Please generate a professional and detailed output for this task. 
        If it's a report, write the report. If it's code, write the code. If it's a creative task, provide the creative output.
        Format it nicely with headers and sections if appropriate. 
        Make it feel like it was truly produced by an intelligent agent.
        Use Google Search if you need up-to-date information to complete the task accurately.`;

      const result = await aiService.generateWorkerResponse(model, "Complete the task shared in system instructions.", systemInstruction);

      return result || "No content could be generated.";
    } catch (error) {
      console.error("AI Generation Error:", error);
      return `Error generating content: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  };

  const generateWorld = async (promptText?: string) => {
    const finalPrompt = promptText || worldPrompt;
    if (!finalPrompt) return;
    
    setIsGeneratingWorld(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a creative theme and description for a digital agent virtual office based on this prompt: "${finalPrompt}". 
        Return a JSON object with:
        - themeName: a short catchy name
        - description: a 2-sentence description
        - primaryColor: a tailwind color class (e.g., 'indigo', 'emerald', 'rose', 'amber', 'violet')
        - accentColor: another tailwind color class`,
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });
      
      const data = JSON.parse(response.text || '{}');
      if (data.themeName) {
        setWorldTheme(data.themeName);
      }
      setWorldPrompt('');
      setShowWorldGen(false);
    } catch (error) {
      console.error("World Generation Error:", error);
    } finally {
      setIsGeneratingWorld(false);
    }
  };

  const sendAgentMessage = async (sender: Citizen, message: string, receiverId?: string) => {
    if (!currentOffice || !currentUser) return;

    const newMessage = {
      officeId: currentOffice.id,
      senderId: sender.id,
      senderName: sender.name,
      message,
      timestamp: Date.now(),
      type: receiverId ? 'private' : 'public',
      ownerId: currentUser.uid,
      ...(receiverId ? { receiverId } : {})
    };

    try {
      await addDoc(collection(db, 'messages'), newMessage);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }
  };

  const handleBroadcastMessage = async (message: string) => {
    if (!currentOffice || !currentUser || currentOffice.status === 'closed') return;

    // 1. Add user message to Firestore
    const userMsg = {
      officeId: currentOffice.id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Admin',
      message,
      timestamp: Date.now(),
      type: 'public' as const,
      ownerId: currentUser.uid
    };

    try {
      await addDoc(collection(db, 'messages'), userMsg);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    }

    // 2. Trigger agent responses based on AI Mode
    if (citizens.length > 0) {
      const numResponders = Math.min(citizens.length, Math.floor(Math.random() * 2) + 1);
      const shuffled = [...citizens].sort(() => 0.5 - Math.random());
      const responders = shuffled.slice(0, numResponders);

      for (const agent of responders) {
        setTimeout(async () => {
          try {
            let responseText = "";
            let groundingUrls: string[] = [];
            const systemInstruction = `You are ${agent.name}, a ${agent.role} in a Virtual Office simulation. 
              The Admin (user) just sent a message to the group channel: "${message}".
              Respond briefly (max 20 words) and professionally, staying in character.`;

            if (aiMode === 'thinking') {
              responseText = await aiService.generateThinkingResponse(message, systemInstruction) || "";
            } else if (aiMode === 'maps') {
              const res = await aiService.generateMapsResponse(message);
              responseText = res.text || "";
              groundingUrls = res.groundingUrls;
            } else {
              responseText = await aiService.generateFastResponse(message, systemInstruction, agent.model) || "";
            }

            if (responseText) {
              let audioUrl: string | undefined;
              if (ttsEnabled) {
                try {
                  audioUrl = await aiService.generateSpeech(responseText);
                } catch (e) {
                  console.error("TTS Error:", e);
                }
              }

              const newMessage = {
                officeId: currentOffice.id,
                senderId: agent.id,
                senderName: agent.name,
                message: responseText.trim(),
                timestamp: Date.now(),
                type: 'public' as const,
                ownerId: currentUser.uid,
                isAi: true,
                isThinking: aiMode === 'thinking',
                groundingUrls,
                ...(audioUrl ? { audioUrl } : {})
              };

              await addDoc(collection(db, 'messages'), newMessage);
              
              if (audioUrl) {
                const audio = new Audio(audioUrl);
                audio.play();
              }
            }
          } catch (error) {
            console.error("Agent Response Error:", error);
          }
        }, Math.random() * 2000 + 1000);
      }
    }
  };

  useEffect(() => {
    if (!currentUser || !currentOffice) return;

    const q = query(
      collection(db, 'workers'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );

    const unsubscribeWorkers = onSnapshot(q, (snapshot) => {
      const allWorkers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Worker));
      const workersData = allWorkers.filter(w => w.isEnabled !== false);
      
      setCitizens((prev: Citizen[]) => {
        return workersData.map(worker => {
          const existing = prev.find(c => c.id === worker.id);
          if (existing) {
            return { ...worker, ...existing };
          }
          // New citizen
          const startX = Math.floor(Math.random() * WORLD_WIDTH);
          const startY = Math.floor(Math.random() * WORLD_HEIGHT);
          return {
            ...worker,
            x: startX,
            y: startY,
            targetX: startX,
            targetY: startY,
            currentAction: 'idle'
          } as Citizen;
        });
      });
    }, (error: any) => {
      console.error("Firestore Worker Subscription Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'workers');
    });

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(tasksData);
    }, (error: any) => {
      console.error("Firestore Task Subscription Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const messagesQuery = query(
      collection(db, 'messages'),
      where('officeId', '==', currentOffice.id),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage)).reverse();
      setGroupMessages(msgs.filter(m => m.type === 'public'));
      
      // Update citizen private messages
      setCitizens(prev => prev.map(citizen => ({
        ...citizen,
        messages: msgs.filter(m => 
          m.type === 'private' && 
          (m.senderId === citizen.id || m.receiverId === citizen.id)
        )
      })));
    }, (error: any) => {
      console.error("Firestore Message Subscription Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    const knowledgeQuery = query(
      collection(db, 'knowledge'),
      where('officeId', '==', currentOffice.id),
      where('ownerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeKnowledge = onSnapshot(knowledgeQuery, (snapshot) => {
      const knowledgeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Knowledge));
      setKnowledge(knowledgeData);
    }, (error: any) => {
      console.error("Firestore Knowledge Subscription Error:", error);
      handleFirestoreError(error, OperationType.LIST, 'knowledge');
    });

    return () => {
      unsubscribeWorkers();
      unsubscribeTasks();
      unsubscribeMessages();
      unsubscribeKnowledge();
    };
  }, [currentUser, currentOffice]);

  const handleAddKnowledge = async () => {
    if (!currentUser || !currentOffice || !newKnowledge.title || !newKnowledge.content) return;

    setIsAddingKnowledge(true);
    try {
      await addDoc(collection(db, 'knowledge'), {
        officeId: currentOffice.id,
        ownerId: currentUser.uid,
        title: newKnowledge.title,
        content: newKnowledge.content,
        type: 'text',
        createdAt: new Date().toISOString()
      });
      setNewKnowledge({ title: '', content: '', externalUrl: '' });
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, 'knowledge');
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'knowledge', id));
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, 'knowledge');
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentOffice?.status === 'closed') return;
      setCitizens(prev => {
        const next = prev.map(c => ({ ...c }));

        for (let i = 0; i < next.length; i++) {
          const c = next[i];

          // Handle Chatting State
          if (c.currentAction === 'chatting') {
            if (c.chatTimer && c.chatTimer > 0) {
              c.chatTimer--;
              continue; // Stay still while chatting
            } else {
              c.currentAction = 'idle';
              c.chattingWith = undefined;
              c.chatTimer = 0;
            }
          }

          // Handle Idle Actions (Looking around, stretching, interacting)
          if (['looking_around', 'stretching', 'interacting'].includes(c.currentAction)) {
            if (c.idleActionTimer && c.idleActionTimer > 0) {
              c.idleActionTimer--;
              continue; // Stay still while performing idle action
            } else {
              c.currentAction = 'idle';
              c.idleActionTimer = 0;
            }
          }

          // Work Assignment Logic
          if (c.isAssignedWork) {
            if (!c.hasProduct) {
              // Move to Work Area
              const inWorkArea = c.x >= WORK_AREA.x && c.x <= WORK_AREA.x + WORK_AREA.width &&
                               c.y >= WORK_AREA.y && c.y <= WORK_AREA.y + WORK_AREA.height;
              
              if (!inWorkArea) {
                c.targetX = WORK_AREA.x + WORK_AREA.width / 2;
                c.targetY = WORK_AREA.y + WORK_AREA.height / 2;
                c.currentAction = 'walking';
              } else {
                c.currentAction = 'working';
                c.workProgress = (c.workProgress || 0) + 1;
                if (c.workProgress >= 100) {
                  c.hasProduct = true;
                  c.workProgress = 0;
                  c.currentAction = 'delivering';
                }
              }
            } else {
              // Move to Storage Area
              const inStorageArea = c.x >= STORAGE_AREA.x && c.x <= STORAGE_AREA.x + STORAGE_AREA.width &&
                                  c.y >= STORAGE_AREA.y && c.y <= STORAGE_AREA.y + STORAGE_AREA.height;
              
              if (!inStorageArea) {
                c.targetX = STORAGE_AREA.x + STORAGE_AREA.width / 2;
                c.targetY = STORAGE_AREA.y + STORAGE_AREA.height / 2;
                c.currentAction = 'walking';
              } else {
                if (c.currentTaskId) {
                  completeTask(c.id, c.currentTaskId);
                }
                c.hasProduct = false;
                c.isAssignedWork = false; // Finish work cycle
                c.currentTaskId = undefined;
                c.currentAction = 'idle';
              }
            }
          } else {
            // Proximity Check for Chatting (Only if not working)
            if (Math.random() < 0.05) {
              for (let j = 0; j < next.length; j++) {
                if (i === j) continue;
                const other = next[j];
                
                if (other.currentAction !== 'chatting' && !other.isAssignedWork) {
                  const dist = Math.sqrt(Math.pow(c.x - other.x, 2) + Math.pow(c.y - other.y, 2));
                  if (dist < CHAT_PROXIMITY) {
                    // Start Chat!
                    c.currentAction = 'chatting';
                    c.chattingWith = other.id;
                    c.chatTimer = CHAT_DURATION;
                    c.targetX = c.x;
                    c.targetY = c.y;

                    other.currentAction = 'chatting';
                    other.chattingWith = c.id;
                    other.chatTimer = CHAT_DURATION;
                    other.targetX = other.x;
                    other.targetY = other.y;
                    break;
                  }
                }
              }
              if (c.currentAction === 'chatting') continue;
            }

            // Normal Random Movement Logic
            if (c.x === c.targetX && c.y === c.targetY) {
              if (Math.random() < 0.1) {
                c.targetX = Math.max(0, Math.min(WORLD_WIDTH - 1, c.x + (Math.random() > 0.5 ? 1 : -1)));
                c.targetY = Math.max(0, Math.min(WORLD_HEIGHT - 1, c.y + (Math.random() > 0.5 ? 1 : -1)));
                c.currentAction = 'walking';
              } else if (Math.random() < 0.05) {
                c.currentAction = Math.random() > 0.5 ? 'thinking' : 'working';
                
                // Occasional group message
                if (Math.random() < 0.1) {
                  const messages = [
                    "Checking the latest logs...",
                    "Anyone seen the documentation for the new API?",
                    "Coffee break time!",
                    "Thinking about the next sprint...",
                    "Just finished a quick review.",
                    "The virtual office looks great today!",
                    "Working on some optimizations."
                  ];
                  sendAgentMessage(c, messages[Math.floor(Math.random() * messages.length)]);
                }
              } else if (Math.random() < 0.05) {
                const idleActions: ('looking_around' | 'stretching' | 'interacting')[] = ['looking_around', 'stretching', 'interacting'];
                const selectedAction = idleActions[Math.floor(Math.random() * idleActions.length)];
                
                if (selectedAction === 'interacting') {
                  // Find nearest furniture
                  let nearest = null;
                  let minDist = 3; // Max interaction distance
                  for (const f of FURNITURE) {
                    const dist = Math.sqrt(Math.pow(c.x - f.x, 2) + Math.pow(c.y - f.y, 2));
                    if (dist < minDist) {
                      minDist = dist;
                      nearest = f;
                    }
                  }
                  
                  if (nearest) {
                    c.currentAction = 'interacting';
                    c.idleActionTimer = 30;
                    // Move slightly towards it if not already there
                    c.targetX = nearest.x;
                    c.targetY = nearest.y;
                  } else {
                    c.currentAction = 'looking_around';
                    c.idleActionTimer = 20;
                  }
                } else {
                  c.currentAction = selectedAction;
                  c.idleActionTimer = Math.floor(Math.random() * 20) + 10;
                }
              } else if (Math.random() < 0.02) {
                c.currentAction = 'idle';
              }
            }
          }

          // Movement execution
          if (c.x !== c.targetX || c.y !== c.targetY) {
            if (c.x < c.targetX) c.x += 0.1;
            else if (c.x > c.targetX) c.x -= 0.1;
            
            if (c.y < c.targetY) c.y += 0.1;
            else if (c.y > c.targetY) c.y -= 0.1;

            if (Math.abs(c.x - c.targetX) < 0.1) c.x = c.targetX;
            if (Math.abs(c.y - c.targetY) < 0.1) c.y = c.targetY;
            
            if (c.x === c.targetX && c.y === c.targetY && c.currentAction === 'walking') {
              c.currentAction = 'idle';
            }
          }
        }

        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const assignWork = async (citizenId: string, taskId: string) => {
    if (currentOffice?.status === 'closed') {
      alert("Office is closed. Tasks cannot be assigned.");
      return;
    }
    const citizen = citizens.find(c => c.id === citizenId);
    const task = tasks.find(t => t.id === taskId);

    setCitizens((prev: Citizen[]) => prev.map(c => {
      if (c.id === citizenId) {
        return { ...c, isAssignedWork: true, workProgress: 0, hasProduct: false, currentTaskId: taskId };
      }
      return c;
    }));

    // Update task status in Firestore to in-progress
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'in-progress',
        assignedTo: citizenId
      });

      // START AI GENERATION AUTONOMOUSLY
      if (task && citizen) {
        generateAIResult(task, citizen).then(async (result) => {
          await updateDoc(doc(db, 'tasks', taskId), {
            result: result
          });
        });
      }
    } catch (error: any) {
      console.error("Error updating task status:", error);
    }
  };

  const completeTask = async (citizenId: string, taskId: string) => {
    try {
      // Mark as done. The result is already being generated or is ready from assignWork
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'done'
      });
    } catch (error: any) {
      console.error("Error completing task:", error);
    }
  };

  const processTaskWithAI = async (task: Task) => {
    setIsGenerating(true);
    const citizen = citizens.find(c => c.id === task.assignedTo);
    if (!citizen) {
      setIsGenerating(false);
      return;
    }
    const result = await generateAIResult(task, citizen);
    
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        result: result
      });
      setViewingTaskResult((prev: Task | null) => prev ? { ...prev, result } : null);
    } catch (error: any) {
      console.error("Error updating task with AI result:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        status: 'pending',
        timestamp: new Date()
      });
    } catch (error: any) {
      console.error("Error creating task:", error);
    }
  };

  const collectProducts = async () => {
    const productsInStorage = tasks.filter(t => t.status === 'done' && !t.collected);
    try {
      await Promise.all(productsInStorage.map(task => 
        updateDoc(doc(db, 'tasks', task.id), {
          collected: true,
          status: 'archived'
        })
      ));
      setShowStorageModal(false);
    } catch (error) {
      console.error("Error collecting products:", error);
    }
  };

  const handleChatbotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatbotInput.trim() || isChatbotLoading) return;

    const userMsg = chatbotInput.trim();
    setChatbotMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatbotInput('');
    setIsChatbotLoading(true);

    try {
      const response = await aiService.generateThinkingResponse(userMsg, "You are a helpful AI Assistant in a Virtual Office. Provide detailed and thoughtful answers.");
      if (response) {
        setChatbotMessages(prev => [...prev, { role: 'ai', text: response }]);
      }
    } catch (error) {
      console.error("Chatbot Error:", error);
      setChatbotMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setIsGeneratingImage(true);
    setGeneratedImageUrl(null);
    try {
      const url = await aiService.generateImage(imagePrompt, selectedAspectRatio);
      setGeneratedImageUrl(url);
    } catch (error) {
      console.error("Image Gen Error:", error);
      alert("Failed to generate image. Please try again.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleAnalyzeAudio = async () => {
    if (!audioFile) return;
    setIsAnalyzingAudio(true);
    setAudioError('');
    setAudioSummary('');

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioFile);
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error('Failed to convert file to base64'));
          }
        };
        reader.onerror = error => reject(error);
      });
      
      const response = await aiService.generateAudioAnalysis(base64Data, audioFile.type || 'audio/mp3');
      if (response) {
        setAudioSummary(response);
      } else {
        setAudioError('No summary generated.');
      }
    } catch (err: any) {
      console.error('Error analyzing audio:', err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setAudioError('Quota exceeded for the AI model. Please wait a moment and try again.');
      } else {
        setAudioError('Failed to analyze the audio. Please ensure it is a valid audio file and try again.');
      }
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  if (!currentOffice) {
    return <div className="p-8 text-center text-slate-500">Select an office to enter the Virtual Office.</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-h-[800px]">
      <header className="mb-4 flex justify-between items-end shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <span className="text-indigo-600">Office Simulation</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest">{worldTheme}</span>
              <button 
                onClick={() => setShowWorldGen(true)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-indigo-600"
                title="Generate New Workspace"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-500 text-sm">
            <p>A digital workspace for your virtual office.</p>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.open('/landing', '_blank')}
                className="hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Docs
              </button>
              <button 
                onClick={() => setShowQuickstart(true)}
                className="hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Quickstart
              </button>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noreferrer"
                className="hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
              >
                <Github className="w-3.5 h-3.5" />
                GitHub
              </a>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowKnowledgeModal(true)}
            className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <Book className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">Knowledge Base</span>
            {knowledge.length > 0 && (
              <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full">{knowledge.length}</span>
            )}
          </button>
          <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">Tasks Completed</p>
              <p className="text-xl font-bold text-slate-900">{tasks.filter(t => t.status === 'done').length}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* World View */}
        <div className="flex-1 relative flex items-center justify-center" ref={worldContainerRef}>
          <div 
            className="relative bg-slate-200 rounded-3xl overflow-hidden shadow-inner border-8 border-slate-800"
            style={{ 
              width: WORLD_WIDTH * gridSize + 16,
              height: WORLD_HEIGHT * gridSize + 16,
              backgroundImage: `
                linear-gradient(to right, #e2e8f0 1px, transparent 1px),
                linear-gradient(to bottom, #e2e8f0 1px, transparent 1px),
                radial-gradient(circle, #cbd5e1 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`
            }}
          >
            {/* Areas */}
              <div 
                className="absolute border-2 border-dashed border-emerald-400/30 bg-emerald-400/5 rounded-xl flex items-center justify-center"
                style={{ 
                  left: WORK_AREA.x * gridSize, 
                  top: WORK_AREA.y * gridSize, 
                  width: WORK_AREA.width * gridSize, 
                  height: WORK_AREA.height * gridSize 
                }}
              >
                <span className="text-[10px] font-bold text-emerald-600/40 uppercase tracking-widest">Work Station</span>
              </div>

              <div 
                className="absolute border-2 border-dashed border-indigo-400/30 bg-indigo-400/5 rounded-xl flex items-center justify-center"
                style={{ 
                  left: BREAK_AREA.x * gridSize, 
                  top: BREAK_AREA.y * gridSize, 
                  width: BREAK_AREA.width * gridSize, 
                  height: BREAK_AREA.height * gridSize 
                }}
              >
                <span className="text-[10px] font-bold text-indigo-600/40 uppercase tracking-widest">Break Area</span>
              </div>

              <div 
                onClick={() => setShowStorageModal(true)}
                className="absolute border-2 border-dashed border-amber-400/30 bg-amber-400/5 rounded-xl flex items-center justify-center cursor-pointer hover:bg-amber-400/10 transition-colors group"
                style={{ 
                  left: STORAGE_AREA.x * gridSize, 
                  top: STORAGE_AREA.y * gridSize, 
                  width: STORAGE_AREA.width * gridSize, 
                  height: STORAGE_AREA.height * gridSize 
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-amber-600/40 uppercase tracking-widest group-hover:text-amber-600/60 transition-colors">Storage</span>
                  {tasks.filter(t => t.status === 'done' && !t.collected).length > 0 && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-full animate-bounce">
                        {tasks.filter(t => t.status === 'done' && !t.collected).length} Items
                      </span>
                      {tasks.filter(t => t.status === 'done' && !t.collected && !t.result).length > 0 && (
                        <span className="text-[7px] text-amber-600 font-bold animate-pulse flex items-center gap-1">
                          <Sparkles className="w-2 h-2" />
                          AI Finalizing...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div 
                onClick={() => setShowVisionModal(true)}
                className="absolute border-2 border-dashed border-indigo-400/30 bg-indigo-400/5 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-400/10 transition-colors group"
                style={{ 
                  left: VISION_AREA.x * gridSize, 
                  top: VISION_AREA.y * gridSize, 
                  width: VISION_AREA.width * gridSize, 
                  height: VISION_AREA.height * gridSize 
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-indigo-600/40 uppercase tracking-widest group-hover:text-indigo-600/60 transition-colors">Vision Lab</span>
                  <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center mt-1">
                    <ImageIcon className="w-3 h-3 text-indigo-600" />
                  </div>
                </div>
              </div>

              <div 
                onClick={() => setShowAudioModal(true)}
                className="absolute border-2 border-dashed border-rose-400/30 bg-rose-400/5 rounded-xl flex items-center justify-center cursor-pointer hover:bg-rose-400/10 transition-colors group"
                style={{ 
                  left: AUDIO_AREA.x * gridSize, 
                  top: AUDIO_AREA.y * gridSize, 
                  width: AUDIO_AREA.width * gridSize, 
                  height: AUDIO_AREA.height * gridSize 
                }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-bold text-rose-600/40 uppercase tracking-widest group-hover:text-rose-600/60 transition-colors">Audio Lab</span>
                  <div className="w-6 h-6 bg-rose-100 rounded-lg flex items-center justify-center mt-1">
                    <Mic className="w-3 h-3 text-rose-600" />
                  </div>
                </div>
              </div>

              {/* Furniture Objects */}
              {FURNITURE.map(f => (
                <div 
                  key={f.id}
                  className="absolute flex flex-col items-center justify-center group"
                  style={{ 
                    left: f.x * gridSize, 
                    top: f.y * gridSize, 
                    width: gridSize, 
                    height: gridSize 
                  }}
                >
                  <f.icon className="w-6 h-6 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  <span className="absolute -bottom-4 text-[8px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-white px-1 rounded border border-slate-100 shadow-sm z-30">
                    {f.name}
                  </span>
                </div>
              ))}
              
              {/* Break Area Props */}
              <div className="absolute" style={{ left: (BREAK_AREA.x + 1) * gridSize, top: (BREAK_AREA.y + 1) * gridSize }}>
                <div className="w-20 h-8 bg-slate-300 rounded-full opacity-40 shadow-inner" title="Couch" />
              </div>
              <div className="absolute" style={{ left: (BREAK_AREA.x + 3) * gridSize, top: (BREAK_AREA.y + 0.5) * gridSize }}>
                <div className="w-8 h-12 bg-slate-800 rounded shadow-lg flex items-center justify-center" title="Vending Machine">
                  <div className="w-4 h-1 bg-indigo-500 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="absolute" style={{ left: (BREAK_AREA.x + 0.5) * gridSize, top: (BREAK_AREA.y + 3) * gridSize }}>
                <div className="w-6 h-10 bg-blue-100 rounded-t-lg border-2 border-blue-200 flex flex-col items-center justify-end pb-1" title="Water Cooler">
                  <div className="w-3 h-4 bg-blue-400/30 rounded-sm" />
                </div>
              </div>
              
              {/* Plants */}
              <div className="absolute text-emerald-600/30" style={{ top: 7.5 * gridSize, left: 1.25 * gridSize }}><Package className="w-6 h-6 rotate-12" /></div>
              <div className="absolute text-emerald-600/30" style={{ top: 1.25 * gridSize, left: 8.75 * gridSize }}><Package className="w-5 h-5 -rotate-12" /></div>
              <div className="absolute text-emerald-600/30" style={{ top: 13.75 * gridSize, left: 11.25 * gridSize }}><Package className="w-7 h-7" /></div>

              {/* Products in Storage (Representing Completed Tasks) */}
              {Array.from({ length: Math.min(tasks.filter(t => t.status === 'done').length, 20) }).map((_, i) => (
                <motion.div
                  key={`product-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute w-4 h-4 bg-amber-600 rounded shadow-sm border border-amber-700"
                  style={{
                    left: (STORAGE_AREA.x + 0.5 + (i % 3)) * gridSize,
                    top: (STORAGE_AREA.y + 0.5 + Math.floor(i / 3)) * gridSize,
                  }}
                />
              ))}

              {/* Citizens */}
              {citizens.map(citizen => (
                <motion.div
                  key={citizen.id}
                  className="absolute cursor-pointer group"
                  style={{ 
                    left: citizen.x * gridSize, 
                    top: citizen.y * gridSize,
                    width: gridSize,
                    height: gridSize,
                  }}
                  onClick={() => setSelectedCitizen(citizen)}
                  animate={{ x: 0, y: 0 }} // Handled by style for smoother 0.1 increments
                >
                  {/* Thought Bubble */}
                  <AnimatePresence>
                    {citizen.currentAction === 'thinking' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: 1, y: -20 }}
                        exit={{ opacity: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-sm border border-slate-200"
                      >
                        <Brain className="w-3 h-3 text-indigo-500" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'working' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: 1, y: -20 }}
                        exit={{ opacity: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-sm border border-slate-200 flex items-center gap-1 px-2"
                      >
                        <Monitor className="w-3 h-3 text-emerald-500" />
                        {citizen.currentTaskId && (
                          <span className="text-[8px] font-bold text-slate-600 truncate max-w-[60px]">
                            {tasks.find(t => t.id === citizen.currentTaskId)?.title}
                          </span>
                        )}
                      </motion.div>
                    )}
                    {citizen.currentAction === 'chatting' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -25 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-600 text-white rounded-full p-1.5 shadow-lg border-2 border-white"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'looking_around' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -20 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-sm border border-slate-200"
                      >
                        <Eye className="w-3 h-3 text-amber-500" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'stretching' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -20 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-sm border border-slate-200"
                      >
                        <Accessibility className="w-3 h-3 text-emerald-500" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'interacting' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -20 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white rounded-full p-1 shadow-sm border border-slate-200"
                      >
                        <Hand className="w-3 h-3 text-rose-500" />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action Badge & AI Status */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
                    {citizen.isAssignedWork && !tasks.find(t => t.id === citizen.currentTaskId)?.result && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-indigo-500 text-white text-[7px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg whitespace-nowrap"
                      >
                        <Sparkles className="w-2 h-2 animate-pulse" />
                        AI Thinking...
                      </motion.div>
                    )}
                    <div className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-tighter shadow-sm border ${
                      citizen.currentAction === 'working' ? 'bg-emerald-500 text-white border-emerald-400' :
                      citizen.currentAction === 'thinking' ? 'bg-indigo-500 text-white border-indigo-400' :
                      citizen.currentAction === 'walking' ? 'bg-slate-700 text-white border-slate-600' :
                      ['looking_around', 'stretching', 'interacting'].includes(citizen.currentAction) ? 'bg-amber-400 text-white border-amber-300' :
                      'bg-white text-slate-400 border-slate-100'
                    }`}>
                      {citizen.currentAction.replace('_', ' ')}
                    </div>
                    <div className="mt-0.5 px-1 py-0.5 rounded-full bg-slate-800/50 text-white text-[5px] font-bold uppercase tracking-widest">
                      Interactive
                    </div>
                  </div>

                  {/* Character Sprite (Simplified) */}
                  <div className="relative w-full h-full flex items-center justify-center">
                    {/* Legs/Feet Animation */}
                    {citizen.currentAction === 'walking' && (
                      <div className="absolute bottom-1 flex gap-3">
                        <motion.div 
                          animate={{ y: [0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 0.3 }}
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                        />
                        <motion.div 
                          animate={{ y: [0, -3, 0] }}
                          transition={{ repeat: Infinity, duration: 0.3, delay: 0.15 }}
                          className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                        />
                      </div>
                    )}

                    <motion.div 
                      animate={
                        citizen.currentAction === 'walking' || citizen.currentAction === 'delivering' ? { 
                          y: [0, -2, 0],
                          rotate: [-3, 3, -3]
                        } : 
                        citizen.currentAction === 'looking_around' ? {
                          rotate: [-15, 15, -15, 0]
                        } :
                        citizen.currentAction === 'stretching' ? {
                          scale: [1, 1.1, 1],
                          y: [0, -2, 0]
                        } :
                        citizen.currentAction === 'interacting' ? {
                          x: [-1, 1, -1, 1, 0]
                        } :
                        { y: 0, rotate: 0, scale: 1, x: 0 }
                      }
                      transition={{ 
                        repeat: ['looking_around', 'stretching', 'interacting'].includes(citizen.currentAction) ? 0 : Infinity, 
                        duration: citizen.currentAction === 'walking' ? 0.4 : 0.8 
                      }}
                      className={`w-8 h-8 rounded-lg shadow-md flex items-center justify-center transition-colors z-10 ${
                        selectedCitizen?.id === citizen.id ? 'bg-indigo-600 text-white scale-110 ring-4 ring-indigo-200' : 'bg-white text-slate-600'
                      }`}
                    >
                      <User className="w-5 h-5" />
                    </motion.div>

                    {/* Carried Product */}
                    {citizen.hasProduct && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, y: -15 }}
                        className="absolute w-3 h-3 bg-amber-600 rounded shadow-sm border border-amber-700 z-20"
                      />
                    )}
                    
                    {/* Name Tag */}
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold bg-slate-800 text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {citizen.name}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
        </div>

        {/* Sidebar Info */}
        <div className="w-80 flex flex-col gap-4 overflow-hidden h-full">
          {/* Citizens List */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shrink-0 max-h-[180px] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Citizens</h2>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-500">{citizens.length}</span>
            </div>
            <div className="space-y-2">
              {citizens.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCitizen(c)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all border ${
                    selectedCitizen?.id === c.id ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <div className="text-left overflow-hidden">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.name}</p>
                    <p className="text-[9px] text-slate-500 capitalize">{c.currentAction}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Group Chat */}
          <div className="bg-slate-900 p-4 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Group Channel</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className={`p-1 rounded transition-colors ${ttsEnabled ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-500 hover:text-slate-400'}`}
                  title="Toggle TTS"
                >
                  {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                </button>
                <button 
                  onClick={() => setShowImageGenModal(true)}
                  className="p-1 text-slate-500 hover:text-indigo-400 transition-colors"
                  title="Generate Image"
                >
                  <ImageIcon className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* AI Mode Selector */}
            <div className="flex gap-1 mb-3 bg-slate-800 p-1 rounded-lg">
              {[
                { id: 'fast', icon: <Zap className="w-3 h-3" />, label: 'Fast' },
                { id: 'thinking', icon: <Brain className="w-3 h-3" />, label: 'Think' },
                { id: 'maps', icon: <MapPin className="w-3 h-3" />, label: 'Maps' }
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => setAiMode(mode.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[9px] font-bold transition-all ${
                    aiMode === mode.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mb-3 custom-scrollbar pr-1">
              {groupMessages.map((msg: any) => (
                <div key={msg.id} className="text-[10px] group relative">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="font-bold text-indigo-400">{msg.senderName}</span>
                    {msg.isThinking && <Brain className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />}
                    {msg.audioUrl && <Volume2 className="w-2.5 h-2.5 text-emerald-500" />}
                  </div>
                  <p className="text-slate-300 leading-relaxed">{msg.message}</p>
                  {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {msg.groundingUrls.map((url: string, i: number) => (
                        <a 
                          key={i} 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[8px] text-indigo-400 hover:underline flex items-center gap-0.5 bg-indigo-400/10 px-1.5 py-0.5 rounded"
                        >
                          <MapPin className="w-2 h-2" />
                          Source {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {groupMessages.length === 0 && (
                <p className="text-[10px] text-slate-600 italic text-center py-4">No messages yet...</p>
              )}
            </div>
            <div className="flex gap-1">
              <input 
                type="text" 
                placeholder={aiMode === 'maps' ? "Ask about locations..." : aiMode === 'thinking' ? "Ask complex questions..." : "Broadcast message..."}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none focus:border-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleBroadcastMessage(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
              />
            </div>
          </div>

          {selectedCitizen && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xl shrink-0"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="overflow-hidden">
                  <h3 className="text-sm font-bold text-slate-900 truncate">{selectedCitizen.name}</h3>
                  <p className="text-indigo-600 text-[10px] font-bold uppercase tracking-wider">{selectedCitizen.role}</p>
                </div>
                <button 
                  onClick={() => setSelectedCitizen(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              </div>
              
              <div className="space-y-3">
                {/* DM History */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Direct Messages</p>
                  <div className="max-h-24 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                    {(selectedCitizen.messages || []).filter(m => m.type === 'private').map(msg => (
                      <div key={msg.id} className={`text-[9px] p-1.5 rounded-lg ${msg.senderId === selectedCitizen.id ? 'bg-indigo-100 text-indigo-800' : 'bg-white text-slate-600 border border-slate-100'}`}>
                        <p className="font-bold mb-0.5">{msg.senderName}</p>
                        <p>{msg.message}</p>
                      </div>
                    ))}
                    {(selectedCitizen.messages || []).length === 0 && (
                      <p className="text-[9px] text-slate-400 italic text-center py-2">No private messages</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Action</span>
                    <span className="font-bold text-slate-900 capitalize">{selectedCitizen.currentAction}</span>
                  </div>
                  {selectedCitizen.isAssignedWork && (
                    <div className="pt-1">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.floor(selectedCitizen.workProgress || 0)}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                        <motion.div 
                          className="bg-indigo-600 h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedCitizen.workProgress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
      {/* Storage Inventory Modal */}
      <AnimatePresence>
        {showStorageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStorageModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-amber-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Storage Inventory</h2>
                    <p className="text-xs text-amber-600 font-medium uppercase tracking-wider">Ready for Collection</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowStorageModal(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {tasks.filter(t => t.status === 'done' && !t.collected).length > 0 ? (
                  <div className="space-y-3">
                    {tasks.filter(t => t.status === 'done' && !t.collected).map(task => (
                      <button 
                        key={task.id}
                        onClick={() => setViewingTaskResult(task)}
                        className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 group hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{task.title}</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              <User className="w-2 h-2" />
                              {citizens.find(c => c.id === task.assignedTo)?.name || 'Unknown Agent'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!task.result && (
                            <span className="text-[8px] font-bold text-indigo-500 animate-pulse flex items-center gap-1">
                              <Sparkles className="w-2 h-2" />
                              Processing...
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.result ? 'View Result' : 'Waiting for AI'}
                          </span>
                          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-amber-400 transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Archive className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">Storage is empty</p>
                    <p className="text-xs text-slate-400 mt-1">Assign tasks to your agents to produce items.</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={collectProducts}
                  disabled={tasks.filter(t => t.status === 'done' && !t.collected).length === 0}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                >
                  <Package className="w-5 h-5" />
                  Collect All Products
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Result Modal */}
      <AnimatePresence>
        {viewingTaskResult && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingTaskResult(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{viewingTaskResult.title}</h2>
                    <p className="text-xs text-indigo-600 font-medium uppercase tracking-wider">Work Output</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingTaskResult(null)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-8">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 font-mono text-sm text-slate-700 whitespace-pre-wrap min-h-[200px] max-h-[400px] overflow-y-auto relative">
                  {isGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <p className="text-xs font-bold text-slate-500 animate-pulse">Agent is processing data...</p>
                    </div>
                  ) : viewingTaskResult.result ? (
                    viewingTaskResult.result
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <Brain className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-slate-400 mb-6">No content generated for this task yet.</p>
                      <button
                        onClick={() => processTaskWithAI(viewingTaskResult)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Sparkles className="w-4 h-4" />
                        Generate with Agent AI
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      if (viewingTaskResult.result) {
                        navigator.clipboard.writeText(viewingTaskResult.result);
                      }
                    }}
                    disabled={!viewingTaskResult.result || isGenerating}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Copy Content
                  </button>
                  <button
                    disabled={!viewingTaskResult.result || isGenerating}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  Processed by Miniverse Agent Intelligence
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* World Generator Modal */}
      <AnimatePresence>
        {showWorldGen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWorldGen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 text-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-800"
            >
              <div className="p-12">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                      <Sparkles className="w-8 h-8 text-indigo-400" />
                      World Generator
                    </h2>
                    <p className="text-slate-400">Describe it. Get a complete, playable miniverse.</p>
                  </div>
                  <button onClick={() => setShowWorldGen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-8">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">From a description</label>
                    <div className="relative">
                      <textarea 
                        value={worldPrompt}
                        onChange={(e) => setWorldPrompt(e.target.value)}
                        placeholder="e.g. 'cozy startup office with lots of plants and a coffee bar'"
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 text-sm text-white outline-none focus:border-indigo-500 min-h-[120px] resize-none"
                      />
                      <button 
                        onClick={() => generateWorld()}
                        disabled={isGeneratingWorld || !worldPrompt}
                        className="absolute bottom-4 right-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-500 transition-all disabled:opacity-50"
                      >
                        {isGeneratingWorld ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate Workspace
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                          <ImageIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <h3 className="font-bold">From Image</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">Upload a reference photo to generate a workspace with similar aesthetics and layout.</p>
                      <button className="w-full py-3 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                        Upload Image
                      </button>
                    </div>
                    <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h3 className="font-bold">Shared Workspaces</h3>
                      </div>
                      <p className="text-xs text-slate-500 mb-4 leading-relaxed">Join a shared workspace and meet other agents from around the globe.</p>
                      <button className="w-full py-3 border border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors">
                        Explore Workspaces
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audio Lab Modal */}
      <AnimatePresence>
        {showAudioModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAudioModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Audio Lab</h2>
                    <p className="text-slate-500 text-sm">Upload audio for AI analysis using Gemini 3.1 Pro.</p>
                  </div>
                  <button onClick={() => setShowAudioModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                      {audioFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileAudio className="w-8 h-8 text-rose-500" />
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{audioFile.name}</p>
                        </div>
                      ) : (
                        <>
                          <Mic className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-400">Click to upload audio</p>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="audio/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setAudioFile(e.target.files[0]);
                            setAudioError('');
                            setAudioSummary('');
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    
                    {audioFile && (
                      <button 
                        onClick={handleAnalyzeAudio}
                        disabled={isAnalyzingAudio}
                        className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isAnalyzingAudio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {isAnalyzingAudio ? 'Analyzing...' : 'Generate Insights'}
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col h-[300px]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Insights & Summary</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                      {isAnalyzingAudio ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
                          <p className="text-xs animate-pulse">Gemini is processing your audio...</p>
                        </div>
                      ) : audioError ? (
                        <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
                          {audioError}
                        </div>
                      ) : audioSummary ? (
                        <div className="prose prose-slate prose-xs max-w-none">
                          <Markdown>{audioSummary}</Markdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center">
                          <Mic className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-[10px] uppercase font-bold tracking-widest">Awaiting Audio</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Vision Lab Modal */}
      <AnimatePresence>
        {showVisionModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVisionModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Vision Lab</h2>
                    <p className="text-slate-500 text-sm">Upload an image for AI analysis using Gemini 3.1 Pro.</p>
                  </div>
                  <button onClick={() => setShowVisionModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="aspect-video bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden relative group">
                      {selectedImage ? (
                        <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-400">Click to upload image</p>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                    
                    {selectedImage && (
                      <button 
                        onClick={() => analyzeImage(selectedImage)}
                        disabled={analyzingImage}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {analyzingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {analyzingImage ? 'Analyzing...' : 'Re-analyze Image'}
                      </button>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col h-[300px]">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Analysis Result</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                      {analyzingImage ? (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                          <p className="text-xs animate-pulse">Gemini is processing your image...</p>
                        </div>
                      ) : analysisResult ? (
                        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {analysisResult}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 italic text-xs text-center">
                          Upload an image to see the AI analysis here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quickstart Modal */}
      <AnimatePresence>
        {showQuickstart && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQuickstart(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-12">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-4xl font-bold tracking-tight mb-2">Up and running in under a minute</h2>
                    <p className="text-slate-500">Pick your setup. Every quickstart starts the same way.</p>
                  </div>
                  <button onClick={() => setShowQuickstart(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 rounded-2xl font-mono text-sm shadow-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Terminal className="w-4 h-4 text-indigo-400" />
                      <span>npx create-virtual-office</span>
                    </div>
                    <button 
                      onClick={() => navigator.clipboard.writeText('npx create-virtual-office')}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Copy
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    {[
                      { title: "Claude Code", icon: <Zap className="w-5 h-5 text-amber-500" />, color: "bg-amber-50" },
                      { title: "OpenClaw", icon: <Cpu className="w-5 h-5 text-indigo-500" />, color: "bg-indigo-50" },
                      { title: "Any Agent", icon: <Users className="w-5 h-5 text-emerald-500" />, color: "bg-emerald-50" }
                    ].map((item, i) => (
                      <div key={i} className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all cursor-pointer group">
                        <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mb-4`}>
                          {item.icon}
                        </div>
                        <h3 className="font-bold text-sm mb-2">{item.title}</h3>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg mb-1">Ready for advanced mode?</p>
                      <p className="text-indigo-100 text-xs">Learn how to enable Interactive communication.</p>
                    </div>
                    <button className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">
                      View Docs
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Image Generation Modal */}
      <AnimatePresence>
        {showImageGenModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageGenModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Creative Studio</h2>
                      <p className="text-xs text-slate-500">Generate high-quality office assets with AI</p>
                    </div>
                  </div>
                  <button onClick={() => setShowImageGenModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Prompt</label>
                      <textarea 
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="Describe the image you want to generate..."
                        className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Aspect Ratio</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"] as AspectRatio[]).map(ratio => (
                          <button
                            key={ratio}
                            onClick={() => setSelectedAspectRatio(ratio)}
                            className={`py-2 rounded-xl text-[10px] font-bold transition-all border ${
                              selectedAspectRatio === ratio 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            {ratio}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || !imagePrompt.trim()}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl"
                    >
                      {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                    </button>
                  </div>

                  <div className="aspect-square bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative">
                    {isGeneratingImage ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                        <p className="text-xs text-slate-400 animate-pulse font-medium">Creating your masterpiece...</p>
                      </div>
                    ) : generatedImageUrl ? (
                      <img src={generatedImageUrl} alt="Generated" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-8">
                        <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-xs text-slate-400 font-medium">Your generated image will appear here</p>
                      </div>
                    )}
                    
                    {generatedImageUrl && (
                      <a 
                        href={generatedImageUrl} 
                        download="generated-office-asset.png"
                        className="absolute bottom-4 right-4 p-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg hover:bg-white transition-colors text-slate-900"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Knowledge Base Modal */}
      <AnimatePresence>
        {showKnowledgeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKnowledgeModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <Book className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-widest">Knowledge Base</h2>
                    <p className="text-sm text-indigo-300 font-bold">Pre-loaded information for agent personalization</p>
                  </div>
                </div>
                <button onClick={() => setShowKnowledgeModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden flex">
                {/* Left: Add Knowledge */}
                <div className="w-1/3 border-r border-slate-100 p-8 bg-slate-50/50 flex flex-col">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-indigo-600" />
                    Add Knowledge
                  </h3>

                  {!googleAccessToken && (knowledgeTab === 'drive' || knowledgeTab === 'notebooklm') ? (
                    <button 
                      onClick={handleGoogleLogin}
                      className="w-full mb-6 bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-3 hover:bg-slate-50 transition-all group"
                    >
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                        <User className="w-5 h-5 text-slate-400 group-hover:text-indigo-600" />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-slate-900">Connect Google Account</p>
                        <p className="text-[10px] text-slate-500">Required for Drive & NotebookLM</p>
                      </div>
                    </button>
                  ) : googleAccessToken && (knowledgeTab === 'drive' || knowledgeTab === 'notebooklm') ? (
                    <div className="mb-6 flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Google Connected</span>
                      </div>
                      <button onClick={handleGoogleLogout} className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors">Disconnect</button>
                    </div>
                  ) : null}

                  {/* Tabs */}
                  <div className="flex bg-slate-200/50 p-1 rounded-xl mb-6">
                    <button 
                      onClick={() => setKnowledgeTab('text')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${knowledgeTab === 'text' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Text
                    </button>
                    <button 
                      onClick={() => setKnowledgeTab('file')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${knowledgeTab === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      File
                    </button>
                    <button 
                      onClick={() => setKnowledgeTab('drive')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${knowledgeTab === 'drive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Drive
                    </button>
                    <button 
                      onClick={() => setKnowledgeTab('notebooklm')}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${knowledgeTab === 'notebooklm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Notebook
                    </button>
                  </div>

                  <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2">
                    {knowledgeTab === 'text' && (
                      <>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                          <input 
                            type="text"
                            value={newKnowledge.title}
                            onChange={(e) => setNewKnowledge(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="e.g., Company Culture"
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Content</label>
                          <textarea 
                            value={newKnowledge.content}
                            onChange={(e) => setNewKnowledge(prev => ({ ...prev, content: e.target.value }))}
                            placeholder="Enter the information agents should know..."
                            rows={8}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                          />
                        </div>
                        <button 
                          onClick={handleAddKnowledge}
                          disabled={isAddingKnowledge || !newKnowledge.title || !newKnowledge.content}
                          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {isAddingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                          Save Text
                        </button>
                      </>
                    )}

                    {knowledgeTab === 'file' && (
                      <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:border-indigo-300 transition-colors group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload}
                        />
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-50 transition-colors">
                          {uploadingFile ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" /> : <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />}
                        </div>
                        <p className="text-sm font-bold text-slate-900 mb-1">Upload File</p>
                        <p className="text-[10px] text-slate-500 text-center">PDF, DOCX, TXT (Max 750KB)</p>
                      </div>
                    )}

                    {knowledgeTab === 'drive' && (
                      <div className="space-y-6">
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:border-emerald-300 transition-colors group cursor-pointer flex flex-col items-center justify-center text-center" onClick={openPicker}>
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                            {isDriveLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> : <HardDrive className="w-6 h-6 text-emerald-500" />}
                          </div>
                          <p className="text-sm font-bold text-slate-900 mb-1">Browse Google Drive</p>
                          <p className="text-[10px] text-slate-500">Select files directly from your account</p>
                        </div>

                        <div className="relative">
                          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                          <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold text-slate-400 bg-slate-50 px-2">Or add manually</div>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                            <input 
                              type="text"
                              value={newKnowledge.title}
                              onChange={(e) => setNewKnowledge(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="e.g., Project Drive Folder"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">URL</label>
                            <input 
                              type="url"
                              value={newKnowledge.externalUrl}
                              onChange={(e) => setNewKnowledge(prev => ({ ...prev, externalUrl: e.target.value }))}
                              placeholder="https://drive.google.com/..."
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <button 
                            onClick={() => handleAddExternalKnowledge('drive')}
                            disabled={isAddingKnowledge || !newKnowledge.title || !newKnowledge.externalUrl}
                            className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isAddingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                            Connect Manually
                          </button>
                        </div>
                      </div>
                    )}

                    {knowledgeTab === 'notebooklm' && (
                      <div className="space-y-6">
                        <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-xs font-bold text-slate-900">NotebookLM Integration</p>
                          </div>
                          <p className="text-[10px] text-slate-600 leading-relaxed">
                            Connect your NotebookLM notebooks to give agents deep context from your curated sources. Paste the shareable link below.
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Title</label>
                            <input 
                              type="text"
                              value={newKnowledge.title}
                              onChange={(e) => setNewKnowledge(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="e.g., Marketing Strategy Notebook"
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Notebook URL</label>
                            <input 
                              type="url"
                              value={newKnowledge.externalUrl}
                              onChange={(e) => setNewKnowledge(prev => ({ ...prev, externalUrl: e.target.value }))}
                              placeholder="https://notebooklm.google.com/..."
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            />
                          </div>
                          <button 
                            onClick={() => handleAddExternalKnowledge('notebooklm')}
                            disabled={isAddingKnowledge || !newKnowledge.title || !newKnowledge.externalUrl}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isAddingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                            Link Notebook
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Knowledge List */}
                <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    Stored Knowledge ({knowledge.length})
                  </h3>
                  
                  {knowledge.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-4">
                        <Book className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-sm font-bold text-slate-900 mb-1">No knowledge stored yet</p>
                      <p className="text-xs text-slate-500">Add information on the left to personalize your agents.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {knowledge.map((item) => (
                        <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                item.type === 'file' ? 'bg-amber-50 text-amber-600' :
                                item.type === 'drive' ? 'bg-emerald-50 text-emerald-600' :
                                item.type === 'notebooklm' ? 'bg-indigo-50 text-indigo-600' :
                                'bg-slate-50 text-slate-600'
                              }`}>
                                {item.type === 'file' && <FileText className="w-4 h-4" />}
                                {item.type === 'drive' && <HardDrive className="w-4 h-4" />}
                                {item.type === 'notebooklm' && <Share2 className="w-4 h-4" />}
                                {item.type === 'text' && <FileText className="w-4 h-4" />}
                              </div>
                              <h4 className="font-bold text-slate-900">{item.title}</h4>
                            </div>
                            <button 
                              onClick={() => handleDeleteKnowledge(item.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {item.type === 'text' && (
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-4">
                              {item.content}
                            </p>
                          )}

                          {item.type === 'file' && (
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2">
                                <File className="w-4 h-4 text-slate-400" />
                                <div className="overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-700 truncate">{item.fileName}</p>
                                  <p className="text-[8px] text-slate-400">{(item.fileSize! / 1024).toFixed(1)} KB • {item.mimeType}</p>
                                </div>
                              </div>
                              <a 
                                href={item.content} 
                                download={item.fileName}
                                className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Download className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {(item.type === 'drive' || item.type === 'notebooklm') && (
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2">
                                {item.type === 'drive' ? <HardDrive className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4 text-indigo-500" />}
                                <div className="overflow-hidden">
                                  <p className="text-[10px] font-bold text-slate-700 truncate">{item.externalUrl}</p>
                                  <p className="text-[8px] text-slate-400 uppercase tracking-widest">{item.type} Connection</p>
                                </div>
                              </div>
                              <a 
                                href={item.externalUrl} 
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Added {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              <Sparkles className="w-2.5 h-2.5" />
                              Active Context
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Floating Button */}
      <button
        onClick={() => setShowChatbot(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-indigo-700 transition-all hover:scale-110 z-40 group"
      >
        <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <div className="absolute right-full mr-4 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
          AI Assistant
        </div>
      </button>

      {/* AI Assistant Chat Modal */}
      <AnimatePresence>
        {showChatbot && (
          <div className="fixed inset-0 z-[90] flex items-end justify-end p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100 flex flex-col h-[600px] pointer-events-auto overflow-hidden"
            >
              <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest">AI Assistant</h2>
                    <p className="text-[10px] text-indigo-300 font-bold">Powered by Gemini 3.1 Pro</p>
                  </div>
                </div>
                <button onClick={() => setShowChatbot(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50/50">
                {chatbotMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                      <Sparkles className="w-8 h-8 text-indigo-600" />
                    </div>
                    <p className="text-sm font-bold text-slate-900 mb-1">How can I help you today?</p>
                    <p className="text-xs text-slate-500">Ask me anything about your office, tasks, or general questions.</p>
                  </div>
                )}
                {chatbotMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isChatbotLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      <span className="text-xs text-slate-400 font-medium animate-pulse">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleChatbotSubmit} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                <input
                  type="text"
                  value={chatbotInput}
                  onChange={(e) => setChatbotInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!chatbotInput.trim() || isChatbotLoading}
                  className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
