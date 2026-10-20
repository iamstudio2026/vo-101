/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import { Worker, Task, Citizen, ChatMessage, Knowledge, Office, Furniture } from '../types';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Coffee, MessageSquare, Brain, AlertCircle, User, CheckSquare, ListTodo, Play, CheckCircle2, Package, X, ArrowRight, Archive, FileText, ExternalLink, Download, ClipboardCheck, Loader2, Sparkles, Terminal, Code, Cpu, Zap, Github, BookOpen, Image as ImageIcon, MapPin, Volume2, VolumeX, Send, Wand2 as WandIcon, Book, Plus, Trash2, Users, File, Link, HardDrive, Share2, Upload, Eye, Accessibility, Hand, Mic, FileAudio, Search, PenTool, BarChart3, Sun, Database, Mail, Layers, ShieldCheck, Hourglass, ThumbsUp, RotateCcw } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { downloadDeliverablePdf } from '../lib/exportPdf';
import * as engine from '../services/engine';
import { approveTask, requestChanges, requeueTask as requeueTaskDoc, REQUEUE_FIELDS } from '../services/taskActions';
import { isAwaitingApproval, isLive, pickTaskToPlay, scriptFor, SCENES, step, type Station } from '../lib/choreography';

const copyToClipboard = (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text);
  } else {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};

const WORLD_WIDTH = 20;
const WORLD_HEIGHT = 15;

const OFFICE_AREAS = [
  { id: 'archive', name: 'La Bibliosfera', description: 'Archivo de la Verdad. El núcleo central donde la información se categoriza y destila en conocimiento puro.', x: 0, y: 0, w: 4, h: 4, color: 'bg-slate-500/5', border: 'border-slate-200/50', text: 'text-slate-500', icon: BookOpen },
  { id: 'logic', name: 'La Forja de Algoritmos', description: 'Motor Lógico. Aquí es donde los procesos se optimizan, el código se refina y la lógica computacional cobra vida.', x: 4, y: 0, w: 4, h: 4, color: 'bg-cyan-500/5', border: 'border-cyan-200/50', text: 'text-cyan-600', icon: Code },
  { id: 'oracle', name: 'El Faro de Información', description: 'El Oráculo. Una terminal circular de búsqueda constante que ilumina los datos externos para integrarlos al sistema.', x: 8, y: 0, w: 4, h: 4, color: 'bg-indigo-500/5', border: 'border-indigo-200/50', text: 'text-indigo-600', icon: Search },
  { id: 'bistro', name: 'Bit & Byte Bistro', description: 'Centro de Sincronía. Un espacio inmersivo para la recarga energética y la colaboración informal entre agentes.', x: 16, y: 0, w: 4, h: 4, color: 'bg-amber-500/5', border: 'border-amber-200/50', text: 'text-amber-700', icon: Coffee },
  
  { id: 'optic', name: 'Pabellón de Renderizado', description: 'Optic Studio. Los agentes diseccionan y mejoran la estética visual para crear interfaces y arte de vanguardia.', x: 0, y: 5, w: 4, h: 4, color: 'bg-purple-500/5', border: 'border-purple-200/50', text: 'text-purple-600', icon: ImageIcon },
  { id: 'sonic', name: 'Laboratorio de Resonancia', description: 'Sonic Lab. Paneles de ondas de luz insonorizados donde se procesa audio y se transforman frecuencias en texto.', x: 8, y: 5, w: 4, h: 4, color: 'bg-blue-500/5', border: 'border-blue-200/50', text: 'text-blue-600', icon: Mic },
  { id: 'qa', name: 'Aduana de Calidad', description: 'Control de Calidad. Un revisor independiente coteja cada entregable con lo pedido antes de que salga de la oficina.', x: 12, y: 5, w: 4, h: 4, color: 'bg-yellow-500/5', border: 'border-yellow-200/50', text: 'text-yellow-600', icon: ShieldCheck },
  { id: 'dispatch', name: 'Centro de Despacho', description: 'Hub de Distribución. La central logística encargada de enviar los resultados procesados al mundo exterior.', x: 16, y: 5, w: 4, h: 5, color: 'bg-emerald-500/5', border: 'border-emerald-200/50', text: 'text-emerald-600', icon: Send },
  
  { id: 'forge', name: 'La Fragua Creativa', description: 'Creative Forge. El taller de narrativa donde las ideas se funden en informes detallados y contenido persuasivo.', x: 0, y: 10, w: 4, h: 5, color: 'bg-rose-500/5', border: 'border-rose-200/50', text: 'text-rose-600', icon: PenTool },
  { id: 'zen', name: 'Kinetic Zen Zone', description: 'Jardín Fractal. Un entorno de meditación digital para balancear los estados cognitivos de la red neuronal.', x: 4, y: 10, w: 4, h: 5, color: 'bg-green-500/5', border: 'border-green-200/50', text: 'text-green-600', icon: Sun },
  { id: 'insight', name: 'Cámara de Revelaciones', description: 'Insight Chamber. Terminales analíticas que proyectan tendencias y detectan anomalías en el flujo de datos.', x: 9, y: 10, w: 6, h: 5, color: 'bg-orange-500/5', border: 'border-orange-200/50', text: 'text-orange-600', icon: BarChart3 },
  { id: 'vault', name: 'El Depósito de Activos', description: 'The Vault. Entorno de estanterías infinitas de datos donde se recolectan y clasifican los insumos brutos.', x: 16, y: 11, w: 4, h: 4, color: 'bg-amber-600/5', border: 'border-amber-300/50', text: 'text-amber-800', icon: Database },
];

const WORK_AREA = { x: 4, y: 1, width: 2, height: 2 }; // Nested in Logic Engine
const STORAGE_AREA = { x: 17, y: 12, width: 2, height: 2 }; // Nested in Vault
const BREAK_AREA = { x: 16, y: 0, width: 4, height: 4 }; // Bistro
const VISION_AREA = { x: 0, y: 5, width: 4, height: 4 }; // Optic Studio
const AUDIO_AREA = { x: 8, y: 5, width: 4, height: 4 }; // Sonic Lab

const getTaskDepartment = (taskTitle: string, taskDesc: string = ""): string => {
  const text = (taskTitle + " " + taskDesc).toLowerCase();
  
  if (text.includes('audio') || text.includes('voz') || text.includes('sonido') || text.includes('mic')) return 'sonic';
  if (text.includes('imagen') || text.includes('foto') || text.includes('video') || text.includes('diseño') || text.includes('optic')) return 'optic';
  if (text.includes('code') || text.includes('program') || text.includes('bug') || text.includes('script') || text.includes('logic')) return 'logic';
  if (text.includes('search') || text.includes('buscar') || text.includes('investigar') || text.includes('oracle')) return 'oracle';
  if (text.includes('insight') || text.includes('analizar') || text.includes('stats') || text.includes('estadística')) return 'insight';
  if (text.includes('creative') || text.includes('escribir') || text.includes('write') || text.includes('content') || text.includes('forge')) return 'forge';
  if (text.includes('book') || text.includes('library') || text.includes('archivo') || text.includes('bibliosfera')) return 'archive';
  if (text.includes('send') || text.includes('mail') || text.includes('dispatch') || text.includes('correo')) return 'dispatch';
  if (text.includes('vault') || text.includes('depósito') || text.includes('storage')) return 'vault';
  
  return 'logic'; // Default to Logic Engine
};

const getDepartmentArea = (deptId: string) => {
  const area = OFFICE_AREAS.find(a => a.id === deptId) || OFFICE_AREAS[1];
  return { 
    x: area.x + 1, 
    y: area.y + 1, 
    width: area.w - 2, 
    height: area.h - 2 
  };
};

const TASK_WALK_STEP = 0.4; // cells per tick (500 ms) while acting out a task
const IDLE_WALK_STEP = 0.1;

const areaCenter = (id: string) => {
  const a = OFFICE_AREAS.find(x => x.id === id)!;
  return { x: a.x + a.w / 2 - 0.5, y: a.y + a.h / 2 - 0.5 };
};

const FURNITURE: Furniture[] = [
  { id: 'f1', name: 'Coffee Machine', x: 18, y: 1, icon: Coffee, type: 'coffee' },
  { id: 'f2', name: 'Server Rack', x: 5, y: 1, icon: Cpu, type: 'server' },
  { id: 'f3', name: 'Main Terminal', x: 10, y: 1, icon: Terminal, type: 'terminal' },
  { id: 'f4', name: 'Drafting Table', x: 1, y: 12, icon: ClipboardCheck, type: 'table' },
  { id: 'f5', name: 'Digital Canvas', x: 1, y: 7, icon: Layers, type: 'canvas' },
  { id: 'f6', name: 'Office Printer', x: 17, y: 6, icon: Download, type: 'printer' },
  { id: 'f7', name: 'Archive Monitor', x: 1, y: 1, icon: Monitor, type: 'monitor' },
];

// Where an avatar stands for each scene. A small per-avatar offset keeps several
// avatars at the same station from stacking on one tile.
const stationPosition = (station: Station, task: Task | undefined, c: Citizen, slot: number) => {
  const jitter = { x: (slot % 3) * 0.6 - 0.6, y: Math.floor(slot / 3) * 0.6 };
  if (station === 'here') return { x: c.x, y: c.y };
  if (station === 'department') {
    const deptId = task ? getTaskDepartment(task.title, task.description) : 'logic';
    const furniture =
      deptId === 'optic' ? FURNITURE.find(f => f.type === 'canvas') :
      deptId === 'sonic' ? FURNITURE.find(f => f.type === 'server') :
      deptId === 'logic' ? FURNITURE.find(f => f.type === 'terminal') :
      deptId === 'archive' ? FURNITURE.find(f => f.type === 'monitor') : undefined;
    if (furniture) return { x: furniture.x + jitter.x, y: furniture.y + 1 + jitter.y };
    const d = getDepartmentArea(deptId);
    return { x: d.x + d.width / 2 + jitter.x, y: d.y + d.height / 2 + jitter.y };
  }
  if (station === 'storage') return { x: STORAGE_AREA.x + STORAGE_AREA.width / 2, y: STORAGE_AREA.y + STORAGE_AREA.height / 2 };
  const center = areaCenter(station === 'qa' ? 'qa' : 'dispatch');
  return { x: center.x + jitter.x, y: center.y + jitter.y };
};

const moveCitizen = (c: Citizen, stepSize: number) => {
  if (c.x === c.targetX && c.y === c.targetY) return;
  const dx = c.targetX - c.x;
  const dy = c.targetY - c.y;
  c.x = Math.abs(dx) <= stepSize ? c.targetX : c.x + Math.sign(dx) * stepSize;
  c.y = Math.abs(dy) <= stepSize ? c.targetY : c.y + Math.sign(dy) * stepSize;
  if (c.x === c.targetX && c.y === c.targetY && c.currentAction === 'walking') c.currentAction = 'idle';
};

const releaseFromTask = (c: Citizen) => {
  c.currentTaskId = undefined;
  c.isAssignedWork = false;
  c.playhead = undefined;
  c.sceneLabel = undefined;
  c.hasProduct = false;
  c.workProgress = 0;
  c.currentAction = 'idle';
};

const CHAT_PROXIMITY = 1.2; // Distance to trigger chat
const CHAT_DURATION = 50; // Ticks (approx 5 seconds at 100ms interval)
const DISCUSSION_PROXIMITY = 1.5;
const DISCUSSION_DURATION = 80;

export const Miniverse: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [viewingTaskResult, setViewingTaskResult] = useState<Task | null>(null);
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [worldTheme] = useState('Cozy Startup Office');
  const [showQuickstart, setShowQuickstart] = useState(false);
  const [showVisionModal, setShowVisionModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'citizens' | 'tasks' | 'archive'>('citizens');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isRefiningTask, setIsRefiningTask] = useState(false);
  const [isUpdatingOffice, setIsUpdatingOffice] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isAnalyzingAudio, setIsAnalyzingAudio] = useState(false);
  const [audioSummary, setAudioSummary] = useState('');
  const [audioError, setAudioError] = useState('');
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<'fast' | 'thinking'>('fast');
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatbotInput, setChatbotInput] = useState('');
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [groupChannelInput, setGroupChannelInput] = useState('');
  const [isSendingGroupMessage, setIsSendingGroupMessage] = useState(false);
  const [groupChannelError, setGroupChannelError] = useState<string | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [serverTime, setServerTime] = useState<number>(new Date().getHours()); // 0-23
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
  
  // Refs for simulation loop to avoid stale closures
  const tasksRef = useRef<Task[]>([]);
  // Choreography: results finished while this page is open are replayed once each.
  const playedRef = useRef<Set<string>>(new Set());
  const sessionStartRef = useRef<number>(Date.now());
  const officeRef = useRef<Office | null>(null);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    officeRef.current = currentOffice;
  }, [currentOffice]);

  // Day/Night Cycle Update
  useEffect(() => {
    const timer = setInterval(() => {
      setServerTime(new Date().getHours());
    }, 60000); // Check every minute
    return () => clearInterval(timer);
  }, []);

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
      console.error('Error uploading knowledge file:', error);
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
      console.error('Error adding external knowledge:', error);
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    if (currentOffice?.status === 'closed') return;
    setAnalyzingImage(true);
    setAnalysisResult(null);
    try {
      const { text } = await engine.analyzeImage(base64Image);
      setAnalysisResult(text || "No analysis could be generated.");
    } catch (error) {
      console.error("Image Analysis Error:", error);
      setAnalysisResult(`Error: ${error instanceof Error ? error.message : 'No se pudo analizar la imagen.'}`);
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
      console.error('Error sending agent message:', error);
    }
  };

  const handleBroadcastMessage = async (message: string) => {
    if (!currentOffice || !currentUser || currentOffice.status === 'closed') {
      setGroupChannelError('Office is closed or you are not authenticated');
      return;
    }

    if (!message.trim()) return;
 
    setIsSendingGroupMessage(true);
    setGroupChannelError(null);
    console.log(`[Chat] User "${currentUser.displayName}" sending message: "${message}"`);

    // 1. Add user message to Firestore
    const userMsg = {
      officeId: currentOffice.id,
      senderId: currentUser.uid,
      senderName: currentUser.displayName || 'Admin',
      message: message.trim(),
      timestamp: Date.now(),
      type: 'public' as const,
      ownerId: currentUser.uid
    };

    try {
      await addDoc(collection(db, 'messages'), userMsg);
      console.log(`[Chat] User message saved to Firestore.`);
    } catch (error: any) {
      console.error('[Chat] Error sending message:', error);
      setGroupChannelError(error.message || 'Failed to send message.');
      setIsSendingGroupMessage(false);
      return;
    }

    // 2. Trigger agent responses based on AI Mode & Mentions
    console.log(`[Chat] Checking for responders among ${citizens.length} citizens...`);
    if (citizens.length > 0) {
      // Check for mentions @Name
      const mentionedAgent = citizens.find(c => message.toLowerCase().includes(`@${c.name.toLowerCase()}`));

      // One reply: the mentioned worker, or the engine picks the office's first worker.
      // The engine also decides whether the message asks for a deliverable and, if so,
      // creates the task itself — keyword matching here missed "apóyame con…" and the
      // worker promised work that never ran.
      engine.chatRespond(currentOffice.id, message.trim(), mentionedAgent?.id, aiMode === 'thinking')
        .catch((error: Error) => {
          console.error('[Chat] Engine error:', error);
          setGroupChannelError(error.message || 'El worker no pudo responder.');
        });
    }
    
    // We keep this here to allow the user to send the next message immediately
    setIsSendingGroupMessage(false);
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
    });

    const messagesQuery = query(
      collection(db, 'messages'),
      where('officeId', '==', currentOffice.id),
      orderBy('timestamp', 'desc'),
      limit(20)
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
    });

    const knowledgeQuery = query(
      collection(db, 'knowledge'),
      where('officeId', '==', currentOffice.id),
      where('ownerId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribeKnowledge = onSnapshot(knowledgeQuery, (snapshot) => {
      const knowledgeData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Knowledge));
      setKnowledge(knowledgeData);
    }, (error: any) => {
      console.error("Firestore Knowledge Subscription Error:", error);
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
      console.error('Error adding knowledge:', error);
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'knowledge', id));
    } catch (error: any) {
      console.error('Error deleting knowledge:', error);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (currentOffice?.status === 'closed') return;
      setCitizens(prev => {
        if (prev.length === 0) return prev;

        const next = prev.map(c => ({ ...c }));

        for (let i = 0; i < next.length; i++) {
          const c = next[i];

          // ── Task choreography ─────────────────────────────────────────────────
          // The engine claims and runs tasks; the avatar acts out the task's phaseLog
          // (lib/choreography.ts) and never writes task state itself.
          const now = Date.now();
          const allTasks = tasksRef.current || [];
          if (!c.currentTaskId) {
            const pick = pickTaskToPlay(allTasks, c.id, playedRef.current, sessionStartRef.current);
            if (pick) {
              const beats = scriptFor(pick);
              // An old pending approval: go straight to waiting instead of replaying the past.
              const startAt = isAwaitingApproval(pick) && Date.parse(pick.phaseAt || '') < sessionStartRef.current
                ? beats.length - 1 : 0;
              c.currentTaskId = pick.id;
              c.isAssignedWork = true;
              c.playhead = { beatIndex: startAt };
              c.chatTimer = 0;
              c.chattingWith = undefined;
              c.isDiscussing = false;
            }
          }
          if (c.currentTaskId) {
            const t = allTasks.find(x => x.id === c.currentTaskId);
            if (!t || t.assignedTo !== c.id) {
              releaseFromTask(c);
            } else {
              // Waiting for approval must not hide new live work from this avatar.
              if (isAwaitingApproval(t) && !isLive(t)) {
                const live = allTasks.find(x => x.assignedTo === c.id && isLive(x));
                if (live) {
                  c.currentTaskId = live.id;
                  c.playhead = { beatIndex: 0 };
                }
              }
              const current = allTasks.find(x => x.id === c.currentTaskId)!;
              const beats = scriptFor(current);
              const idx = Math.min(c.playhead?.beatIndex ?? 0, beats.length - 1);
              const slot = i;
              const here = stationPosition(SCENES[beats[idx].phase as keyof typeof SCENES]?.station ?? 'here', current, c, slot);
              const arrived = Math.hypot(c.x - here.x, c.y - here.y) < 0.5;
              const result = step(current, c.playhead ?? { beatIndex: 0 }, arrived, now);
              if (result.kind === 'finished') {
                playedRef.current.add(current.id);
                releaseFromTask(c);
              } else {
                c.playhead = result.playhead;
                c.sceneLabel = result.scene.label;
                c.workProgress = result.scene.progress;
                c.hasProduct = result.beat.phase === 'done';
                const target = stationPosition(result.scene.station, current, c, slot);
                if (Math.hypot(c.x - target.x, c.y - target.y) >= 0.5) {
                  c.targetX = target.x;
                  c.targetY = target.y;
                  c.currentAction = 'walking';
                } else {
                  c.targetX = c.x;
                  c.targetY = c.y;
                  c.currentAction = result.scene.action;
                }
              }
              moveCitizen(c, TASK_WALK_STEP);
              continue;
            }
          }

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

          {
            // Collaboration Logic (Agent-Agent Discussion)
            if (Math.random() < 0.03 && !c.isDiscussing) {
              const otherAgent = next.find((other, idx) => idx !== i && other.currentAction === 'idle' && !other.isAssignedWork && !other.isDiscussing);
              if (otherAgent) {
                 const dist = Math.sqrt(Math.pow(c.x - otherAgent.x, 2) + Math.pow(c.y - otherAgent.y, 2));
                 if (dist < DISCUSSION_PROXIMITY) {
                   c.currentAction = 'discussing';
                   c.isDiscussing = true;
                   c.discussionWith = otherAgent.id;
                   c.chatTimer = DISCUSSION_DURATION;

                   otherAgent.currentAction = 'discussing';
                   otherAgent.isDiscussing = true;
                   otherAgent.discussionWith = c.id;
                   otherAgent.chatTimer = DISCUSSION_DURATION;
                 }
              }
            }

            if (c.currentAction === 'discussing') {
              if (c.chatTimer && c.chatTimer > 0) {
                c.chatTimer--;
                continue;
              } else {
                c.currentAction = 'idle';
                c.isDiscussing = false;
                c.discussionWith = undefined;
              }
            }
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
                // Idle fidgets only: "Analizando/Procesando" are reserved for real task phases.
                c.currentAction = Math.random() > 0.5 ? 'looking_around' : 'stretching';
                c.idleActionTimer = 10;
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
          moveCitizen(c, IDLE_WALK_STEP);
        }

        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // Assigning only records intent in Firestore; vo101-engine claims and runs the task.
  const assignWork = async (citizenId: string, taskId: string) => {
    if (currentOffice?.status === 'closed') {
      alert("Office is closed. Tasks cannot be assigned.");
      return;
    }
    try {
      await updateDoc(doc(db, 'tasks', taskId), { ...REQUEUE_FIELDS, assignedTo: citizenId });
    } catch (error: any) {
      console.error("Error assigning task:", error);
    }
  };

  // Re-run a task: back to the engine's queue with a clean retry budget.
  const requeueTask = async (task: Task) => {
    try {
      await requeueTaskDoc(task.id, !task.assignedTo);
      setViewingTaskResult(null);
    } catch (error: any) {
      console.error("Error re-queueing task:", error);
    }
  };

  const handleCreateTask = async (taskData: Partial<Task>) => {
    try {
      await addDoc(collection(db, 'tasks'), {
        ...taskData,
        status: 'todo',
        autoAssign: !taskData.assignedTo,
        createdAt: new Date().toISOString(),
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

  const handleRefineTask = async () => {
    if (!newTaskTitle.trim() || isRefiningTask || !currentOffice || !currentUser) return;
    setIsRefiningTask(true);
    let title = newTaskTitle.trim();
    let description = '';
    try {
      const refined = await engine.refineTask(title);
      title = refined.title || title;
      description = refined.description || '';
    } catch (e) {
      console.error("Refinement error (creating task as typed):", e);
    }
    await handleCreateTask({ title, description, officeId: currentOffice.id, ownerId: currentUser.uid });
    setNewTaskTitle('');
    setSidebarTab('tasks');
    setIsRefiningTask(false);
  };

  const restoreTaskToSimulation = async (taskId: string) => {
    try {
      const taskRef = doc(db, 'tasks', taskId);
      await updateDoc(taskRef, {
        status: 'done',
        collected: false
      });
      console.log(`[Archive] Task ${taskId} restored to simulation.`);
    } catch (error) {
      console.error("[Archive] Error restoring task:", error);
    }
  };

  const deleteTaskFromArchive = async (taskId: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este archivo permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      console.log(`[Archive] Task ${taskId} deleted.`);
    } catch (error) {
      console.error("[Archive] Error deleting task:", error);
    }
  };

  const toggleOfficeStatus = async () => {
    if (!currentOffice || isUpdatingOffice) return;
    setIsUpdatingOffice(true);
    try {
      const newStatus = currentOffice.status === 'closed' ? 'open' : 'closed';
      await updateDoc(doc(db, 'offices', currentOffice.id), { status: newStatus });
    } catch (error) {
      console.error("Toggle Office Error:", error);
    } finally {
      setIsUpdatingOffice(false);
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
      const history = [...chatbotMessages, { role: 'user' as const, text: userMsg }].slice(-20);
      const { text } = await engine.askAssistant(history, true);
      if (text) {
        setChatbotMessages(prev => [...prev, { role: 'ai', text }]);
      }
    } catch (error) {
      console.error("Chatbot Error:", error);
      const detail = error instanceof Error ? error.message : 'Intenta de nuevo.';
      setChatbotMessages(prev => [...prev, { role: 'ai', text: `No pude responder: ${detail}` }]);
    } finally {
      setIsChatbotLoading(false);
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
      
      const { text } = await engine.analyzeAudio(base64Data, audioFile.type || 'audio/mpeg');
      if (text) {
        setAudioSummary(text);
      } else {
        setAudioError('No summary generated.');
      }
    } catch (err: any) {
      console.error('Error analyzing audio:', err);
      setAudioError(err?.message || 'No se pudo analizar el audio.');
    } finally {
      setIsAnalyzingAudio(false);
    }
  };

  if (!currentOffice) {
    return <div className="p-8 text-center text-slate-500">Select an office to enter the Virtual Office.</div>;
  }

  // The result modal follows the live task, so approval and revisions show up as they happen.
  const liveViewing = viewingTaskResult ? (tasks.find(t => t.id === viewingTaskResult.id) ?? viewingTaskResult) : null;

  const handleApprove = async (task: Task) => {
    setIsSubmittingApproval(true);
    try {
      await approveTask(task.id);
    } catch (e) {
      alert(`No se pudo aprobar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleRequestChanges = async (task: Task) => {
    if (!changeNotes.trim()) return;
    setIsSubmittingApproval(true);
    try {
      await requestChanges(task.id, changeNotes);
      setChangeNotes('');
    } catch (e) {
      alert(`No se pudo enviar: ${e instanceof Error ? e.message : 'error'}`);
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const hour = serverTime;
  const isNight = hour >= 20 || hour <= 6;
  const isDusk = hour === 18 || hour === 19;

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
        <div className="flex gap-4 items-center">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={toggleOfficeStatus}
              disabled={isUpdatingOffice}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                currentOffice.status !== 'closed' 
                  ? 'bg-emerald-500 text-white shadow-md' 
                  : 'text-slate-500 hover:bg-slate-200'
              }`}
            >
              <Hand className="w-3 h-3" />
              {currentOffice.status !== 'closed' ? 'OFFICE OPEN' : 'OFFICE CLOSED'}
            </button>
          </div>
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
 
      {/* Dynamic HUD & Environment Wrapper */}
      <div className="flex-1 flex gap-6 overflow-hidden relative">
        {/* Holographic Stats Console */}
        <div className="absolute top-4 left-4 z-50 pointer-events-none flex flex-col gap-2">
          <div className="bg-slate-900/40 backdrop-blur-md border border-cyan-500/30 p-2 rounded-xl text-[8px] font-mono text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)] animate-pulse">
            <div className="flex justify-between gap-4 mb-1">
              <span>SYSTEM_UPTIME:</span>
              <span>{Math.floor(Date.now() / 100000) % 9999}s</span>
            </div>
            <div className="flex justify-between gap-4 mb-1">
              <span>COG_LOAD:</span>
              <span>{(citizens.length * 12.4).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>MEMORY:</span>
              <span>{(1.2 + Math.random() * 0.5).toFixed(2)}GB</span>
            </div>
          </div>
          <div className="bg-indigo-900/40 backdrop-blur-md border border-indigo-400/30 p-2 rounded-xl text-[8px] font-mono text-indigo-300 shadow-[0_0_15px_rgba(129,140,248,0.2)]">
            <div className="flex items-center gap-2">
               <div className={`w-1.5 h-1.5 rounded-full ${isNight ? 'bg-indigo-400 shadow-[0_0_5px_#818cf8]' : 'bg-amber-400 shadow-[0_0_5px_#fbbf24]'} animate-pulse`} />
               <span>ENV_MODE: {isNight ? 'NIGHT_PROTOCOL' : isDusk ? 'DUSK_TRANSITION' : 'DAY_PROTO'}</span>
            </div>
          </div>
        </div>


        {/* World View */}
        <div className="flex-1 relative flex items-center justify-center" ref={worldContainerRef}>
          <div 
            className="relative bg-slate-200 rounded-3xl overflow-hidden shadow-inner border-8 border-slate-800"
            style={{ 
              width: WORLD_WIDTH * gridSize + 16,
              height: WORLD_HEIGHT * gridSize + 16,
              backgroundImage: `
                linear-gradient(to right, ${serverTime >= 20 || serverTime <= 6 ? '#1e293b' : '#e2e8f0'} 1px, transparent 1px),
                linear-gradient(to bottom, ${serverTime >= 20 || serverTime <= 6 ? '#1e293b' : '#e2e8f0'} 1px, transparent 1px),
                radial-gradient(circle, ${serverTime >= 20 || serverTime <= 6 ? '#334155' : '#cbd5e1'} 1px, transparent 1px)
              `,
              backgroundSize: `${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px, ${gridSize}px ${gridSize}px`,
              backgroundColor: serverTime >= 20 || serverTime <= 6 ? '#0f172a' : '#f8fafc',
              transition: 'all 2s ease-in-out'
            }}
          >
            {/* Night-time Color Grading Overlay */}
            {(serverTime >= 20 || serverTime <= 6) && (
              <div className="absolute inset-0 z-40 bg-indigo-950/30 mix-blend-multiply pointer-events-none" />
            )}
            {(serverTime === 18 || serverTime === 19) && (
              <div className="absolute inset-0 z-40 bg-amber-900/20 mix-blend-overlay pointer-events-none" />
            )}

             {OFFICE_AREAS.map(area => {
              return (
                <div
                  key={area.id}
                  style={{
                    position: 'absolute',
                    left: area.x * gridSize,
                    top: area.y * gridSize,
                    width: area.w * gridSize,
                    height: area.h * gridSize,
                  }}
                  className={`border border-white/20 ${area.color} rounded-2xl flex flex-col items-center justify-center group overflow-hidden transition-all duration-500 pointer-events-none backdrop-blur-[1px] hover:backdrop-blur-[4px] hover:shadow-2xl hover:shadow-${area.text.split('-')[1]}-500/20`}
                >
                  {/* Background Aura */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 bg-gradient-to-br from-white via-transparent to-black`} />
                  
                  <div className="relative z-10 flex flex-col items-center justify-center p-2 text-center">
                    <area.icon className={`w-8 h-8 mb-2 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${area.text} opacity-20 group-hover:opacity-100`} />
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${area.text} opacity-30 group-hover:opacity-100 transition-all duration-500 leading-tight`}>
                      {area.name}
                    </span>
                    <p className="text-[7px] text-slate-500 font-medium leading-relaxed mt-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500 max-w-[80%] mx-auto">
                      {area.description}
                    </p>
                  </div>
                  
                  {/* Corner Accents */}
                  <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${area.border} opacity-0 group-hover:opacity-40 transition-opacity`} />
                  <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${area.border} opacity-0 group-hover:opacity-40 transition-opacity`} />
                  
                  {/* Interaction Overlays */}
                  <div className="absolute inset-0 pointer-events-auto flex items-center justify-center cursor-default z-20">
                    {area.id === 'vault' && (
                      <button 
                        className="w-full h-full cursor-pointer opacity-0"
                        onClick={() => setShowStorageModal(true)}
                        aria-label="Open Storage"
                      />
                    )}
                    {area.id === 'optic' && (
                      <button 
                        className="w-full h-full cursor-pointer opacity-0"
                        onClick={() => setShowVisionModal(true)}
                        aria-label="Open Vision Lab"
                      />
                    )}
                    {area.id === 'sonic' && (
                      <button 
                        className="w-full h-full cursor-pointer opacity-0"
                        onClick={() => setShowAudioModal(true)}
                        aria-label="Open Audio Lab"
                      />
                    )}
                  </div>
 
                  {/* Vault Item Counter */}
                  {area.id === 'vault' && tasks.filter(t => t.status === 'done' && !t.collected).length > 0 && (
                    <div className="absolute top-3 right-3 pointer-events-none z-30">
                       <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-1 rounded-lg animate-bounce shadow-xl flex items-center gap-1">
                        <Package className="w-2 h-2" />
                        {tasks.filter(t => t.status === 'done' && !t.collected).length}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

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
                    transition: 'left 0.5s linear, top 0.5s linear',
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
                    {citizen.currentAction === 'reviewing' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -22 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-yellow-400 text-white rounded-full p-1.5 shadow-lg border-2 border-white"
                      >
                        <ShieldCheck className="w-3 h-3" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'waiting_approval' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [1, 1.15, 1], y: -24 }}
                        transition={{ scale: { repeat: Infinity, duration: 1.4 } }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white rounded-full p-1.5 shadow-lg border-2 border-white"
                      >
                        <Hourglass className="w-3 h-3" />
                      </motion.div>
                    )}
                    {citizen.currentAction === 'error' && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1, y: -22 }}
                        exit={{ opacity: 0, scale: 0 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white rounded-full p-1.5 shadow-lg border-2 border-white"
                      >
                        <AlertCircle className="w-3 h-3" />
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
                    {citizen.isAssignedWork && citizen.currentTaskId && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-slate-900/80 text-white text-[7px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg whitespace-nowrap max-w-[120px]"
                      >
                        <Sparkles className="w-2 h-2 animate-pulse shrink-0" />
                        <span className="truncate">{tasks.find(t => t.id === citizen.currentTaskId)?.title}</span>
                      </motion.div>
                    )}
                    <div className={`px-1.5 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-tighter shadow-sm border ${
                      citizen.currentAction === 'reviewing' ? 'bg-yellow-400 text-white border-yellow-300' :
                      citizen.currentAction === 'waiting_approval' ? 'bg-amber-500 text-white border-amber-400 animate-pulse' :
                      citizen.currentAction === 'delivering' ? 'bg-amber-600 text-white border-amber-500' :
                      citizen.currentAction === 'error' ? 'bg-rose-500 text-white border-rose-400' :
                      citizen.currentAction === 'working' ? 'bg-emerald-500 text-white border-emerald-400' :
                      citizen.currentAction === 'thinking' ? 'bg-indigo-500 text-white border-indigo-400' :
                      citizen.currentAction === 'walking' ? 'bg-slate-700 text-white border-slate-600' :
                      ['looking_around', 'stretching', 'interacting'].includes(citizen.currentAction) ? 'bg-amber-400 text-white border-amber-300' :
                      'bg-white text-slate-400 border-slate-100'
                    }`}>
                      {citizen.sceneLabel && citizen.currentAction !== 'walking' ? citizen.sceneLabel :
                       citizen.sceneLabel ? `→ ${citizen.sceneLabel}` :
                       citizen.currentAction === 'working' ? 'Procesando' :  
                       citizen.currentAction === 'thinking' ? 'Analizando' : 
                       ['idle', 'looking_around', 'stretching', 'interacting'].includes(citizen.currentAction) ? 'En espera' : 
                       ({ walking: 'Caminando', chatting: 'Charlando', discussing: 'Conversando',
                          delivering: 'Entregando', error: 'Error' } as Record<string, string>)[citizen.currentAction]
                         ?? citizen.currentAction.replace('_', ' ')}
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
                        citizen.currentAction === 'reviewing' ? {
                          rotate: [0, -8, 0, 8, 0]
                        } :
                        citizen.currentAction === 'waiting_approval' ? {
                          y: [0, -3, 0]
                        } :
                        citizen.currentAction === 'working' ? {
                          y: [0, -1, 0]
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

            {/* Simulation Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 h-10 bg-slate-900/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl flex items-center justify-between px-4 z-40">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                  <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">System Live</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[7px] text-white/30 uppercase font-bold leading-none">Neural Sync</span>
                    <span className="text-[10px] text-white font-mono">98.4%</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-white/30 uppercase font-bold leading-none">Agents</span>
                    <span className="text-[10px] text-white font-mono">{citizens.length}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] text-white/30 uppercase font-bold leading-none">Power</span>
                    <span className="text-[10px] text-indigo-400 font-mono">Optimized</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex -space-x-2">
                  {citizens.map((citizen, i) => (
                    <div 
                      key={citizen.id} 
                      className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden"
                      title={citizen.name}
                    >
                      <User className="w-3 h-3 text-white/50" />
                    </div>
                  ))}
                </div>
                <div className="text-[9px] font-bold text-white/40 italic">
                  Neural Headquarters v2.1.0
                </div>
              </div>
            </div>
          </div>

        {/* Sidebar Info */}
        <div className="w-80 flex flex-col gap-4 overflow-hidden h-full">
          {/* Mission Control Sidebar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 overflow-hidden">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setSidebarTab('citizens')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                  sidebarTab === 'citizens' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Citizens
              </button>
              <button 
                onClick={() => setSidebarTab('tasks')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                  sidebarTab === 'tasks' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" />
                Missions
              </button>
              <button 
                onClick={() => setSidebarTab('archive')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${
                  sidebarTab === 'archive' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                Archivo
              </button>
            </div>

            {sidebarTab === 'citizens' ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                {citizens.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCitizen(c)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-all border ${
                      selectedCitizen?.id === c.id ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shadow-sm relative">
                        <User className="w-3.5 h-3.5 text-slate-600" />
                        <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                          c.currentAction === 'idle' ? 'bg-slate-300' : 
                          c.currentAction === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} />
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className="text-[10px] font-bold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[8px] text-slate-500 capitalize leading-none">{c.currentAction || 'idle'}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {citizens.length === 0 && (
                  <p className="text-[9px] text-slate-400 italic text-center py-4">No agents active</p>
                )}
              </div>
            ) : sidebarTab === 'tasks' ? (
              <div className="space-y-4">
                {/* Task Creation */}
                <div className="space-y-2">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Enter mission title..."
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRefineTask()}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[10px] outline-none focus:border-indigo-500 pr-10"
                    />
                    <button 
                      onClick={handleRefineTask}
                      disabled={isRefiningTask || !newTaskTitle.trim()}
                      className="absolute right-2 top-1.5 p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30"
                    >
                      {isRefiningTask ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Missions List */}
                <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                  {tasks.filter(t => t.status !== 'archived').sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(t => (
                    <div key={t.id} className="p-2.5 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="text-[9px] font-bold text-slate-800 line-clamp-1">{t.title}</h4>
                        <span className={`text-[7px] font-black uppercase px-1 py-0.5 rounded ${
                          t.status === 'done' ? 'bg-emerald-100 text-emerald-600' :
                          t.status === 'in-progress' ? 'bg-indigo-100 text-indigo-600' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[7px] text-slate-400">
                          {t.assignedTo ? (citizens.find(c => c.id === t.assignedTo)?.name || 'Agent') : 'Unassigned'}
                        </span>
                        {t.status === 'done' && (
                          <button onClick={() => setViewingTaskResult(t)} className="text-indigo-600 hover:underline text-[7px] font-bold">VIEW RESULT</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status !== 'archived').length === 0 && (
                    <p className="text-[9px] text-slate-400 italic text-center py-4">No active missions</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Archive className="w-3 h-3" />
                    Vault Assets
                   </h3>
                   <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 rounded-full">
                    {tasks.filter(t => t.status === 'archived' || (t.status === 'done' && t.collected)).length}
                   </span>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                  {tasks.filter(t => t.status === 'archived' || (t.status === 'done' && t.collected)).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).map(t => (
                    <div key={t.id} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="text-[9px] font-bold text-slate-800 line-clamp-1">{t.title}</h4>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex gap-1.5">
                           <button 
                             onClick={() => setViewingTaskResult(t)}
                             className="text-[8px] font-bold text-indigo-600 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                           >
                             VIEW
                           </button>
                           <button 
                             onClick={async () => {
                               try {
                                 await updateDoc(doc(db, 'tasks', t.id), { status: 'done', collected: false });
                               } catch (err) {
                                 console.error("Restore Task Error:", err);
                               }
                             }}
                             className="text-[8px] font-bold text-emerald-600 hover:bg-emerald-50 px-1.5 py-0.5 rounded transition-colors"
                           >
                             RESTORE
                           </button>
                        </div>
                        <button 
                          onClick={async () => {
                            if (window.confirm('Delete this asset permanently?')) {
                              try {
                                await deleteDoc(doc(db, 'tasks', t.id));
                              } catch (err) {
                                console.error("Delete Task Error:", err);
                              }
                            }
                          }}
                          className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {tasks.filter(t => t.status === 'archived' || (t.status === 'done' && t.collected)).length === 0 && (
                    <div className="text-center py-8">
                       <Archive className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                       <p className="text-[9px] text-slate-400 italic">Vault is empty</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Group Chat */}
          <div className="bg-slate-900 p-4 rounded-2xl shadow-xl flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <MessageSquare className="w-4 h-4" />
                <h2 className="text-xs font-bold uppercase tracking-widest">Group Channel</h2>
              </div>
              <div className="flex items-center gap-2">
              </div>
            </div>

            {/* AI Mode Selector */}
            <div className="flex gap-1 mb-3 bg-slate-800 p-1 rounded-lg">
              {[
                { id: 'fast', icon: <Zap className="w-3 h-3" />, label: 'Fast' },
                { id: 'thinking', icon: <Brain className="w-3 h-3" />, label: 'Think' }
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
              {groupMessages.map((msg) => (
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
            {groupChannelError && (
              <div className="mb-2 p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-[10px] text-red-300">
                {groupChannelError}
              </div>
            )}
            <div className="flex gap-2">
              <input 
                type="text" 
                value={groupChannelInput}
                onChange={(e) => setGroupChannelInput(e.target.value)}
                placeholder={currentOffice?.status === 'closed' ? 'Office is closed' : aiMode === 'thinking' ? "Ask complex questions..." : "Broadcast message..."}
                disabled={isSendingGroupMessage || currentOffice?.status === 'closed'}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-white outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && groupChannelInput.trim() && !isSendingGroupMessage) {
                    handleBroadcastMessage(groupChannelInput.trim());
                    setGroupChannelInput('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (groupChannelInput.trim()) {
                    handleBroadcastMessage(groupChannelInput.trim());
                    setGroupChannelInput('');
                  }
                }}
                disabled={!groupChannelInput.trim() || isSendingGroupMessage || currentOffice?.status === 'closed'}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 min-w-[70px] justify-center"
              >
                {isSendingGroupMessage ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3 h-3" />
                    Send
                  </>
                )}
              </button>
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
                    {(selectedCitizen?.messages || []).filter(m => m.type === 'private').map(msg => (
                      <div key={msg.id} className={`text-[9px] p-1.5 rounded-lg ${msg.senderId === selectedCitizen?.id ? 'bg-indigo-100 text-indigo-800' : 'bg-white text-slate-600 border border-slate-100'}`}>
                        <p className="font-bold mb-0.5">{msg.senderName}</p>
                        <p>{msg.message}</p>
                      </div>
                    ))}
                    {(selectedCitizen?.messages || []).length === 0 && (
                      <p className="text-[9px] text-slate-400 italic text-center py-2">No private messages</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between text-slate-500">
                    <span>Action</span>
                    <span className="font-bold text-slate-900 capitalize">{selectedCitizen?.currentAction}</span>
                  </div>
                  {selectedCitizen?.isAssignedWork && (
                    <div className="pt-1">
                      <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 mb-1">
                        <span className="truncate max-w-[100px]">
                          {tasks.find(t => t.id === selectedCitizen.currentTaskId)?.title || 'Task in Progress'}
                        </span>
                      </div>
                      <div className="flex justify-between mb-1 text-slate-500">
                        <span>{selectedCitizen?.sceneLabel || 'Progress'}</span>
                        <span className="font-bold text-indigo-600">{Math.round(selectedCitizen?.workProgress || 0)}%</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedCitizen?.workProgress || 0}%` }}
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
                    <h2 className="text-xl font-bold text-slate-900">{viewingTaskResult?.title}</h2>
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
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-sm text-slate-700 min-h-[200px] max-h-[400px] overflow-y-auto relative leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h2]:font-bold [&_h2]:mt-3 [&_h3]:font-semibold [&_p]:my-2 [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_table]:w-full [&_table]:my-2 [&_table]:text-xs [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_pre]:whitespace-pre-wrap [&_code]:font-mono">
                  {liveViewing && !liveViewing.result && (liveViewing.status === 'todo' || liveViewing.status === 'in-progress') && !liveViewing.failed ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                      <p className="text-xs font-bold text-slate-500 animate-pulse">
                        {liveViewing.status === 'in-progress' ? 'El motor está ejecutando la tarea…' : 'En cola del motor…'}
                      </p>
                    </div>
                  ) : liveViewing?.result ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{liveViewing.result}</Markdown>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                      <Brain className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-slate-400 mb-6">
                        {liveViewing?.failed
                          ? `La tarea falló varias veces: ${liveViewing.lastError || 'error del motor'}`
                          : 'No content generated for this task yet.'}
                      </p>
                      <button
                        onClick={() => liveViewing && requeueTask(liveViewing)}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                      >
                        <Zap className="w-4 h-4" />
                        Generate with AI
                      </button>
                    </div>
                  )}
                </div>
                
                {liveViewing?.review && (
                  <div className={`mt-4 rounded-2xl border p-4 text-xs ${
                    liveViewing.review.verdict === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                    liveViewing.review.verdict === 'changes_requested' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                    'bg-slate-50 border-slate-100 text-slate-600'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      {liveViewing.review.verdict === 'approved' ? 'Revisión: aprobado' :
                       liveViewing.review.verdict === 'changes_requested' ? 'Revisión: encontró problemas' :
                       'Revisión no disponible'}
                      {!!liveViewing.revisions && <span className="font-normal opacity-70">· {liveViewing.revisions} corrección(es)</span>}
                    </div>
                    {liveViewing.review.summary && <p>{liveViewing.review.summary}</p>}
                    {!!liveViewing.review.issues?.length && (
                      <ul className="list-disc ml-5 mt-1 space-y-0.5">
                        {liveViewing.review.issues.map((issue, k) => <li key={k}>{issue}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                {liveViewing?.phase === 'awaiting_approval' && liveViewing.approval === 'pending' && (
                  <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4">
                    <p className="text-xs font-bold text-amber-900 flex items-center gap-2 mb-3">
                      <Hourglass className="w-4 h-4" /> Este entregable espera tu visto bueno
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(liveViewing)}
                        disabled={isSubmittingApproval}
                        className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <ThumbsUp className="w-4 h-4" /> Aprobar
                      </button>
                    </div>
                    <textarea
                      value={changeNotes}
                      onChange={(e) => setChangeNotes(e.target.value)}
                      placeholder="¿Qué hay que cambiar? (el worker corregirá sobre este entregable)"
                      className="mt-3 w-full text-xs rounded-xl border border-amber-200 bg-white p-2 h-16 outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={() => handleRequestChanges(liveViewing)}
                      disabled={isSubmittingApproval || !changeNotes.trim()}
                      className="mt-2 w-full py-2 bg-white border border-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-amber-100 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Pedir cambios
                    </button>
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      if (liveViewing?.result) {
                        copyToClipboard(liveViewing.result);
                      }
                    }}
                    disabled={!liveViewing?.result}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Copy Content
                  </button>
                  <button
                    onClick={() => liveViewing?.result && downloadDeliverablePdf({
                      title: liveViewing.title,
                      body: liveViewing.result,
                      worker: citizens.find(c => c.id === liveViewing.assignedTo)?.name,
                      office: currentOffice?.name,
                      date: (liveViewing.executedAt || liveViewing.createdAt || '').slice(0, 10),
                      model: liveViewing.modelUsed,
                      reviewVerdict: liveViewing.review?.verdict,
                      approvedByUser: liveViewing.approval === 'approved',
                    })}
                    disabled={!liveViewing?.result}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Descargar PDF
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  {liveViewing?.modelUsed ? `Hecho con ${liveViewing.modelUsed}${liveViewing.fellBack ? ' (modelo de respaldo)' : ''}` : 'Processed by Miniverse Agent Intelligence'}
                </p>
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
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{audioFile?.name}</p>
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
                      onClick={() => copyToClipboard('npx create-virtual-office')}
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
                        <p className="text-[10px] text-slate-500 text-center">PDF, DOCX, TXT, MD, CSV (máx. 750KB) · los agentes leen su contenido</p>
                      </div>
                    )}

                    {knowledgeTab === 'drive' && (
                      <div className="space-y-6">
                        <div className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:border-emerald-300 transition-colors group cursor-pointer flex flex-col items-center justify-center text-center" onClick={openPicker}>
                          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-emerald-100 transition-colors">
                            {isDriveLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-600" /> : <HardDrive className="w-6 h-6 text-emerald-500" />}
                          </div>
                          <p className="text-sm font-bold text-slate-900 mb-1">Browse Google Drive</p>
                          <p className="text-[10px] text-slate-500">Guarda un enlace de Drive como referencia (los agentes no lo abren; sube el archivo para que lo lean)</p>
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
                            Guarda el enlace como referencia. Los agentes NO pueden abrir NotebookLM: solo verán el enlace. Para que usen su contenido, exporta tus notas a texto o PDF y súbelas en la pestaña de archivos.
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
