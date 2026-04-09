import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../lib/AuthContext';
import { getRoomMessages, saveRoomMessage, RoomMessage, getUserFlashcards } from '../lib/firebaseService';
import { Send, Users, FileText, Pencil, Eraser, Download, ArrowLeft, MessageSquare, Share2, Layers, X, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { Stage, Layer, Line } from 'react-konva';

type RoomUser = {
  id: string;
  name: string;
  socketId: string;
};

type FlashcardMessage = {
  type: 'flashcard';
  question: string;
  answer: string;
};

type FlashcardsMessage = {
  type: 'flashcards';
  cards: Array<{
    question: string;
    answer: string;
  }>;
};

type SavedFlashcard = {
  id: string;
  question: string;
  answer: string;
};

type SharedResource = {
  type: 'image' | 'pdf' | 'link';
  url?: string;
  file?: string;
  name?: string;
  user?: {
    id: string;
    name: string;
  };
  timestamp?: Date | string;
};

const normalizeRoomUsers = (payload: unknown): RoomUser[] => {
  const candidateUsers = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { users?: unknown[] } | null)?.users)
      ? (payload as { users: unknown[] }).users
      : [];

  return candidateUsers
    .map((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return null;
      }

      const roomUser = candidate as {
        id?: string;
        userId?: string;
        socketId?: string;
        name?: string;
        userName?: string;
        username?: string;
      };

      const socketId = roomUser.socketId || roomUser.id || roomUser.userId;
      const id = roomUser.id || roomUser.userId || socketId;
      const name = roomUser.name || roomUser.userName || roomUser.username || 'Anonymous';

      return id && socketId ? { id, name, socketId } : null;
    })
    .filter((roomUser): roomUser is RoomUser => roomUser !== null);
};

const socketServerUrl = import.meta.env.VITE_SOCKET_SERVER_URL || window.location.origin;

const isFlashcardMessage = (value: RoomMessage['text']): value is FlashcardMessage =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'flashcard' &&
    'question' in value &&
    'answer' in value,
  );

const isFlashcardsMessage = (value: RoomMessage['text']): value is FlashcardsMessage =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'flashcards' &&
    'cards' in value &&
    Array.isArray(value.cards),
  );

const getUrlsFromText = (text: string) => text.match(/https?:\/\/[^\s]+/g) ?? [];

const formatMessage = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-300 underline underline-offset-2 break-all"
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};

export default function RoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [resources, setResources] = useState<SharedResource[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [savedFlashcards, setSavedFlashcards] = useState<SavedFlashcard[]>([]);
  const [showFlashcardPicker, setShowFlashcardPicker] = useState(false);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<'link' | 'image' | 'pdf'>('link');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard'>('chat');
  
  // Whiteboard state
  const [lines, setLines] = useState<any[]>([]);
  const isDrawing = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#6366f1');

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('receiveMessage', (newMessage: RoomMessage) => {
      setMessages((prev) => [...prev, { ...newMessage, type: newMessage.type || 'text' }]);
    });

    socket.on('message', (msg: RoomMessage) => {
      setMessages((prev) => [...prev, { ...msg, type: msg.type || 'text' }]);
    });

    socket.on('roomUsers', (payload: unknown) => {
      setUsers(normalizeRoomUsers(payload));
    });

    socket.on('newResource', (resource: SharedResource) => {
      setResources((prev) => [...prev, resource]);
    });

    socket.on('whiteboard-update', (newLines: any[]) => {
      setLines(newLines);
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('message');
      socket.off('roomUsers');
      socket.off('newResource');
      socket.off('whiteboard-update');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    setMessages([]);
    setResources([]);
    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    if (!user) return;

    getUserFlashcards(user.uid)
      .then((flashcards) => {
        setSavedFlashcards(
          flashcards
            .filter((flashcard) => flashcard.id)
            .map((flashcard) => ({
              id: flashcard.id as string,
              question: flashcard.question,
              answer: flashcard.answer,
            })),
        );
      })
      .catch((error) => {
        console.error('Error fetching shareable flashcards:', error);
      });
  }, [user]);

  useEffect(() => {
    if (!socketRef.current || !roomId || !user) return;

    const currentUser = {
      id: user.uid,
      name: user.displayName || 'Anonymous',
    };

    socketRef.current.emit('joinRoom', {
      roomId,
      user: currentUser,
    });

    return () => {
      socketRef.current?.emit('leaveRoom', { roomId });
    };
  }, [roomId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    if (!roomId) return;
    const historicalMessages = await getRoomMessages(roomId);
    setMessages(historicalMessages);
  };

  const emitResource = (resource: SharedResource) => {
    if (!socketRef.current || !roomId || (!resource.url?.trim() && !resource.file?.trim())) {
      return;
    }

    socketRef.current.emit('sendResource', {
      roomId,
      resource: {
        ...resource,
        user: user ? { id: user.uid, name: user.displayName || 'Anonymous' } : resource.user,
      },
    });
  };

  const convertFileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Failed to read file'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !roomId) return;

    const trimmedMessage = newMessage.trim();
    if (!socketRef.current) return;

    const messageData: Omit<RoomMessage, 'id' | 'createdAt'> = {
      roomId,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      text: trimmedMessage,
      type: 'text',
    };

    try {
      socketRef.current.emit('sendMessage', {
        roomId,
        message: trimmedMessage,
        user: {
          id: user.uid,
          name: user.displayName || 'Anonymous',
        },
      });

      setNewMessage('');

      getUrlsFromText(trimmedMessage).forEach((url) => {
        emitResource({
          type: 'link',
          url,
          name: url,
        });
      });

      // Save to Firebase
      await saveRoomMessage(messageData);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const toggleFlashcardSelection = (flashcardId: string) => {
    setSelectedFlashcardIds((prev) =>
      prev.includes(flashcardId)
        ? prev.filter((id) => id !== flashcardId)
        : [...prev, flashcardId],
    );
  };

  const handleShareFlashcards = async () => {
    if (!socketRef.current || !roomId || !user) return;

    const selectedCards = savedFlashcards.filter((flashcard) => selectedFlashcardIds.includes(flashcard.id));
    if (selectedCards.length === 0) {
      return;
    }

    const flashcardMessage: FlashcardMessage | FlashcardsMessage = selectedCards.length === 1
      ? {
          type: 'flashcard',
          question: selectedCards[0].question,
          answer: selectedCards[0].answer,
        }
      : {
          type: 'flashcards',
          cards: selectedCards.map((flashcard) => ({
            question: flashcard.question,
            answer: flashcard.answer,
          })),
        };

    const messageData: Omit<RoomMessage, 'id' | 'createdAt'> = {
      roomId,
      userId: user.uid,
      userName: user.displayName || 'Anonymous',
      text: flashcardMessage,
      type: flashcardMessage.type,
    };

    try {
      socketRef.current.emit('sendMessage', {
        roomId,
        message: flashcardMessage,
        user: {
          id: user.uid,
          name: user.displayName || 'Anonymous',
        },
      });

      setShowFlashcardPicker(false);
      setSelectedFlashcardIds([]);
      await saveRoomMessage(messageData);
    } catch (error) {
      console.error('Error sharing flashcard:', error);
    }
  };

  const handleSendResource = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (resourceType === 'link') {
        const trimmedUrl = resourceUrl.trim();
        if (!trimmedUrl) {
          return;
        }

        emitResource({
          type: resourceType,
          url: trimmedUrl,
          name: resourceName.trim() || trimmedUrl,
        });
      } else {
        if (!resourceFile) {
          return;
        }

        const fileData = await convertFileToDataUrl(resourceFile);
        emitResource({
          type: resourceType,
          file: fileData,
          name: resourceName.trim() || resourceFile.name,
        });
      }

      setResourceUrl('');
      setResourceName('');
      setResourceFile(null);
    } catch (error) {
      console.error('Error sharing resource:', error);
    }
  };

  // Whiteboard handlers
  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;

    setLines((prev) => [...prev, { tool, color, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;

    setLines((prev) => {
      const lastLine = prev[prev.length - 1];
      if (!lastLine) {
        return prev;
      }

      const nextLines = [
        ...prev.slice(0, -1),
        {
          ...lastLine,
          points: [...lastLine.points, point.x, point.y],
        },
      ];

      if (socketRef.current) {
        socketRef.current.emit('whiteboard-draw', { roomId, lines: nextLines });
      }

      return nextLines;
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing.current) {
      return;
    }

    isDrawing.current = false;
  };

  const clearWhiteboard = () => {
    setLines([]);
    if (socketRef.current) {
      socketRef.current.emit('whiteboard-draw', { roomId, lines: [] });
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
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                      {isFlashcardMessage(msg.text) ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            <Layers className="w-3.5 h-3.5" />
                            Shared Flashcard
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase opacity-70">Question</p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{msg.text.question}</p>
                          </div>
                          <div className="border-t border-white/10 pt-2">
                            <p className="text-[10px] font-bold uppercase opacity-70">Answer</p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{msg.text.answer}</p>
                          </div>
                        </div>
                      ) : isFlashcardsMessage(msg.text) ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            <Layers className="w-3.5 h-3.5" />
                            Shared Flashcards
                          </div>
                          {msg.text.cards.map((card, index) => (
                            <div key={`${card.question}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[10px] font-bold uppercase opacity-70">Question</p>
                              <p className="mt-1 whitespace-pre-wrap break-words">{card.question}</p>
                              <p className="mt-3 text-[10px] font-bold uppercase opacity-70">Answer</p>
                              <p className="mt-1 whitespace-pre-wrap break-words">{card.answer}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">{formatMessage(String(msg.text || ''))}</div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFlashcardIds([]);
                    setShowFlashcardPicker(true);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-xl transition-all flex items-center gap-2"
                >
                  <Layers className="w-4 h-4" />
                  Share Flashcard
                </button>
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
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
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
              {users.length > 0 ? users.map((roomUser) => (
                <div key={roomUser.socketId} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                    {roomUser.name?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {roomUser.id === user?.uid ? 'You' : roomUser.name}
                    </p>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase">Online</p>
                  </div>
                </div>
              )) : (
                <div className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-xl border border-slate-800">
                  <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-xs font-bold text-white">
                    {user?.displayName?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{user?.displayName || 'You'}</p>
                    <p className="text-[10px] text-emerald-500 font-bold uppercase">Online</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#0d1425] border border-slate-800 rounded-3xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-emerald-500" />
              Shared Resources
            </h3>
            <div className="space-y-4">
              <div className="flex gap-2">
                {(['link', 'image', 'pdf'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setResourceType(type);
                      setResourceUrl('');
                      setResourceName('');
                      setResourceFile(null);
                    }}
                    className={`rounded-xl px-3 py-2 text-xs font-bold uppercase transition-all ${
                      resourceType === type ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendResource} className="space-y-3">
                {resourceType === 'link' ? (
                  <input
                    type="url"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="Link URL"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                ) : (
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept={resourceType === 'image' ? 'image/*' : 'application/pdf'}
                      onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                    />
                    {resourceFile && (
                      <p className="text-xs text-slate-400">Selected: {resourceFile.name}</p>
                    )}
                  </div>
                )}
                <input
                  type="text"
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                  placeholder="Optional display name"
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
                <button
                  type="submit"
                  disabled={resourceType === 'link' ? !resourceUrl.trim() : !resourceFile}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
                >
                  Share Resource
                </button>
              </form>

              <div className="space-y-3">
                {resources.length > 0 ? resources.map((resource, index) => (
                  <div key={`${resource.file || resource.url}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {resource.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : resource.type === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                      {resource.type}
                      <span className="text-slate-600">•</span>
                      <span>{resource.user?.name || 'Shared in room'}</span>
                    </div>

                    {resource.type === 'image' ? (
                      <a href={resource.file} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={resource.file} alt={resource.name || 'Shared image'} className="max-h-44 w-full rounded-xl object-cover" />
                      </a>
                    ) : resource.type === 'pdf' ? (
                      <a href={resource.file} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-sky-300 underline underline-offset-2 break-all">
                        <FileText className="w-4 h-4" />
                        {resource.name || 'Shared PDF'}
                      </a>
                    ) : (
                      <a href={resource.url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-300 underline underline-offset-2 break-all">
                        {resource.name || resource.url}
                      </a>
                    )}
                  </div>
                )) : (
                  <div className="p-4 bg-slate-900/50 border border-slate-800 border-dashed rounded-2xl text-center">
                    <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No shared resources yet. Upload an image or PDF, or add a link to share it with the room.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFlashcardPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#0d1425] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Share Flashcard</h2>
                <p className="text-sm text-slate-400">Pick one of your saved flashcards to send into the room.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFlashcardIds([]);
                  setShowFlashcardPicker(false);
                }}
                className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {savedFlashcards.length > 0 ? savedFlashcards.map((flashcard) => (
                <button
                  key={flashcard.id}
                  type="button"
                  onClick={() => toggleFlashcardSelection(flashcard.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedFlashcardIds.includes(flashcard.id)
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/60 hover:border-indigo-500/50 hover:bg-slate-900'
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-400">Question</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-white">{flashcard.question}</p>
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-emerald-400">Answer</p>
                  <p className="mt-1 line-clamp-3 text-sm text-slate-300">{flashcard.answer}</p>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
                  <p className="text-sm text-slate-400">No saved flashcards found yet. Create some in the Flashcards page first.</p>
                </div>
              )}
            </div>

            {savedFlashcards.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-400">{selectedFlashcardIds.length} selected</p>
                <button
                  type="button"
                  onClick={handleShareFlashcards}
                  disabled={selectedFlashcardIds.length === 0}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
                >
                  Share Selected
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
