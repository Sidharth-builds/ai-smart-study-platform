import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, MessageSquare, ArrowRight, Lock, Globe, Hash, Trash2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getStudyRooms, createStudyRoom, StudyRoom } from '../lib/firebaseService';
import { deleteStudyRoom } from '../services/studyRoomService';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';

export default function StudyRooms() {
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomTopic, setNewRoomTopic] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user]);

  const fetchRooms = async () => {
    try {
      const fetchedRooms = await getStudyRooms();
      setRooms(fetchedRooms);
    } catch (error: any) {
      console.error("Error fetching rooms:", error);
      if (error.code === 'permission-denied') {
        setRooms([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRoomName.trim()) return;

    try {
      const roomId = await createStudyRoom({
        name: newRoomName,
        topic: newRoomTopic || 'General Study',
        memberCount: 1,
        isActive: true,
        createdBy: user.uid,
      });
      setShowCreateModal(false);
      navigate(`/rooms/${roomId}`);
    } catch (error) {
      console.error("Error creating room:", error);
    }
  };

  const handleDeleteRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigating to room
    if (window.confirm('Are you sure you want to delete this study room? This action cannot be undone.')) {
      try {
        await deleteStudyRoom(roomId);
        fetchRooms(); // Refresh the list
      } catch (error) {
        console.error("Error deleting room:", error);
        alert('Failed to delete the room. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Study Rooms</h1>
          <p className="text-slate-400">Join real-time collaborative sessions with students worldwide.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus className="w-5 h-5" />
          Create Room
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input 
          type="text" 
          placeholder="Search rooms by topic or name..."
          className="w-full bg-[#0d1425] border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-slate-900/50 border border-slate-800 rounded-2xl animate-pulse" />
          ))
        ) : rooms.map((room) => (
          <motion.div 
            key={room.id}
            whileHover={{ y: -4 }}
            className="bg-[#0d1425] border border-slate-800 rounded-2xl p-6 group hover:border-indigo-500/50 transition-all cursor-pointer"
            onClick={() => navigate(`/rooms/${room.id}`)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center">
                <Hash className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-bold border border-emerald-500/20">
                  <Globe className="w-3 h-3" />
                  PUBLIC
                </div>
                {user && user.uid === room.createdBy && (
                  <button
                    onClick={(e) => handleDeleteRoom(room.id!, e)}
                    className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete Room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-400 transition-colors">{room.name}</h3>
            <p className="text-slate-500 text-sm mb-6 line-clamp-1">{room.topic}</p>
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Users className="w-4 h-4" />
                <span>{room.memberCount} members</span>
              </div>
              <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold">
                Join Now
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d1425] border border-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Create Study Room</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Room Name</label>
                <input 
                  type="text" 
                  required
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="e.g. CS101 Finals Prep"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Primary Topic</label>
                <input 
                  type="text" 
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
                >
                  Create Room
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
