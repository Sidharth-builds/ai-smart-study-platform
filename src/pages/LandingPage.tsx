import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Brain, Users, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) return null;
  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white selection:bg-indigo-500/30">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BookOpen className="w-8 h-8 text-indigo-500" />
          <span className="text-2xl font-bold tracking-tighter">AI Smart Study</span>
        </div>
        <div className="flex items-center gap-8">
          <Link to="/login" className="text-slate-400 hover:text-white transition-colors">Login</Link>
          <Link to="/signup" className="bg-indigo-600 px-6 py-2 rounded-full font-medium hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block px-4 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium border border-indigo-500/20 mb-6">
            The Future of Learning is Here
          </span>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8 leading-[0.9]">
            Master Your Exams <br />
            <span className="text-indigo-500">With Intelligence.</span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
            AI-powered study automation, predictive analytics, and collaborative rooms designed to help you ace every test.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className="bg-indigo-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 group">
              Start Studying Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="bg-slate-800 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-700 transition-all border border-slate-700">
              Watch Demo
            </button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-24 border-t border-slate-800/50">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="space-y-4">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold">AI Automation</h3>
            <p className="text-slate-400">Summarize textbooks, YouTube videos, and research papers in seconds with Gemini AI.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold">Predictive Analytics</h3>
            <p className="text-slate-400">Our algorithms analyze previous papers to predict likely exam questions for your board.</p>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 bg-amber-600/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold">Collaborative Rooms</h3>
            <p className="text-slate-400">Join real-time study rooms with peers to solve problems and share resources instantly.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
