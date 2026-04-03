import { useState } from 'react';

type Topic = { name: string; count: number };
type AnalysisResponse = {
  topics: Topic[];
  predicted_questions: string[];
};

export default function PreviousPapersAnalyzerPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setError(null);
    setResult(null);

    if (!text.trim()) {
      setError('Please paste previous year questions to analyze.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Analysis failed.');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Previous Papers Analyzer</h1>
          <p className="text-slate-400 mt-2">
            Paste previous year questions to extract repeated topics and predict likely questions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Paste Previous Year Questions
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Example: Explain decision trees. What is BFS? Explain decision trees again."
              className="w-full h-64 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
            />

            {error && (
              <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all"
            >
              {loading ? 'Analyzing...' : 'Analyze Paper Trends'}
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Most Repeated Topics</h2>
              {result?.topics?.length ? (
                <ul className="space-y-2">
                  {result.topics.map((topic) => (
                    <li
                      key={topic.name}
                      className="flex items-center justify-between bg-slate-950/70 border border-slate-800 rounded-lg px-4 py-2 text-sm"
                    >
                      <span className="text-slate-200">{topic.name}</span>
                      <span className="text-indigo-400 font-semibold">{topic.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500 text-sm">No topics yet.</p>
              )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Predicted Questions</h2>
              {result?.predicted_questions?.length ? (
                <ol className="space-y-2 list-decimal list-inside text-sm text-slate-300">
                  {result.predicted_questions.map((q, i) => (
                    <li key={`${q}-${i}`} className="bg-slate-950/70 border border-slate-800 rounded-lg px-4 py-2">
                      {q}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-slate-500 text-sm">No predictions yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
