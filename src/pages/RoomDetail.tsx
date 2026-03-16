import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../lib/AuthContext';
import { getRoomMessages, saveRoomMessage, RoomMessage } from '../lib/firebaseService';
import { Send, Users, FileText, Image as ImageIcon, Pencil, Eraser, Download, ArrowLeft, MessageSquare, Share2 } from 'lucide-react';
import { Stage, Layer, Line } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';

export default function RoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard'>('chat');
  
  // Whiteboard state
  const [lines, setLines] = useState<any[]>([]);
  const isDrawing = useRef(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#6366f1');

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId || !user) return;

    // Fetch historical messages
    fetchMessages();

    // Initialize Socket
    const newSocket = io(window.location.origin);
    setSocket(newSocket);

    newSocket.emit('join-room', roomId);

    newSocket.on('receive-message', (message: RoomMessage) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('whiteboard-update', (newLines: any[]) => {
      setLines(newLines);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    if (!roomId) return;
    const historicalMessages = await getRoomMessages(roomId);
    setMessages(historicalMessages);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newMessage.trim() || !user || !roomId) return;

    const messageData: Omit<RoomMessage, 'id' | 'createdAt'> = {
      roomId,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      text: newMessage,
      type: 'text',
    };

    try {
      // Save to Firebase
      await saveRoomMessage(messageData);
      
      // Emit via Socket
      socket.emit('send-message', { ...messageData, roomId });
      
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Whiteboard handlers
  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, color, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
    
    // Sync whiteboard
    if (socket) {
      socket.emit('whiteboard-draw', { roomId, lines });
    }
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const clearWhiteboard = () => {
    setLines([]);
    if (socket) {
      socket.emit('whiteboard-draw', { roomId, lines: [] });
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/rooms')}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Study Session</h1>
            <div className="flex items-center gap-2 text-slate-500 text-xs">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live Collaboration
            </div>
          </div>
        </div>
        <div className="flex bg-[#0d1425] border border-slate-800 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button 
            onClick={() => setActiveTab('whiteboard')}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'whiteboard' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Pencil className="w-4 h-4" />
            Whiteboard
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Main Content Area */}
        <div className="flex-1 bg-[#0d1425] border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          {activeTab === 'chat' ? (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex flex-col ${msg.userId === user?.uid ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.userName}</span>
                    </div>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      msg.userId === user?.uid 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-900 text-slate-300 border border-slate-800 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 relative bg-slate-950 cursor-crosshair">
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 bg-[#0d1425] border border-slate-800 rounded-xl shadow-xl">
                <button 
                  onClick={() => setTool('pen')}
                  className={`p-2 rounded-lg transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setTool('eraser')}
                  className={`p-2 rounded-lg transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                >
                  <Eraser className="w-5 h-5" />
                </button>
                <div className="h-px bg-slate-800 my-1" />
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <button 
                  onClick={clearWhiteboard}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                  <Download className="w-5 h-5 rotate-180" />
                </button>
              </div>
              
              <Stage
                width={window.innerWidth - 400}
                height={window.innerHeight - 250}
                onMouseDown={handleMouseDown}
                onMousemove={handleMouseMove}
                onMouseup={handleMouseUp}
              >
                <Layer>
                  {lines.map((line, i) => (
                    <Line
                      key={i}
                      points={line.points}
                      stroke={line.color}
                      strokeWidth={5}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        line.tool === 'eraser' ? 'destination-out' : 'source-over'
                      }
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 space-y-6">
          <div className="bg-[#0d1425] border border-slate-800 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              Active Members
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                  {user?.displayName?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{user?.displayName || 'You'}</p>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase">Online</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#0d1425] border border-slate-800 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-500" />
              Shared Resources
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl text-center">
                <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No files shared yet. Drag and drop to share with the group.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
