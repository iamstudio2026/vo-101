import { Mic, Upload, FileAudio, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db, handleFirestoreError } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { OperationType } from '../types';

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const AudioAnalyzer: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
      setSummary('');
      setSaved(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const analyzeAudio = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSummary('');

    try {
      const base64Data = await fileToBase64(file);
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type || 'audio/mp3',
              },
            },
            {
              text: 'Summarize this audio and provide insights. Analyze the content, extract key points, and suggest how this information can be useful for the virtual office and its workers.',
            },
          ],
        },
      });

      const text = response.text;
      if (text) {
        setSummary(text);
      } else {
        setError('No summary generated.');
      }
    } catch (err: any) {
      console.error('Error analyzing audio:', err);
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        setError('Quota exceeded for the AI model. Please wait a moment and try again.');
      } else {
        setError('Failed to analyze the audio. Please ensure it is a valid audio file and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveToKnowledge = async () => {
    if (!summary || !currentUser || !currentOffice || !file) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'knowledge'), {
        officeId: currentOffice.id,
        title: `Audio Insight: ${file.name}`,
        content: summary,
        type: 'text',
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ownerId: currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      setSaved(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'knowledge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Audio Analyzer</h1>
        <p className="text-slate-500 mt-1">Upload meeting recordings or voice notes to get AI-generated summaries and insights.</p>
      </header>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-12 bg-slate-50">
          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-indigo-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Upload Audio File</h3>
          <p className="text-slate-500 text-sm mb-6 text-center max-w-md">
            Supported formats: MP3, WAV, M4A. The AI will transcribe, summarize, and extract actionable insights.
          </p>
          
          <label className="cursor-pointer bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Select File
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>

          {file && (
            <div className="mt-6 flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
              <FileAudio className="w-5 h-5 text-indigo-500" />
              <span className="text-sm font-medium text-slate-700">{file.name}</span>
              <span className="text-xs text-slate-400">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={analyzeAudio}
            disabled={!file || loading}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Audio...
              </>
            ) : (
              'Generate Insights'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-8 border border-red-100">
          {error}
        </div>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">✨</span>
              AI Insights & Summary
            </h2>
            <button
              onClick={saveToKnowledge}
              disabled={saving || saved || !currentUser}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                saved 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              } disabled:opacity-50`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : saved ? 'Saved to Knowledge' : 'Save Insights'}
            </button>
          </div>
          <div className="prose prose-slate max-w-none">
            <Markdown>{summary}</Markdown>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
