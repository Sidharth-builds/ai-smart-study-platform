import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Layers, 
  FileText, 
  Youtube, 
  History, 
  BrainCircuit, 
  Calendar, 
  UserCircle,
  LogOut,
  BookOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Study Rooms', path: '/rooms' },
  { icon: Layers, label: 'Flashcards', path: '/flashcards' },
  { icon: FileText, label: 'AI Summarizer', path: '/summarizer' },
  { icon: Youtube, label: 'YouTube Summarizer', path: '/youtube' },
  { icon: History, label: 'Papers Analyzer', path: '/analyzer' },
  { icon: BrainCircuit, label: 'Predicted Questions', path: '/predictions' },
  { icon: Calendar, label: 'Study Planner', path: '/planner' },
  { icon: UserCircle, label: 'Profile', path: '/profile' }
];

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0f1d] text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-[#0d1425] flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">AI Smart Study</h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                isActive 
                  ? "bg-indigo-600/10 text-indigo-400" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
