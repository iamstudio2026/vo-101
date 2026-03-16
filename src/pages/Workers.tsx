import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Worker, OperationType } from '../types';
import { Users, Plus, Trash2, UserCircle, Edit2, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Workers: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice } = useOffice();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [model, setModel] = useState('gemini-2.0-flash');
  const [isEnabled, setIsEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editResponsibilities, setEditResponsibilities] = useState('');
  const [editModel, setEditModel] = useState('gemini-2.0-flash');
  const [editIsEnabled, setEditIsEnabled] = useState(true);

  const AVAILABLE_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Smart)' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (Reasoning)' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (KM 2.5)' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
    { id: 'google/gemini-2.0-pro-exp-02-05:free', name: 'Gemini 2.0 Pro (Experimental)' }
  ];

  useEffect(() => {
    if (!currentUser || !currentOffice) {
      setWorkers([]);
      return;
    }
    const q = query(
      collection(db, 'workers'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWorkers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Worker)));
    }, (error: Error) => handleFirestoreError(error, OperationType.LIST, 'workers'));
    return unsubscribe;
  }, [currentUser, currentOffice]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role.trim() || !currentUser || !currentOffice) return;

    if (currentOffice.status === 'closed') {
      alert("Office is closed. You can't add workers right now.");
      return;
    }

    setLoading(true);
    try {
      const skillsArray = skills.split(',').map((s: string) => s.trim()).filter(Boolean);
      await addDoc(collection(db, 'workers'), {
        name: name.trim(),
        role: role.trim(),
        skills: skillsArray,
        responsibilities: responsibilities.trim(),
        model: model,
        isEnabled: isEnabled,
        status: 'available',
        officeId: currentOffice.id,
        ownerId: currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      setName('');
      setRole('');
      setSkills('');
      setResponsibilities('');
      setModel('gemini-2.0-flash');
      setIsEnabled(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workers');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (worker: Worker) => {
    setEditingId(worker.id);
    setEditName(worker.name);
    setEditRole(worker.role);
    setEditSkills(worker.skills?.join(', ') || '');
    setEditResponsibilities(worker.responsibilities || '');
    setEditModel(worker.model || 'gemini-2.0-flash');
    setEditIsEnabled(worker.isEnabled !== false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName.trim() || !editRole.trim()) return;
    setLoading(true);
    try {
      const skillsArray = editSkills.split(',').map((s: string) => s.trim()).filter(Boolean);
      await updateDoc(doc(db, 'workers', editingId), {
        name: editName.trim(),
        role: editRole.trim(),
        skills: skillsArray,
        responsibilities: editResponsibilities.trim(),
        model: editModel,
        isEnabled: editIsEnabled,
      });
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `workers/${editingId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to remove this worker?')) {
      try {
        await deleteDoc(doc(db, 'workers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `workers/${id}`);
      }
    }
  };

  if (!currentOffice) {
    return <div className="text-center text-slate-500 mt-10">Please select an office first.</div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Digital Twins (Workers)</h1>
        <p className="text-slate-500 mt-1">Manage the digital replicas of your team members in {currentOffice.name}.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              Add Worker
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Jane Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <input
                  type="text"
                  required
                  value={role}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRole(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., Senior Developer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Skills (comma separated)</label>
                <input
                  type="text"
                  value={skills}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSkills(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="React, Node.js, Design"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsibilities</label>
                <textarea
                  value={responsibilities}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setResponsibilities(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Main duties and focus areas"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">AI Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-700">Agent Enabled</span>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim() || !role.trim()}
                className="w-full bg-emerald-600 text-white font-medium py-2 px-4 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Worker'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {workers.map((worker) => (
              <motion.div 
                key={worker.id} 
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative group"
              >
                {editingId === worker.id ? (
                  <form onSubmit={handleUpdate} className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-slate-800">Edit Worker</h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="p-1 text-emerald-500 hover:text-emerald-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Name"
                      />
                      <input
                        type="text"
                        required
                        value={editRole}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditRole(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Role"
                      />
                      <input
                        type="text"
                        value={editSkills}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditSkills(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Skills (comma separated)"
                      />
                      <textarea
                        value={editResponsibilities}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditResponsibilities(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Responsibilities"
                        rows={2}
                      />
                      <select
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                      >
                        {AVAILABLE_MODELS.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-medium text-slate-600">Enabled</span>
                        <button
                          type="button"
                          onClick={() => setEditIsEnabled(!editIsEnabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${editIsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${editIsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button
                        onClick={() => startEditing(worker)}
                        className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit Worker"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(worker.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove Worker"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 ${worker.isEnabled !== false ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'} rounded-full flex items-center justify-center shrink-0`}>
                        <UserCircle className="w-8 h-8" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{worker.name}</h3>
                          {worker.isEnabled === false && (
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase">Disabled</span>
                          )}
                        </div>
                        <p className="text-sm text-emerald-600 font-medium">{worker.role}</p>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Model</p>
                      <p className="text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded inline-block">
                        {AVAILABLE_MODELS.find(m => m.id === worker.model)?.name || worker.model || 'Standard'}
                      </p>
                    </div>
                    
                    {worker.skills && worker.skills.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {worker.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {worker.responsibilities && (
                      <p className="text-sm text-slate-600 line-clamp-3">
                        {worker.responsibilities}
                      </p>
                    )}
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {workers.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No workers added yet.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
