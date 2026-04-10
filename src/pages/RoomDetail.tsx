import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Stage, Layer, Line } from 'react-konva';
import { ArrowLeft, Download, Eraser, FileText, Image as ImageIcon, Layers, Link as LinkIcon, MessageSquare, Pencil, Send, Share2, Users, X } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { getRoomMessages, getUserFlashcards, RoomMessage, saveRoomMessage } from '../lib/firebaseService';

type RoomUser = {
  id: string;
  name: string;
  socketId: string;
};

type StandardMessage = Extract<RoomMessage['message'], { content: string }>;
type FlashcardMessage = Extract<RoomMessage['message'], { type: 'flashcard' }>;
type FlashcardsMessage = Extract<RoomMessage['message'], { type: 'flashcards' }>;

type SavedFlashcard = {
  id: string;
  question: string;
  answer: string;
};

const socketServerUrl = import.meta.env.VITE_SOCKET_SERVER_URL;

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

const isStandardMessage = (message: RoomMessage['message']): message is StandardMessage =>
  Boolean(message && typeof message === 'object' && 'content' in message);

const isFlashcardMessage = (message: RoomMessage['message']): message is FlashcardMessage =>
  Boolean(message && typeof message === 'object' && 'type' in message && message.type === 'flashcard');

const isFlashcardsMessage = (message: RoomMessage['message']): message is FlashcardsMessage =>
  Boolean(message && typeof message === 'object' && 'type' in message && message.type === 'flashcards' && 'cards' in message);

const isResourceMessage = (message: RoomMessage) =>
  isStandardMessage(message.message) &&
  (message.message.type === 'image' || message.message.type === 'pdf' || message.message.type === 'link');

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
          className="text-blue-400 underline break-all"
        >
          {part}
        </a>
      );
    }

    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
};

const getMessageTimestamp = (message: RoomMessage) => {
  const candidate = message.time;
  if (!candidate) {
    return '';
  }

  if (typeof candidate === 'object' && 'toMillis' in candidate && typeof candidate.toMillis === 'function') {
    return String(candidate.toMillis());
  }

  return String(candidate instanceof Date ? candidate.getTime() : candidate);
};

const getMessageKey = (message: RoomMessage) =>
  JSON.stringify({
    roomId: message.roomId,
    userId: message.user.id,
    userName: message.user.name,
    message: message.message,
    time: getMessageTimestamp(message),
  });

const mergeMessages = (current: RoomMessage[], incoming: RoomMessage[]) => {
  const seen = new Set(current.map(getMessageKey));
  const merged = [...current];

  incoming.forEach((message) => {
    const key = getMessageKey(message);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(message);
    }
  });

  return merged.sort((left, right) => {
    const leftTime = Number(getMessageTimestamp(left)) || 0;
    const rightTime = Number(getMessageTimestamp(right)) || 0;
    return leftTime - rightTime;
  });
};

export default function RoomDetail() {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [savedFlashcards, setSavedFlashcards] = useState<SavedFlashcard[]>([]);
  const [showFlashcardPicker, setShowFlashcardPicker] = useState(false);
  const [selectedFlashcardIds, setSelectedFlashcardIds] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState<'link' | 'image' | 'pdf'>('link');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'whiteboard'>('chat');
  const [lines, setLines] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#6366f1');

  const socketRef = useRef<Socket | null>(null);
  const isDrawing = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!socketServerUrl) {
      console.error('Missing VITE_SOCKET_SERVER_URL');
      return;
    }

    const nextSocket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      withCredentials: true,
    });

    setSocket(nextSocket);
    socketRef.current = nextSocket;

    return () => {
      setSocket(null);
      nextSocket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.on('connect', () => {
      console.log('CONNECTED:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('DISCONNECTED');
    });

    socket.on('receive-message', (msg: Omit<RoomMessage, 'roomId'>) => {
      console.log(msg);
      setMessages((prev) => [...prev, { ...msg, roomId }]);
    });

    socket.on('room-users', (roomUsers: unknown) => {
      setUsers(normalizeRoomUsers(roomUsers));
    });

    socket.on('whiteboard-update', (newLines: any[]) => {
      setLines(newLines);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('receive-message');
      socket.off('room-users');
      socket.off('whiteboard-update');
    };
  }, [socket, roomId]);

  useEffect(() => {
    if (!roomId) return;

    let isActive = true;
    setMessages([]);

    const loadMessages = async () => {
      const historicalMessages = await getRoomMessages(roomId);
      if (!isActive) {
        return;
      }

      setMessages((prev) => mergeMessages(prev, historicalMessages));
    };

    loadMessages().catch((error) => {
      console.error('Error loading room messages:', error);
    });

    return () => {
      isActive = false;
    };
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
    if (!socket || !roomId || !user) return;

    socket.emit('join-room', {
      roomId,
      user: {
        id: user.uid,
        name: user.displayName || 'Anonymous',
      },
    });

    return () => {
      socket.emit('leave-room', { roomId });
    };
  }, [socket, roomId, user?.uid, user?.displayName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const persistAndEmitMessage = async (message: RoomMessage['message']) => {
    if (!socketRef.current || !roomId || !user) return;

    const payload = {
      roomId,
      message,
      user: {
        id: user.uid,
        name: user.displayName || 'Anonymous',
      },
    };

    socketRef.current.emit('send-message', payload);
    await saveRoomMessage(payload);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await persistAndEmitMessage({
        type: 'text',
        content: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSendResource = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (resourceType === 'link') {
        const trimmedUrl = resourceUrl.trim();
        if (!trimmedUrl) return;

        await persistAndEmitMessage({
          type: 'link',
          content: trimmedUrl,
          name: resourceName.trim() || trimmedUrl,
        });
      } else {
        if (!resourceFile) return;

        if (resourceType === 'pdf') {
          // For PDFs, create a temporary link instead of base64
          const fileUrl = URL.createObjectURL(resourceFile);
          await persistAndEmitMessage({
            type: 'link',
            content: fileUrl,
            name: resourceName.trim() || resourceFile.name,
          });
        } else {
          // For images, keep the existing base64 approach
          const content = await convertFileToDataUrl(resourceFile);
          await persistAndEmitMessage({
            type: resourceType,
            content,
            name: resourceName.trim() || resourceFile.name,
          });
        }
      }

      setResourceUrl('');
      setResourceName('');
      setResourceFile(null);
    } catch (error) {
      console.error('Error sharing resource:', error);
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
    const selectedCards = savedFlashcards.filter((flashcard) => selectedFlashcardIds.includes(flashcard.id));
    if (selectedCards.length === 0) return;

    const payload: RoomMessage['message'] = selectedCards.length === 1
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

    try {
      await persistAndEmitMessage(payload);
      setShowFlashcardPicker(false);
      setSelectedFlashcardIds([]);
    } catch (error) {
      console.error('Error sharing flashcard:', error);
    }
  };

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
    isDrawing.current = false;
  };

  const clearWhiteboard = () => {
    setLines([]);
    if (socketRef.current) {
      socketRef.current.emit('whiteboard-draw', { roomId, lines: [] });
    }
  };

  const sharedResources = messages.filter(isResourceMessage);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/rooms')} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
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
          <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'chat' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button onClick={() => setActiveTab('whiteboard')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'whiteboard' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            <Pencil className="w-4 h-4" />
            Whiteboard
          </button>
        </div>
      </header>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="flex-1 bg-[#0d1425] border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
          {activeTab === 'chat' ? (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, index) => (
                  <div key={`${getMessageKey(msg)}-${index}`} className={`flex flex-col ${msg.user.id === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.user.name}</span>
                    </div>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.user.id === user?.uid ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-300 border border-slate-800 rounded-tl-none'}`}>
                      {isFlashcardMessage(msg.message) ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            <Layers className="w-3.5 h-3.5" />
                            Shared Flashcard
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase opacity-70">Question</p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{msg.message.question}</p>
                          </div>
                          <div className="border-t border-white/10 pt-2">
                            <p className="text-[10px] font-bold uppercase opacity-70">Answer</p>
                            <p className="mt-1 whitespace-pre-wrap break-words">{msg.message.answer}</p>
                          </div>
                        </div>
                      ) : isFlashcardsMessage(msg.message) ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                            <Layers className="w-3.5 h-3.5" />
                            Shared Flashcards
                          </div>
                          {msg.message.cards.map((card, cardIndex) => (
                            <div key={`${card.question}-${cardIndex}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <p className="text-[10px] font-bold uppercase opacity-70">Question</p>
                              <p className="mt-1 whitespace-pre-wrap break-words">{card.question}</p>
                              <p className="mt-3 text-[10px] font-bold uppercase opacity-70">Answer</p>
                              <p className="mt-1 whitespace-pre-wrap break-words">{card.answer}</p>
                            </div>
                          ))}
                        </div>
                      ) : isStandardMessage(msg.message) && msg.message.type === 'image' ? (
                        <img src={msg.message.content} alt="shared" className="max-w-xs rounded-lg" />
                      ) : isStandardMessage(msg.message) && msg.message.type === 'pdf' ? (
                        <a href={msg.message.content} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">
                          PDF {msg.message.name || 'View PDF'}
                        </a>
                      ) : isStandardMessage(msg.message) && msg.message.type === 'link' ? (
                        <a href={msg.message.content} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">
                          {msg.message.content.startsWith('blob:') ? `📄 ${msg.message.name || msg.message.content}` : `Link ${msg.message.content}`}
                        </a>
                      ) : (
                        <div className="whitespace-pre-wrap break-words">
                          {isStandardMessage(msg.message) ? formatMessage(msg.message.content) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3">
                <button type="button" onClick={() => { setSelectedFlashcardIds([]); setShowFlashcardPicker(true); }} className="bg-slate-800 hover:bg-slate-700 text-white px-3 rounded-xl transition-all flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Share Flashcard
                </button>
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                <button type="submit" disabled={!newMessage.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 relative bg-slate-950 cursor-crosshair">
              <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 p-2 bg-[#0d1425] border border-slate-800 rounded-xl shadow-xl">
                <button onClick={() => setTool('pen')} className={`p-2 rounded-lg transition-all ${tool === 'pen' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
                  <Pencil className="w-5 h-5" />
                </button>
                <button onClick={() => setTool('eraser')} className={`p-2 rounded-lg transition-all ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}>
                  <Eraser className="w-5 h-5" />
                </button>
                <div className="h-px bg-slate-800 my-1" />
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0" />
                <button onClick={clearWhiteboard} className="p-2 rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all">
                  <Download className="w-5 h-5 rotate-180" />
                </button>
              </div>
              <Stage width={window.innerWidth - 400} height={window.innerHeight - 250} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                <Layer>
                  {lines.map((line, index) => (
                    <Line key={index} points={line.points} stroke={line.color} strokeWidth={5} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'} />
                  ))}
                </Layer>
              </Stage>
            </div>
          )}
        </div>

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
                    <p className="text-sm text-white font-medium truncate">{roomUser.id === user?.uid ? 'You' : roomUser.name}</p>
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
                  <button key={type} type="button" onClick={() => { setResourceType(type); setResourceUrl(''); setResourceName(''); setResourceFile(null); }} className={`rounded-xl px-3 py-2 text-xs font-bold uppercase transition-all ${resourceType === type ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
                    {type}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendResource} className="space-y-3">
                {resourceType === 'link' ? (
                  <input type="url" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} placeholder="Link URL" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                ) : (
                  <div className="space-y-2">
                    <input type="file" accept={resourceType === 'image' ? 'image/*' : 'application/pdf'} onChange={(e) => setResourceFile(e.target.files?.[0] ?? null)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white" />
                    {resourceFile ? <p className="text-xs text-slate-400">Selected: {resourceFile.name}</p> : null}
                  </div>
                )}
                <input type="text" value={resourceName} onChange={(e) => setResourceName(e.target.value)} placeholder="Optional display name" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                <button type="submit" disabled={resourceType === 'link' ? !resourceUrl.trim() : !resourceFile} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 disabled:opacity-50">
                  Share Resource
                </button>
              </form>

              <div className="space-y-3">
                {sharedResources.length > 0 ? sharedResources.map((resource, index) => {
                  const resourceMessage = resource.message as StandardMessage;

                  return (
                  <div key={`${getMessageKey(resource)}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      {resourceMessage.type === 'image' ? <ImageIcon className="w-3.5 h-3.5" /> : resourceMessage.type === 'pdf' ? <FileText className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                      {resourceMessage.type}
                      <span className="text-slate-600">|</span>
                      <span>{resource.user.name}</span>
                    </div>
                    {resourceMessage.type === 'image' ? (
                      <a href={resourceMessage.content} target="_blank" rel="noopener noreferrer" className="block">
                        <img src={resourceMessage.content} alt={resourceMessage.name || 'shared'} className="max-h-44 w-full rounded-xl object-cover" />
                      </a>
                    ) : resourceMessage.type === 'link' && resourceMessage.content.startsWith('blob:') ? (
                      <a href={resourceMessage.content} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">
                        📄 {resourceMessage.name || 'PDF'}
                      </a>
                    ) : (
                      <a href={resourceMessage.content} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline break-all">
                        Link {resourceMessage.content}
                      </a>
                    )}
                  </div>
                )}) : (
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

      {showFlashcardPicker ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-[#0d1425] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Share Flashcard</h2>
                <p className="text-sm text-slate-400">Pick one of your saved flashcards to send into the room.</p>
              </div>
              <button type="button" onClick={() => { setSelectedFlashcardIds([]); setShowFlashcardPicker(false); }} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {savedFlashcards.length > 0 ? savedFlashcards.map((flashcard) => (
                <button key={flashcard.id} type="button" onClick={() => toggleFlashcardSelection(flashcard.id)} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedFlashcardIds.includes(flashcard.id) ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-900/60 hover:border-indigo-500/50 hover:bg-slate-900'}`}>
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

            {savedFlashcards.length > 0 ? (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-400">{selectedFlashcardIds.length} selected</p>
                <button type="button" onClick={handleShareFlashcards} disabled={selectedFlashcardIds.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-indigo-500 disabled:opacity-50">
                  Share Selected
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
