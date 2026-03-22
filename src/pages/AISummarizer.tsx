import React, { useState } from 'react';
import { FileText, Sparkles, Upload, Copy, Save, CheckCircle2 } from 'lucide-react';
import { generateStudyContent } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { COLLECTIONS } from '../lib/firebaseService';

interface SummaryResult {
  summary: string;
  bulletPoints: string[];
  keyConcepts: string[];
}

export default function AISummarizer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();

  const handleSummarize = async () => {
    if (!text) return;
    setLoading(true);
    setSaved(false);
    try {
      const data = await generateStudyContent(text);
      setResult(data);
    } catch (error) {
      console.error(error);
      alert(`Failed to generate summary: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result || !user || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, COLLECTIONS.NOTES), {
        userId: user.uid,
        title: result.summary.slice(0, 50) + '...',
        content: JSON.stringify(result),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        type: 'ai_summary'
      });
      setSaved(true);
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Summarizer</h1>
          <p className="text-slate-400">Turn long chapters into structured study notes.</p>
        </div>
        {result && (
          <button 
            onClick={handleSave}
            disabled={saving || saved}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              saved 
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved to Notes' : 'Save Notes'}
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <label className="block text-sm font-medium text-slate-400 mb-4">Paste your text here</label>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the content of a chapter, article, or lecture notes..."
              className="w-full h-[400px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
            <div className="mt-4 flex gap-3">
              <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all">
                <Upload className="w-5 h-5" />
                Upload File
              </button>
              <button 
                onClick={handleSummarize}
                disabled={loading || !text}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Generate Summary
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6 flex flex-col min-h-[500px]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              AI Intelligence Output
            </h3>
            {result && (
              <button className="text-slate-400 hover:text-white transition-colors p-2">
                <Copy className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-6">
            {result ? (
              <>
                <section>
                  <h4 className="text-indigo-400 font-bold mb-2 uppercase text-xs tracking-widest">Summary</h4>
                  <p className="text-slate-300 leading-relaxed">{result.summary}</p>
                </section>
                
                <section>
                  <h4 className="text-indigo-400 font-bold mb-2 uppercase text-xs tracking-widest">Key Points</h4>
                  <ul className="space-y-2">
                    {result.bulletPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-slate-400 text-sm">
                        <span className="text-indigo-500 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="text-indigo-400 font-bold mb-2 uppercase text-xs tracking-widest">Core Concepts</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.keyConcepts.map((concept, i) => (
                      <span key={i} className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                        {concept}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-slate-700" />
                </div>
                <p className="text-slate-500">Your AI-powered study notes will appear here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
