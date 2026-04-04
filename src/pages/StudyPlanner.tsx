import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle2, Circle, Clock, AlertCircle, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getStudyTasks, addStudyTask, updateStudyTask, deleteStudyTask, StudyTask } from '../lib/firebaseService';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

export default function StudyPlanner() {
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    try {
      const fetchedTasks = await getStudyTasks(user.uid);
      setTasks(fetchedTasks);
    } catch (error: any) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskTitle.trim()) return;

    try {
      await addStudyTask({
        userId: user.uid,
        title: newTaskTitle,
        date: newTaskDate,
        completed: false,
        priority: newTaskPriority,
      });
      setNewTaskTitle('');
      fetchTasks();
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const toggleTask = async (task: StudyTask) => {
    if (!task.id) return;
    try {
      const newStatus = !task.completed;
      await updateStudyTask(task.id, { completed: newStatus });
      
      if (newStatus) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#818cf8', '#a5b4fc']
        });
      }
      
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDelete = async (taskId?: string) => {
    if (!taskId) return;
    try {
      console.log("Deleting task:", taskId);
      await deleteStudyTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white">Study Planner</h1>
          <p className="text-slate-400">Organize your sessions and track your academic progress.</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
            <TrendingUp className="w-4 h-4" />
            <span>{progress}% Complete</span>
          </div>
          <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-emerald-500"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Add Task Form */}
        <div className="lg:col-span-1">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6 sticky top-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-500" />
              New Study Task
            </h3>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Task Title</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Review Graph Algorithms"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Target Date</label>
                <input 
                  type="date" 
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={`py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                        newTaskPriority === p 
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-500/50' 
                          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 mt-4"
              >
                <Plus className="w-5 h-5" />
                Add Task
              </button>
            </form>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" />
                Upcoming Tasks
              </h3>
              <span className="text-xs font-bold text-slate-500">{tasks.length} Total Tasks</span>
            </div>
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                </div>
              ) : tasks.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {tasks.map((task) => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={task.id}
                        className={`group p-4 rounded-xl border transition-all flex items-center gap-4 ${
                          task.completed 
                            ? 'bg-slate-900/30 border-slate-800/50 opacity-60' 
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <button 
                          onClick={() => toggleTask(task)}
                          className={`shrink-0 transition-colors ${
                            task.completed ? 'text-emerald-500' : 'text-slate-600 hover:text-indigo-400'
                          }`}
                        >
                          {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                        </button>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium truncate ${task.completed ? 'text-slate-500 line-through' : 'text-white'}`}>
                            {task.title}
                          </h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock className="w-3 h-3" />
                              {new Date(task.date).toLocaleDateString()}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              task.priority === 'high' ? 'text-red-400 border-red-500/20 bg-red-500/5' :
                              task.priority === 'medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/5' :
                              'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                            }`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-600 hover:text-red-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-700" />
                  </div>
                  <h4 className="text-white font-bold mb-1">No tasks planned</h4>
                  <p className="text-slate-500 text-sm">Start by adding your first study task to the planner.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-indigo-600/5 border border-indigo-500/10 rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h4 className="text-white font-bold text-sm mb-1">Study Tip</h4>
              <p className="text-slate-400 text-xs leading-relaxed">
                Break down large subjects into 45-minute focused tasks. Research shows that shorter, high-intensity study sessions with 5-minute breaks are more effective for long-term retention.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
