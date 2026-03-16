import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Clock, 
  Target, 
  TrendingUp, 
  FileText, 
  Layers, 
  Users, 
  BrainCircuit, 
  Bell,
  ChevronRight,
  Sparkles,
  Calendar
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { Link } from 'react-router-dom';
import { getRecentNotes, getStudyRooms, getStudyTasks, getPreviousPapers, Note, StudyRoom, StudyTask, PreviousPaper } from '../lib/firebaseService';
import { getStudyHours, getMasteredCards, getExamReadiness, getWeeklyGrowth } from '../services/dashboardService';
import { getFlashcardDecksSummary } from '../services/flashcardService';
import { getPredictedQuestions, PredictedQuestion } from '../lib/firebaseService';

export default function Dashboard() {
  const { user } = useAuth();
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [studyRooms, setStudyRooms] = useState<StudyRoom[]>([]);
  const [studyTasks, setStudyTasks] = useState<StudyTask[]>([]);
  const [studyHours, setStudyHours] = useState(0);
  const [masteredCards, setMasteredCards] = useState(0);
  const [examReadiness, setExamReadiness] = useState(0);
  const [weeklyGrowth, setWeeklyGrowth] = useState(0);
  const [predictions, setPredictions] = useState<PredictedQuestion[]>([]);
  const [flashcardDecks, setFlashcardDecks] = useState<{ title: string; masteryPercentage: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      const [notes, rooms, tasks, hours, cards, readiness, growth, preds, decks] = await Promise.all([
        getRecentNotes(user.uid, 4).catch(err => {
          console.warn("Notes permission error:", err);
          return [];
        }),
        getStudyRooms().catch(err => {
          console.warn("Rooms permission error:", err);
          return [];
        }),
        getStudyTasks(user.uid).catch(err => {
          console.warn("Tasks permission error:", err);
          return [];
        }),
        getStudyHours(user.uid).catch(err => {
          console.warn("Study hours error:", err);
          return 0;
        }),
        getMasteredCards(user.uid).catch(err => {
          console.warn("Mastered cards error:", err);
          return 0;
        }),
        getExamReadiness(user.uid).catch(err => {
          console.warn("Exam readiness error:", err);
          return 0;
        }),
        getWeeklyGrowth(user.uid).catch(err => {
          console.warn("Weekly growth error:", err);
          return 0;
        }),
        getPredictedQuestions(user.uid).catch(err => {
          console.warn("Predictions error:", err);
          return [];
        }),
        getFlashcardDecksSummary(user.uid).catch(err => {
          console.warn("Flashcard decks error:", err);
          return [];
        })
      ]);
      setRecentNotes(notes);
      setStudyRooms(rooms.slice(0, 2));
      setStudyTasks(tasks.filter(t => !t.completed).slice(0, 3));
      setStudyHours(hours);
      setMasteredCards(cards);
      setExamReadiness(readiness);
      setWeeklyGrowth(growth);
      setPredictions(preds);
      setFlashcardDecks(decks);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-indigo-400">{user?.displayName || 'Student'}</span>!
          </h1>
          <p className="text-slate-400 mt-1">Here's your study intelligence overview for today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-slate-800 p-2.5 rounded-xl text-slate-400 hover:text-white transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full border-2 border-[#0a0f1d]"></span>
          </button>
          <Link to="/planner" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Daily Plan
          </Link>
          <Link to="/tracker" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Study Tracker
          </Link>
        </div>
      </header>

      {/* Key Metrics */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Key Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Study Hours', value: `${studyHours.toFixed(1)}h`, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', trend: '+2.4h' },
            { label: 'Cards Mastered', value: masteredCards.toString(), icon: Brain, color: 'text-purple-500', bg: 'bg-purple-500/10', trend: '+12' },
            { label: 'Exam Readiness', value: `${examReadiness}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10', trend: '+5%' },
            { label: 'Weekly Growth', value: `${weeklyGrowth}%`, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10', trend: 'Stable' },
          ].map((stat, i) => (
            <div key={i} className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className={`${stat.bg} w-10 h-10 rounded-lg flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-2 py-1 rounded-md">
                  {stat.trend}
                </span>
              </div>
              <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Learning Activity */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Learning Activity</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Notes */}
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Recent Notes
              </h3>
              <Link to="/summarizer" className="text-indigo-400 text-sm font-bold hover:underline flex items-center gap-1">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentNotes.length > 0 ? recentNotes.map((note, i) => (
                <div key={i} className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                      Note
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(note.updatedAt.toDate()).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{note.title}</h4>
                </div>
              )) : (
                <div className="col-span-2 text-center py-8 text-slate-500 italic text-sm">No notes yet. Start by summarizing a lecture!</div>
              )}
            </div>
          </div>

          {/* Upcoming Tasks */}
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                Upcoming Tasks
              </h3>
              <Link to="/planner" className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="space-y-4">
              {studyTasks.length > 0 ? studyTasks.map((task, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="shrink-0 w-12 text-center">
                    <p className="text-[10px] font-bold text-indigo-400">{new Date(task.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="flex-1 pb-4 border-b border-slate-800 last:border-0">
                    <p className="text-sm font-bold text-white">{task.title}</p>
                    <p className={`text-[10px] uppercase tracking-widest mt-0.5 ${
                      task.priority === 'high' ? 'text-red-400' : 'text-slate-500'
                    }`}>{task.priority} Priority</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-600 italic text-center py-4">No upcoming tasks. Enjoy your break!</p>
              )}
            </div>
            <Link to="/planner" className="mt-4 block text-center py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all">
              Go to Planner
            </Link>
          </div>

          {/* Flashcards */}
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                Flashcards
              </h3>
              <Link to="/flashcards" className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="space-y-4">
              {flashcardDecks.length > 0 ? flashcardDecks.map((deck, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300 font-medium">{deck.title}</span>
                    <span className="text-slate-500">{deck.masteryPercentage}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500" style={{ width: `${deck.masteryPercentage}%` }} />
                  </div>
                </div>
              )) : (
                <p className="text-slate-400 text-sm">No flashcards yet.</p>
              )}
            </div>
          </div>

          {/* Study Rooms */}
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Study Rooms
              </h3>
              <Link to="/rooms" className="text-slate-500 hover:text-white transition-colors">
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            <div className="space-y-3">
              {studyRooms.length > 0 ? studyRooms.map((room, i) => (
                <Link to={`/rooms/${room.id}`} key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl border border-slate-800 hover:border-indigo-500/30 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${room.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-sm font-medium text-slate-200">{room.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{room.memberCount} members</span>
                </Link>
              )) : (
                <p className="text-xs text-slate-600 italic">No active rooms found.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* AI Insights */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">AI Insights</h2>
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-bold text-indigo-400">AI Predictions</h3>
          </div>
          <p className="text-slate-400 text-xs mb-6">Highly probable topics for your next exam based on board trends.</p>
          <div className="space-y-3">
            {predictions.length > 0 && predictions[0].predictedTopics ? (
              predictions[0].predictedTopics.slice(0, 3).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
                  <span className="text-sm text-slate-200">{item.topic}</span>
                  <span className="text-xs font-bold text-indigo-400">{item.probability}%</span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-sm">No predictions yet.</p>
            )}
          </div>
          <Link to="/predictions" className="mt-6 block text-center py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all">
            View All Predictions
          </Link>
        </div>
      </section>
    </div>
  );
}
