import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { OfficeProvider } from './context/OfficeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Offices } from './pages/Offices';
import { Workers } from './pages/Workers';
import { Tasks } from './pages/Tasks';
import { AudioAnalyzer } from './pages/AudioAnalyzer';
import { Miniverse } from './pages/Miniverse';
import { Landing } from './pages/Landing';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }
  
  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <OfficeProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="offices" element={<Offices />} />
                <Route path="workers" element={<Workers />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="audio" element={<AudioAnalyzer />} />
                <Route path="miniverse" element={<Miniverse />} />
              </Route>
              {/* Fallback for existing /landing links */}
              <Route path="/landing" element={<Navigate to="/" replace />} />
              {/* Redirect any other root level app paths to the new structure if needed, 
                  but for now let's keep them as children of /app */}
            </Routes>
          </Router>
        </OfficeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
