import React, { useState } from 'react';
import { Youtube, Sparkles, Play, FileText, Copy, Clock, Target } from 'lucide-react';
import { summarizeYouTubeVideo } from '../lib/gemini';

interface YouTubeResult {
  summary: string;
  keyPoints: string[];
  timestamps: { time: string; topic: string }[];
  examTopics: string[];
}

export default function YouTubeSummarizer() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<YouTubeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSummarize = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const data = await summarizeYouTubeVideo(url);
      setResult(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white">YouTube Summarizer</h1>
        <p className="text-slate-400">Extract key insights and exam-relevant topics from educational videos.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-red-600/20 rounded-2xl flex items-center justify-center mb-6">
                <Youtube className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Enter Video URL</h2>
              <p className="text-slate-400">Paste the link to any YouTube lecture or tutorial.</p>
            </div>

            <div className="space-y-6">
              <div className="relative">
                <Play className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              
              <button 
                onClick={handleSummarize}
                disabled={loading || !url}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Summarize Video
              </button>
            </div>
          </div>

          {result && (
            <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-500" />
                Key Timestamps
              </h3>
              <div className="space-y-3">
                {result.timestamps.map((ts, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <span className="text-indigo-400 font-bold text-sm min-w-[60px]">{ts.time}</span>
                    <span className="text-slate-300 text-sm">{ts.topic}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          
          <div className="flex-1 overflow-y-auto space-y-8">
            {result ? (
              <>
                <section>
                  <h4 className="text-indigo-400 font-bold mb-2 uppercase text-xs tracking-widest">Summary</h4>
                  <p className="text-slate-300 leading-relaxed">{result.summary}</p>
                </section>
                
                <section>
                  <h4 className="text-indigo-400 font-bold mb-2 uppercase text-xs tracking-widest">Key Takeaways</h4>
                  <ul className="space-y-2">
                    {result.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-3 text-slate-400 text-sm">
                        <span className="text-indigo-500 mt-1">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="text-emerald-400 font-bold mb-2 uppercase text-xs tracking-widest flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Exam-Relevant Topics
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.examTopics.map((topic, i) => (
                      <span key={i} className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold border border-emerald-500/20">
                        {topic}
                      </span>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
                  <Youtube className="w-8 h-8 text-slate-700" />
                </div>
                <p className="text-slate-500">Video intelligence will appear here once summarized.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
