import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { getPredictionSessions, PredictionSession } from '../lib/firebaseService';
import { useAuth } from '../lib/AuthContext';

export default function Predictions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<PredictionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getPredictionSessions(user.uid)
      .then((data) => {
        console.log("Fetched predictions:", data);
        setSessions(data);
      })
      .catch((err) => {
        console.error("[Predictions] Failed to fetch prediction sessions:", err);
        setError("Failed to load predictions.");
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="space-y-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold text-white">Predicted Questions</h1>
        <p className="text-slate-400">Review your past AI prediction sessions.</p>
      </header>

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
          Loading prediction history...
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-[#0d1425] border border-slate-800 p-8 rounded-2xl text-center">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <History className="w-8 h-8 text-slate-700" />
          </div>
          <h3 className="text-white font-bold mb-2">No predictions yet</h3>
          <p className="text-slate-500 text-sm">
            Generate predictions from Papers Analyzer.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => (
            <div key={session.id} className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Prediction Session</h3>
                <span className="text-xs text-slate-400">
                  Date: {session.createdAt ? new Date((session.createdAt as any).toDate?.() ?? session.createdAt).toLocaleString() : "Unknown"}
                </span>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-300 mb-2">Topics:</h4>
                {session.topics && session.topics.length > 0 ? (
                  <ul className="space-y-2">
                    {session.topics.map((topic, i) => (
                      <li key={i} className="text-slate-400 text-sm">
                        - {topic}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm">No topics available.</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-300 mb-2">Predicted Questions:</h4>
                {session.questions && session.questions.length > 0 ? (
                  <ul className="space-y-2">
                    {session.questions.map((question, i) => (
                      <li key={i} className="text-slate-300 text-sm">
                        - {question}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm">No questions available.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
