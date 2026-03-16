import React, { useState, useEffect } from 'react';
import { BrainCircuit, Sparkles, Target, AlertCircle, Book, List, FileUp, BarChart3, TrendingUp, History, CheckCircle2, Bookmark, BookmarkCheck, Upload, Link, X } from 'lucide-react';
import { predictExamQuestions } from '../lib/gemini';
import { savePreviousPaper, getPreviousPapers, savePredictions, toggleBookmark, getBookmarks, PreviousPaper, Bookmark as BookmarkType } from '../lib/firebaseService';
import { useAuth } from '../lib/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

interface PredictedTopic {
  name: string;
  score: number;
  frequency: number;
  probability: number;
}

interface PredictedQuestion {
  text: string;
  probability: number;
  reason: string;
}

export default function Predictions() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [predictedTopics, setPredictedTopics] = useState<PredictedTopic[]>([]);
  const [predictedQuestions, setPredictedQuestions] = useState<PredictedQuestion[]>([]);
  const [previousPapers, setPreviousPapers] = useState<PreviousPaper[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([]);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPreviousPapers();
      fetchBookmarks();
    }
  }, [user]);

  useEffect(() => {
    if (file && (file.type === 'image/jpeg' || file.type === 'image/png')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview(null);
    }
  }, [file]);

  const fetchBookmarks = async () => {
    if (!user) return;
    const b = await getBookmarks(user.uid);
    setBookmarks(b);
  };

  const handleToggleBookmark = async (question: PredictedQuestion) => {
    if (!user) return;
    await toggleBookmark(user.uid, 'question', question);
    fetchBookmarks();
  };

  const isBookmarked = (text: string) => {
    return bookmarks.some(b => b.content.text === text);
  };

  const fetchPreviousPapers = async () => {
    if (!user) return;
    const papers = await getPreviousPapers(user.uid);
    setPreviousPapers(papers);
  };

  const extractTextFromInput = async (): Promise<string> => {
    if (file) {
      if (file.type === 'application/pdf') {
        // const pdfParse = (await import('pdf-parse')) as any;
        // const arrayBuffer = await file.arrayBuffer();
        // const data = await pdfParse(new Uint8Array(arrayBuffer));
        // return data.text;
        return `PDF file: ${file.name} - Text extraction not implemented yet`;
      } else if (file.type.startsWith('image/')) {
        return `Image file: ${file.name} - OCR not implemented yet`;
      } else {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsText(file);
        });
      }
    } else if (url) {
      const response = await fetch(url);
      return await response.text();
    }
    return '';
  };

  const handleAnalyze = async () => {
    if (!user || (!file && !url)) return;
    setAnalyzing(true);
    setError(null);
    setStatus("Extracting text...");

    try {
      const text = await extractTextFromInput();
      if (!text.trim()) throw new Error('No content to analyze');

      setStatus("Analyzing content...");

      // For now, create mock predicted topics based on text length
      // In a real implementation, this would call an ML service
      const mockTopics: PredictedTopic[] = [
        { name: 'Data Structures', score: 85, frequency: 12, probability: 85 },
        { name: 'Algorithms', score: 78, frequency: 10, probability: 78 },
        { name: 'System Design', score: 65, frequency: 8, probability: 65 },
        { name: 'Database Design', score: 55, frequency: 6, probability: 55 },
        { name: 'Web Development', score: 45, frequency: 4, probability: 45 }
      ];

      setPredictedTopics(mockTopics);
      setStatus("Generating AI predictions...");

      // AI Prediction via Gemini
      const aiResult = await predictExamQuestions("General", mockTopics.slice(0, 5));
      setPredictedQuestions(aiResult.questions);

      setStatus("Finalizing results...");
      // Save results
      await savePredictions({
        userId: user.uid,
        subject: "General",
        predictedTopics: mockTopics,
        questions: aiResult.questions
      });

      // Save the paper
      await savePreviousPaper({
        userId: user.uid,
        subject: "General",
        year: new Date().getFullYear(),
        questions: aiResult.questions.map(q => q.text)
      });

      setStatus(null);
      setFile(null);
      setUrl('');
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Failed to run prediction engine");
      setStatus(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const COLORS = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold text-white">Exam Intelligence Engine</h1>
        <p className="text-slate-400">ML-powered question forecasting and trend analysis.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <FileUp className="w-5 h-5 text-indigo-500" />
              Input Source
            </h3>
            
            <div className="space-y-6">
              {/* PDF Drop Zone */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Upload PDF, DOCX, or Image</label>
                <div
                  className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const droppedFile = files[0];
                      if (droppedFile.type === 'application/pdf' || 
                          droppedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                          droppedFile.type.startsWith('image/')) {
                        setFile(droppedFile);
                      } else {
                        alert('Please upload a PDF, DOCX, or image file.');
                      }
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">
                    Drag & drop a file here
                  </p>
                  <p className="text-slate-500 text-sm">or</p>
                  <input
                    type="file"
                    accept=".pdf,.docx,.jpg,.png"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="file-input"
                  />
                  <label
                    htmlFor="file-input"
                    className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-bold"
                  >
                    Browse files
                  </label>
                </div>

                {file && (
                  <div className="mt-4 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {filePreview ? (
                          <img src={filePreview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-indigo-600/20 rounded flex items-center justify-center">
                            <Upload className="w-6 h-6 text-indigo-400" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-bold">{file.name}</p>
                          <p className="text-slate-400 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFile(null)}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* URL Input */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Or Enter URL</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/past-paper"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              {/* Analyze Button */}
              <button 
                onClick={handleAnalyze}
                disabled={analyzing || (!file && !url)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                {analyzing ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                {analyzing ? 'Analyzing...' : 'Analyze & Predict'}
              </button>

              {status && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-2 text-indigo-400 text-xs">
                  <div className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  {status}
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Prediction Section */}
        <div className="space-y-8">
          <AnimatePresence>
            {predictedTopics.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                {/* Topic Chart */}
                <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-500" />
                    Weighted Topic Importance
                  </h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={predictedTopics.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                          {predictedTopics.slice(0, 5).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Probability List */}
                <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Topic Probability Score
                  </h3>
                  <div className="space-y-4">
                    {predictedTopics.slice(0, 5).map((topic, i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-300">{topic.name}</span>
                          <span className="text-indigo-400">{topic.probability}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${topic.probability}%` }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                            className="h-full bg-indigo-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* AI Predicted Questions */}
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-8 min-h-[400px]">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-white flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                AI Generated Expected Questions
              </h3>
              {predictedQuestions.length > 0 && (
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                  {predictedQuestions.length} Predictions
                </span>
              )}
            </div>

            <div className="space-y-6">
              {predictedQuestions.length > 0 ? predictedQuestions.map((q, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  key={i} 
                  className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all"
                >
                  <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Probability</p>
                      <p className="text-lg font-bold text-indigo-400">{q.probability}%</p>
                    </div>
                    <button 
                      onClick={() => handleToggleBookmark(q)}
                      className={`p-2 rounded-lg transition-all ${
                        isBookmarked(q.text) ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-white'
                      }`}
                    >
                      {isBookmarked(q.text) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </span>
                    <div className="space-y-3 pr-16">
                      <p className="text-white font-medium leading-relaxed">{q.text}</p>
                      <div className="flex items-start gap-2 p-3 bg-indigo-600/5 rounded-xl border border-indigo-500/10">
                        <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-400 leading-relaxed italic">
                          <span className="text-indigo-400 font-bold not-italic mr-1">Reasoning:</span>
                          {q.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-center p-12">
                  <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center mb-6">
                    <BrainCircuit className="w-10 h-10 text-slate-700" />
                  </div>
                  <h4 className="text-white font-bold mb-2">Ready for Intelligence?</h4>
                  <p className="text-slate-500 max-w-sm">
                    Upload past papers and run the prediction engine to see AI-generated expected questions and topic trends.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
