import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { Task, Worker, OperationType } from '../types';
import { CheckSquare, Plus, Trash2, Clock, CheckCircle2, Circle, Sparkles, Loader2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const Tasks: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [flowPrompt, setFlowPrompt] = useState('');
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily'>('daily');

  useEffect(() => {
    if (!currentUser || !currentOffice) {
      setTasks([]);
      setWorkers([]);
      return;
    }

    const qTasks = query(
      collection(db, 'tasks'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const fetchedTasks = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Task));
      
      // Auto-reset daily tasks if they were completed on a previous day
      const today = new Date().toDateString();
      fetchedTasks.forEach(async (task) => {
        if (task.isRecurring && task.frequency === 'daily' && task.status === 'done' && task.lastCompletedAt) {
          const lastDate = new Date(task.lastCompletedAt).toDateString();
          if (lastDate !== today) {
            try {
              await updateDoc(doc(db, 'tasks', task.id), { status: 'todo' });
            } catch (err) {
              console.error("Failed to reset daily task:", err);
            }
          }
        }
      });

      setTasks(fetchedTasks);
    }, (error: Error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    const qWorkers = query(
      collection(db, 'workers'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );
    const unsubWorkers = onSnapshot(qWorkers, (snapshot) => {
      setWorkers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Worker)));
    }, (error: Error) => handleFirestoreError(error, OperationType.LIST, 'workers'));

    return () => {
      unsubTasks();
      unsubWorkers();
    };
  }, [currentUser, currentOffice]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser || !currentOffice) return;
    
    if (currentOffice.status === 'closed') {
      alert("Office is closed. You can't create or assign tasks right now.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        assignedTo: assignedTo || null,
        status: 'todo',
        isRecurring,
        frequency: isRecurring ? frequency : null,
        officeId: currentOffice.id,
        ownerId: currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      setTitle('');
      setDescription('');
      setAssignedTo('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks');
    } finally {
      setLoading(false);
    }
  };

  const smartAssign = async (taskTitle: string, taskDesc: string) => {
    if (workers.length === 0) return;
    setAiLoading(true);
    try {
      const workerContext = workers.map(w => ({
        id: w.id,
        name: w.name,
        role: w.role,
        skills: w.skills?.join(', ') || 'None'
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Given this task: "${taskTitle}" (${taskDesc}), and these workers: ${JSON.stringify(workerContext)}, which worker is the best fit? Return ONLY the worker ID.`,
      });

      const suggestedId = response.text?.trim() || '';
      const found = workers.find(w => w.id === suggestedId || (suggestedId && suggestedId.includes(w.id)));
      if (found) {
        setAssignedTo(found.id);
      }
    } catch (error) {
      console.error('Smart assign error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const generateFlow = async () => {
    if (!flowPrompt.trim() || !currentUser || !currentOffice) return;
    setAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a sequence of 3-5 tasks to achieve this goal: "${flowPrompt}". Return a JSON array of objects with "title" and "description" fields.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ['title', 'description']
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error('No response from AI');
      const newTasksData = JSON.parse(text);
      const batch = writeBatch(db);
      const flowId = `flow_${Date.now()}`;
      const flowName = flowPrompt.trim().substring(0, 50) + (flowPrompt.length > 50 ? '...' : '');
      
      newTasksData.forEach((t: any) => {
        const docRef = doc(collection(db, 'tasks'));
        batch.set(docRef, {
          ...t,
          status: 'todo',
          flowId,
          flowName,
          officeId: currentOffice.id,
          ownerId: currentUser.uid,
          createdAt: new Date().toISOString(),
        });
      });

      await batch.commit();
      setShowFlowModal(false);
      setFlowPrompt('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tasks (batch)');
    } finally {
      setAiLoading(false);
    }
  };

  const refineTaskWithAI = async (currentTitle: string, currentDesc: string) => {
    if (!currentTitle.trim()) return;
    setAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Refine this task into a one-paragraph actionable instruction for an AI agent: Title: "${currentTitle}", Current Description: "${currentDesc}". Focus on what the final result should be. Return ONLY the refined description.`,
      });
      const refined = response.text?.trim() || '';
      if (refined) {
        setDescription(refined);
      }
    } catch (error) {
      console.error('Refine task error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRefineExistingTask = async (id: string, title: string, currentDesc: string) => {
    setAiLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-preview',
        contents: `Refine this task into a one-paragraph actionable instruction for an AI agent: Title: "${title}", Current Description: "${currentDesc}". Return ONLY the refined description.`,
      });
      const refined = response.text?.trim() || '';
      if (refined) {
        await updateDoc(doc(db, 'tasks', id), { description: refined });
      }
    } catch (error) {
      console.error('Refine existing task error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'todo' | 'in-progress' | 'done') => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'done') {
        updates.lastCompletedAt = new Date().toISOString();
      }
      await updateDoc(doc(db, 'tasks', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const [viewMode, setViewMode] = useState<'list' | 'flow'>('list');

  if (!currentOffice) {
    return <div className="text-center text-slate-500 mt-10">Please select an office first.</div>;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo': return <Circle className="w-5 h-5 text-slate-400" />;
      case 'in-progress': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'done': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Circle className="w-5 h-5 text-slate-400" />;
    }
  };

  const groupedByFlow = tasks.reduce((acc, task) => {
    const flowId = task.flowId || 'no-flow';
    if (!acc[flowId]) acc[flowId] = [];
    acc[flowId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Automated Task Flows</h1>
          <p className="text-slate-500 mt-1">Orchestrate your digital twins with AI-powered task management.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setViewMode('flow')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'flow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              By Flow
            </button>
          </div>
          <button
            onClick={() => setShowFlowModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Wand2 className="w-4 h-4" />
            Generate Flow
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 sticky top-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              New Task
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="e.g., Prepare Q3 Report"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">Description</label>
                  <div className="flex gap-2">
                    {title && (
                      <button
                        type="button"
                        onClick={() => refineTaskWithAI(title, description)}
                        disabled={aiLoading}
                        className="text-xs text-indigo-600 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
                        title="Refine instructions with AI"
                      >
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Refine
                      </button>
                    )}
                    {title && (
                      <button
                        type="button"
                        onClick={() => smartAssign(title, description)}
                        disabled={aiLoading || workers.length === 0}
                        className="text-xs text-emerald-600 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        Smart Assign
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Task details..."
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssignedTo(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Unassigned</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.role})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-slate-700">Recurring Task</label>
              </div>
              {isRecurring && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFrequency(e.target.value as 'daily')}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  >
                    <option value="daily">Daily</option>
                  </select>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="w-full bg-amber-500 text-white font-medium py-2 px-4 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-8">
          {viewMode === 'list' ? (
            <div className="space-y-4">
              {tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((task) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  workers={workers} 
                  onStatusChange={handleStatusChange} 
                  onDelete={handleDelete}
                  onRefineTask={handleRefineExistingTask}
                  getStatusIcon={getStatusIcon}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedByFlow).map(([flowId, flowTasks]) => (
                <div key={flowId} className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className={`w-1.5 h-6 rounded-full ${flowId === 'no-flow' ? 'bg-slate-300' : 'bg-indigo-500'}`} />
                    <h3 className="font-bold text-slate-800">
                      {flowId === 'no-flow' ? 'Individual Tasks' : flowTasks[0].flowName}
                    </h3>
                    <span className="text-xs text-slate-400 font-normal">({flowTasks.length} tasks)</span>
                  </div>
                  <div className="space-y-4">
                    {flowTasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task} 
                        workers={workers} 
                        onStatusChange={handleStatusChange} 
                        onDelete={handleDelete}
                        onRefineTask={handleRefineExistingTask}
                        getStatusIcon={getStatusIcon}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {tasks.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No tasks created yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Flow Generation Modal */}
      <AnimatePresence>
        {showFlowModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8"
            >
              <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Wand2 className="w-6 h-6 text-indigo-600" />
                Generate Automated Flow
              </h2>
              <p className="text-slate-500 mb-6">
                Describe a high-level goal, and the AI will break it down into a sequence of actionable tasks for your office.
              </p>
              <textarea
                value={flowPrompt}
                onChange={(e) => setFlowPrompt(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-6"
                placeholder="e.g., Launch a new marketing campaign for our summer collection..."
                rows={4}
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowFlowModal(false)}
                  className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={generateFlow}
                  disabled={aiLoading || !flowPrompt.trim()}
                  className="bg-indigo-600 text-white px-8 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface TaskCardProps {
  task: Task;
  workers: Worker[];
  onStatusChange: (id: string, status: 'todo' | 'in-progress' | 'done') => void;
  onDelete: (id: string) => void;
  onRefineTask?: (title: string, desc: string, id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, workers, onStatusChange, onDelete, onRefineTask, getStatusIcon }) => {
  return (
    <motion.div 
      layout
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between group"
    >
      <div className="flex gap-4 items-start w-full">
        <button 
          onClick={() => {
            const next = task.status === 'todo' ? 'in-progress' : task.status === 'in-progress' ? 'done' : 'todo';
            onStatusChange(task.id, next);
          }}
          className="mt-1 shrink-0 hover:scale-110 transition-transform"
        >
          {getStatusIcon(task.status)}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap justify-between pr-8">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`text-lg font-semibold ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                {task.title}
              </h3>
              {task.flowId && (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                  Flow
                </span>
              )}
              {task.isRecurring && (
                <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {task.frequency}
                </span>
              )}
            </div>
            {onRefineTask && task.status !== 'done' && (
              <button
                onClick={() => onRefineTask(task.title, task.description || '', task.id)}
                className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
              >
                <Wand2 className="w-3 h-3" />
                Refine Instructions
              </button>
            )}
          </div>
          {task.description && <p className="text-slate-500 mt-1 text-sm">{task.description}</p>}
          
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${
              task.status === 'todo' ? 'bg-slate-100 text-slate-600' :
              task.status === 'in-progress' ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {task.status.toUpperCase()}
            </span>
            
            {task.assignedTo && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                Assigned to: <strong className="text-slate-700">{workers.find(w => w.id === task.assignedTo)?.name || 'Unknown'}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDelete(task.id)}
        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        title="Delete Task"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </motion.div>
  );
};
