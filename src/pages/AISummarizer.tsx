import React, { useRef, useState } from 'react';
import { FileText, Sparkles, Upload, Copy, Save, CheckCircle2 } from 'lucide-react';
import { generateStudyContent, type SummaryMode } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { COLLECTIONS } from '../lib/firebaseService';
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

interface SummaryResult {
  summary: string;
  bulletPoints: string[];
  keyConcepts: string[];
}

const isYouTubeLink = (input: string): boolean => {
  return input.includes('youtube.com') || input.includes('youtu.be');
};

const detectSmartMode = (input: string): Exclude<SummaryMode, 'smart'> => {
  if (input.length > 3000) {
    return 'points';
  }

  const definitionPattern = /\b(is defined as|defined as|definition|refers to|means)\b/i;
  if (definitionPattern.test(input)) {
    return 'exam';
  }

  return 'normal';
};

const getPromptLabel = (mode: SummaryMode) => {
  switch (mode) {
    case 'smart':
      return 'Smart Summary';
    case 'points':
      return 'Bullet Points';
    case 'exam':
      return 'Exam Notes';
    case 'detailed':
      return 'Detailed';
    default:
      return 'Normal';
  }
};

const summarize = async (input: string, mode: SummaryMode): Promise<SummaryResult> => {
  if (isYouTubeLink(input)) {
    return {
      summary: 'Please paste the YouTube transcript manually for accurate summarization.',
      bulletPoints: [],
      keyConcepts: [],
    };
  }

  const content = input.slice(0, 5000);
  const resolvedMode = mode === 'smart' ? detectSmartMode(content) : mode;

  return generateStudyContent(content, resolvedMode);
};

export default function AISummarizer() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<SummaryMode>('normal');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      throw new Error("PDF worker not loaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const header = new Uint8Array(arrayBuffer, 0, 4);
    const isPdf = header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
    if (!isPdf) {
      throw new Error("Invalid PDF or unsupported format");
    }

    const safeBuffer = new Uint8Array(arrayBuffer.slice(0));
    const pdf = await pdfjsLib.getDocument({ data: safeBuffer }).promise;

    let extracted = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      extracted += pageText + "\n";
    }
    return extracted;
  };

  const handleFileSelect = async (file: File) => {
    setLoading(true);
    setSaved(false);
    try {
      const extractedText = await extractTextFromPdf(file);
      setText(extractedText);
    } catch (error: any) {
      console.error(error);
      alert(`Failed to read PDF: ${error.message || 'Please try another file.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!text) return;
    setLoading(true);
    setSaved(false);
    try {
      const data = await summarize(text, mode);
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
            <label className="block text-sm font-medium text-slate-400 mb-4">Paste text, upload PDF, or paste YouTube transcript</label>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Summary Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SummaryMode)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="smart">Auto Smart Mode</option>
                <option value="normal">Normal</option>
                <option value="points">Bullet Points</option>
                <option value="exam">Exam Notes</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
            <textarea 
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text, upload PDF, or paste YouTube transcript"
              className="w-full h-[400px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />
            <p className="mt-3 text-sm text-slate-500">
              For YouTube videos, copy transcript from YouTube and paste here.
            </p>
            <div className="mt-4 flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileSelect(file);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
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
                Generate {getPromptLabel(mode)}
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
