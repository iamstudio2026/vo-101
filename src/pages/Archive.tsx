import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { Task, OperationType } from '../types';
import { Archive as ArchiveIcon, Trash2, RefreshCcw, FileText, Calendar, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Markdown from 'react-markdown';

export const Archive: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!currentUser || !currentOffice) {
      setArchivedTasks([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'tasks'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id),
      where('collected', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArchivedTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
      setLoading(false);
    }, (error: any) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, currentOffice]);

  const handleDelete = async (taskId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this item?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      if (selectedTask?.id === taskId) setSelectedTask(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const handleResendToSimulation = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        collected: false,
        status: 'todo',
        lastResentAt: new Date().toISOString()
      });
      alert('Task resent to simulation! It will now appear in the storage area or as a pending task.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const filteredTasks = archivedTasks.filter(task => 
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (task.result && task.result.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (!currentOffice) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <ArchiveIcon className="w-16 h-16 mb-4 text-slate-300" />
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">No Office Selected</h2>
        <p>Please select an office to view the archive.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ArchiveIcon className="w-8 h-8 text-amber-500" />
            Asset Archive
          </h1>
          <p className="text-slate-500 mt-1">Review and manage assets extracted from the Depósito de Activos.</p>
        </div>
        
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search assets..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 w-64 shadow-sm"
          />
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex gap-6">
        {/* List View */}
        <div className="w-1/3 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Items ({filteredTasks.length})
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12 px-4">
                <ArchiveIcon className="w-12 h-12 mx-auto text-slate-200 mb-4" />
                <p className="text-slate-400 italic">No archived assets found.</p>
              </div>
            ) : (
              filteredTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`w-full text-left p-4 rounded-xl transition-all border ${
                    selectedTask?.id === task.id 
                      ? 'bg-amber-50 border-amber-200 shadow-sm' 
                      : 'hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <h3 className="font-bold text-slate-800 line-clamp-1">{task.title}</h3>
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3" />
                    {new Date(task.createdAt).toLocaleDateString()}
                    {task.assignedTo && (
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded ml-auto truncate max-w-[100px]">
                        AI Result
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detailed View */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <AnimatePresence mode="wait">
            {selectedTask ? (
              <motion.div 
                key={selectedTask.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col h-full"
              >
                <div className="p-6 border-b border-slate-50 flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedTask.title}</h2>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-4">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Created: {new Date(selectedTask.createdAt).toLocaleDateString()}</span>
                      {selectedTask.lastResentAt && (
                        <span className="text-amber-600 flex items-center gap-1 font-medium">
                          <RefreshCcw className="w-4 h-4" /> Reprocessed: {new Date(selectedTask.lastResentAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResendToSimulation(selectedTask.id)}
                      className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl font-medium hover:bg-indigo-100 transition-colors shadow-sm"
                      title="Send back to Office simulation"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Resend
                    </button>
                    <button
                      onClick={() => handleDelete(selectedTask.id)}
                      className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-medium hover:bg-red-100 transition-colors"
                      title="Permanently remove"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                  <div className="grid grid-cols-1 gap-8 max-w-3xl mx-auto">
                    {selectedTask.description && (
                      <section>
                        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Original Mission
                        </h3>
                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-slate-700 leading-relaxed">
                          {selectedTask.description}
                        </div>
                      </section>
                    )}

                    <section>
                      <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" /> AI Produced Content
                      </h3>
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md prose prose-slate max-w-none min-h-[400px]">
                        {selectedTask.result ? (
                          <Markdown>{selectedTask.result}</Markdown>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                            <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                            <p className="italic uppercase tracking-widest text-[10px] font-bold">Waiting for simulation data...</p>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                  <FileText className="w-10 h-10 opacity-20" />
                </div>
                <p className="text-sm font-medium">Select an asset to view its contents</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const Sparkles = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
);
