import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import StudyRooms from './pages/StudyRooms';
import Flashcards from './pages/Flashcards';
import AISummarizer from './pages/AISummarizer';
import YouTubeSummarizer from './pages/YouTubeSummarizer';
import PapersAnalyzer from './pages/PapersAnalyzer';
import Predictions from './pages/Predictions';
import StudyPlanner from './pages/StudyPlanner';
import RoomDetail from './pages/RoomDetail';
import Profile from './pages/Profile';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage type="login" />} />
          <Route path="/signup" element={<AuthPage type="signup" />} />

          {/* Protected Routes (Dashboard Layout) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/rooms" element={<StudyRooms />} />
              <Route path="/rooms/:roomId" element={<RoomDetail />} />
              <Route path="/flashcards" element={<Flashcards />} />
              <Route path="/summarizer" element={<AISummarizer />} />
              <Route path="/youtube" element={<YouTubeSummarizer />} />
              <Route path="/analyzer" element={<PapersAnalyzer />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/planner" element={<StudyPlanner />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
