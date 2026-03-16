import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, limit, orderBy, updateDoc, doc } from 'firebase/firestore';
import { Task, Worker, OperationType } from '../types';
import { Building2, Users, CheckSquare, Clock, ArrowRight, Power, PowerOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { handleFirestoreError } from '../firebase';

export const Dashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { currentOffice, offices } = useOffice();
  const [workersCount, setWorkersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!currentUser || !currentOffice) return;

    const workersQuery = query(
      collection(db, 'workers'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );
    const unsubWorkers = onSnapshot(workersQuery, (snapshot) => {
      setWorkersCount(snapshot.size);
    });

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id)
    );
    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasksCount(snapshot.size);
    });

    const recentTasksQuery = query(
      collection(db, 'tasks'),
      where('ownerId', '==', currentUser.uid),
      where('officeId', '==', currentOffice.id),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubRecent = onSnapshot(recentTasksQuery, (snapshot) => {
      setRecentTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    return () => {
      unsubWorkers();
      unsubTasks();
      unsubRecent();
    };
  }, [currentUser, currentOffice]);

  if (!currentOffice) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Building2 className="w-16 h-16 mb-4 text-slate-300" />
        <h2 className="text-2xl font-semibold text-slate-700 mb-2">No Office Selected</h2>
        <p>Please select or create an office to view the dashboard.</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto"
    >
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{currentOffice.name}</h1>
          <p className="text-slate-500 mt-1">{currentOffice.description || 'Welcome to your virtual office dashboard.'}</p>
        </div>
        <div className={`flex items-center gap-3 p-1 rounded-2xl border transition-all ${
          currentOffice.status === 'closed' ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
        }`}>
          <button
            onClick={async () => {
              if (!currentOffice) return;
              try {
                await updateDoc(doc(db, 'offices', currentOffice.id), {
                  status: currentOffice.status === 'closed' ? 'open' : 'closed'
                });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `offices/${currentOffice.id}`);
              }
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
              currentOffice.status === 'closed' 
                ? 'bg-red-500 text-white shadow-lg shadow-red-200' 
                : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
            }`}
          >
            {currentOffice.status === 'closed' ? (
              <><PowerOff className="w-4 h-4" /> Office Closed</>
            ) : (
              <><Power className="w-4 h-4" /> Office Open</>
            )}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Offices</p>
            <p className="text-2xl font-bold text-slate-900">{offices.length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Workers</p>
            <p className="text-2xl font-bold text-slate-900">{workersCount}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Tasks</p>
            <p className="text-2xl font-bold text-slate-900">{tasksCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Recent Tasks
            </h3>
            <Link to="/app/tasks" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="space-y-4">
            {recentTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'done' ? 'bg-emerald-500' :
                    task.status === 'in-progress' ? 'bg-amber-500' : 'bg-slate-300'
                  }`} />
                  <span className={`text-sm font-medium ${task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {task.title}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(task.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
            {recentTasks.length === 0 && (
              <p className="text-center text-slate-400 py-8 italic">No tasks yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Quick Tip</h3>
          <p className="text-slate-500 mb-6">
            Use the <strong>Generate Flow</strong> feature in the Tasks tab to automatically break down complex goals into actionable steps for your digital twins.
          </p>
          <div className="flex gap-4">
            <Link 
              to="/app/miniverse" 
              className="flex-1 bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl font-medium text-center hover:bg-indigo-100 transition-colors"
            >
              Enter Miniverse
            </Link>
            <Link 
              to="/app/workers" 
              className="flex-1 bg-emerald-50 text-emerald-700 px-4 py-3 rounded-xl font-medium text-center hover:bg-emerald-100 transition-colors"
            >
              Add Workers
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
