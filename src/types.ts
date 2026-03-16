export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface Office {
  id: string;
  name: string;
  description?: string;
  status?: 'open' | 'closed';
  ownerId: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  officeId: string;
  name: string;
  role: string;
  skills?: string[];
  responsibilities?: string;
  status?: 'available' | 'busy' | 'offline';
  ownerId: string;
  createdAt: string;
  model?: string;
  isEnabled?: boolean;
}

export interface Task {
  id: string;
  officeId: string;
  title: string;
  description?: string;
  assignedTo?: string;
  status: 'todo' | 'in-progress' | 'done' | 'archived';
  collected?: boolean;
  result?: string;
  flowId?: string;
  flowName?: string;
  isRecurring?: boolean;
  frequency?: 'daily';
  lastCompletedAt?: string;
  ownerId: string;
  createdAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Message {
  id: string;
  officeId: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  type: 'public' | 'private';
  receiverId?: string;
  ownerId: string;
  isAi?: boolean;
  isThinking?: boolean;
  groundingUrls?: string[];
  audioUrl?: string;
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  aspectRatio: AspectRatio;
  ownerId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: number;
  type: 'public' | 'private';
  receiverId?: string;
}

export interface Citizen extends Worker {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  currentAction: 'idle' | 'working' | 'thinking' | 'walking' | 'error' | 'chatting' | 'delivering' | 'looking_around' | 'stretching' | 'interacting';
  chattingWith?: string;
  chatTimer?: number;
  idleActionTimer?: number;
  hasProduct?: boolean;
  workProgress?: number;
  isAssignedWork?: boolean;
  currentTaskId?: string;
  messages: ChatMessage[];
}

export interface Knowledge {
  id: string;
  officeId: string;
  title: string;
  content: string;
  type: 'text' | 'file' | 'link' | 'drive' | 'notebooklm';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  externalUrl?: string;
  ownerId: string;
  createdAt: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
