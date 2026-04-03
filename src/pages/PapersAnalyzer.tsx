import React, { useState } from 'react';
import { History, FileUp, Sparkles, Target, AlertCircle, ChevronRight } from 'lucide-react';
import { analyzePreviousPaper } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';

interface AnalysisResult {
  importantQuestions: string[];
  longAnswerQuestions: string[];
  trickyQuestions: string[];
  insights: string;
}

export default function PapersAnalyzer() {
  const [inputText, setInputText] = useState('');
  const [pyqs, setPyqs] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!inputText && !file) return;
    setLoading(true);
    setError(null);
    setStatus("Initializing analysis...");
    
    try {
      let textToAnalyze = inputText;

      if (file) {
        setStatus(`Uploading and extracting text from ${file.name}...`);
        const formData = new FormData();
        formData.append('file', file);
        
        const uploadRes = await fetch('/api/upload-paper', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadRes.ok) {
          const errorData = await uploadRes.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed: ${uploadRes.statusText}`);
        }
        
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          textToAnalyze = uploadData.text;
          setStatus("Text extracted successfully. Starting AI analysis...");
        } else {
          throw new Error(uploadData.error || "Failed to extract text from file");
        }
      } else {
        setStatus("Analyzing pasted text with AI...");
      }

      if (!textToAnalyze || textToAnalyze.trim().length < 10) {
        throw new Error("Please provide more content to analyze (at least 10 characters).");
      }

      const data = await analyzePreviousPaper(textToAnalyze, pyqs);
      
      if (
        !data ||
        (
          data.importantQuestions.length === 0 &&
          data.longAnswerQuestions.length === 0 &&
          data.trickyQuestions.length === 0
        )
      ) {
        throw new Error("AI was unable to extract meaningful data from this paper. Please try with clearer content.");
      }
      
      setResult(data);
      setStatus(null);
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "An unexpected error occurred during analysis.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Previous Papers Analyzer</h1>
          <p className="text-slate-400">Analyze trends and patterns in past exams using AI.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-500" />
              Analyze New Paper
            </h3>
            
            <div className="space-y-4 mb-4">
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste study material or the content of a previous year paper here..."
                className="w-full h-[150px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-3">
                  Paste Previous Year Questions (optional)
                </label>
                <textarea
                  value={pyqs}
                  onChange={(e) => setPyqs(e.target.value)}
                  placeholder="Paste PYQs here to align predictions with exam trends..."
                  className="w-full h-[120px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                />
              </div>
              
              <div className="flex items-center gap-4 p-4 bg-slate-900/50 border border-slate-800 border-dashed rounded-xl">
                <FileUp className="w-6 h-6 text-slate-500" />
                <div className="flex-1">
                  <p className="text-sm text-slate-400 mb-1">Or upload a PDF/Text file</p>
                  <input 
                    type="file" 
                    accept=".pdf,.txt"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] || null);
                      setError(null);
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-600/10 file:text-indigo-400 hover:file:bg-indigo-600/20 cursor-pointer"
                  />
                </div>
                {file && (
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                    File selected
                  </div>
                )}
              </div>
            </div>

            {status && (
              <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3 text-indigo-400 text-sm">
                <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                {status}
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <button 
              onClick={handleAnalyze}
              disabled={loading || (!inputText && !file)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Predicted Questions
                </>
              )}
            </button>
          </div>

          <AnimatePresence>
            {result && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0d1425] border border-slate-800 rounded-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-white">Predicted Important Questions</h3>
                </div>
                <div className="p-6 space-y-4">
                  {result.importantQuestions.map((q, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl flex gap-4">
                      <span className="w-6 h-6 bg-indigo-600/20 text-indigo-400 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-slate-300 text-sm leading-relaxed">{q}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          {result ? (
            <>
              <div className="bg-indigo-600/10 border border-indigo-500/20 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-indigo-400 mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  AI Insights
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {result.insights}
                </p>
              </div>

              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-500" />
                  Long Answer Questions
                </h3>
                <div className="space-y-4">
                  {result.longAnswerQuestions.map((question, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <p className="text-slate-300 text-sm leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Conceptual / Tricky Questions
                </h3>
                <div className="space-y-4">
                  {result.trickyQuestions.map((question, i) => (
                    <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                      <p className="text-slate-300 text-sm leading-relaxed">{question}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-[#0d1425] border border-slate-800 p-8 rounded-2xl text-center">
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="text-white font-bold mb-2">No Analysis Yet</h3>
              <p className="text-slate-500 text-sm">Paste study material and optional PYQs to generate exam-aligned predicted questions.</p>
            </div>
          )}

          <div className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Analysis Tips
            </h3>
            <ul className="space-y-3">
              {[
                'Paste core study material before generating predictions',
                'Add previous year questions to improve exam pattern matching',
                'Include marks or difficulty hints when available',
              ].map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-400">
                  <ChevronRight className="w-4 h-4 text-indigo-500 shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
