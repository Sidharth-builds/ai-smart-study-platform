import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Sparkles, X, ChevronLeft, ChevronRight, RotateCw, Download, FileText, Upload, Link, Youtube, Check, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateFlashcards } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { COLLECTIONS } from '../lib/firebaseService';
import { getFlashcardDecks } from '../services/flashcardService';
import { jsPDF } from 'jspdf';

interface Flashcard {
  id?: string;
  front: string;
  back: string;
  mastered: boolean;
}

interface Deck {
  id: string;
  title: string;
  cards: Flashcard[];
  createdAt: Timestamp;
}

export default function Flashcards() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [inputType, setInputType] = useState<'text' | 'file' | 'url' | 'youtube'>('text');
  const [textInput, setTextInput] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDecks();
    }
  }, [user]);

  useEffect(() => {
    if (fileInput && (fileInput.type === 'image/jpeg' || fileInput.type === 'image/png')) {
      const url = URL.createObjectURL(fileInput);
      setFilePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFilePreview(null);
    }
  }, [fileInput]);

  const fetchDecks = async () => {
    if (!user) return;
    try {
      const fetchedDecks = await getFlashcardDecks(user.uid);
      setDecks(fetchedDecks);
    } catch (error) {
      console.error("Error fetching decks:", error);
    } finally {
      setDecksLoading(false);
    }
  };

  const extractTextFromInput = async (): Promise<string> => {
    switch (inputType) {
      case 'text':
        return textInput;
      case 'file':
        if (!fileInput) throw new Error('No file selected');
        if (fileInput.type === 'application/pdf') {
          // For PDF, try to read as text (basic implementation)
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const text = e.target?.result as string;
              resolve(text);
            };
            reader.onerror = () => reject(new Error('Failed to read PDF'));
            reader.readAsText(fileInput);
          });
        } else if (fileInput.type.startsWith('image/')) {
          // For images, placeholder - would need OCR
          return `Image file: ${fileInput.name} - OCR not implemented yet`;
        } else {
          return `Unsupported file: ${fileInput.name}`;
        }
      case 'url':
        const response = await fetch(urlInput);
        return await response.text();
      case 'youtube':
        return `YouTube video: ${youtubeInput}`;
      default:
        return '';
    }
  };

  const handleGenerateCards = async () => {
    setLoading(true);
    try {
      const text = await extractTextFromInput();
      if (!text.trim()) throw new Error('No content to generate flashcards from');

      const generatedCards = await generateFlashcards(text);
      const cardsWithMastered = generatedCards.map(card => ({ ...card, mastered: false }));

      setCards(cardsWithMastered);
      setShowGenerator(false);
      setShowPractice(true);
      setCurrentIndex(0);
      setIsFlipped(false);

      // Save individual flashcards to Firestore
      if (user) {
        const savePromises = cardsWithMastered.map(card =>
          addDoc(collection(db, COLLECTIONS.FLASHCARDS), {
            userId: user.uid,
            question: card.front,
            answer: card.back,
            mastered: false,
            createdAt: Timestamp.now(),
          })
        );
        const docRefs = await Promise.all(savePromises);
        // Add ids to cards
        const cardsWithIds = cardsWithMastered.map((card, index) => ({
          ...card,
          id: docRefs[index].id
        }));
        setCards(cardsWithIds);
        // Refresh decks
        fetchDecks();
      }
    } catch (error) {
      console.error("Error generating cards:", error);
      alert(`Failed to generate flashcards: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const markAsMastered = async (cardId: string, mastered: boolean) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.FLASHCARDS, cardId), { mastered: !mastered });
      setCards(prev => prev.map(card => 
        card.id === cardId ? { ...card, mastered: !mastered } : card
      ));
      fetchDecks(); // Update deck mastery
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const deleteCard = async (cardId: string) => {
    if (!window.confirm('Are you sure you want to delete this flashcard?')) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.FLASHCARDS, cardId));
      setCards(prev => prev.filter(card => card.id !== cardId));
      if (cards.length === 1) {
        setShowPractice(false);
      } else if (currentIndex >= cards.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
      fetchDecks();
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const startEdit = (card: Flashcard) => {
    setEditingCard(card.id!);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const saveEdit = async () => {
    if (editingCard) {
      try {
        await updateDoc(doc(db, COLLECTIONS.FLASHCARDS, editingCard), { 
          question: editFront, 
          answer: editBack 
        });
        setCards(prev => prev.map(card => 
          card.id === editingCard ? { ...card, front: editFront, back: editBack } : card
        ));
        setEditingCard(null);
      } catch (error) {
        console.error('Error updating card:', error);
      }
    }
  };

  const cancelEdit = () => {
    setEditingCard(null);
  };

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % cards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    }, 150);
  };

  const exportToPDF = () => {
    if (cards.length === 0) return;
    
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("AI Generated Flashcards", 20, 20);
    
    doc.setFontSize(12);
    cards.forEach((card, index) => {
      const yPos = 40 + (index * 40);
      if (yPos > 270) {
        doc.addPage();
        doc.text("AI Generated Flashcards (cont.)", 20, 20);
      }
      doc.setFont("helvetica", "bold");
      doc.text(`Q${index + 1}: ${card.front}`, 20, yPos % 270 || 40);
      doc.setFont("helvetica", "normal");
      doc.text(`A: ${card.back}`, 25, (yPos % 270 || 40) + 10, { maxWidth: 160 });
    });
    
    doc.save("flashcards.pdf");
  };

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Flashcards</h1>
          <p className="text-slate-400">Master concepts with AI-powered active recall.</p>
        </div>
        <div className="flex gap-3">
          {cards.length > 0 && showPractice && (
            <button 
              onClick={exportToPDF}
              className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all"
            >
              <Download className="w-5 h-5" />
              Export PDF
            </button>
          )}
          <button 
            onClick={() => setShowGenerator(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Sparkles className="w-5 h-5" />
            AI Generate
          </button>
        </div>
      </header>

      {!showPractice ? (
        <>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search your decks..."
              className="w-full bg-[#0d1425] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decksLoading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400">Loading decks...</p>
              </div>
            ) : decks.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400">No decks yet. Generate your first flashcards!</p>
              </div>
            ) : (
              decks.map((deck) => {
                const totalCards = deck.cards.length;
                const masteredCards = deck.cards.filter(c => c.mastered).length;
                const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
                return (
                  <div key={deck.id} className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-indigo-600/10 p-3 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                        <Layers className="w-6 h-6 text-indigo-500" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {masteryPercentage}% Mastered
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">{deck.title}</h3>
                    <p className="text-slate-400 text-sm mb-6">{totalCards} cards total</p>
                    
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full" 
                        style={{ width: `${masteryPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <button onClick={() => setShowPractice(false)} className="text-slate-400 hover:text-white flex items-center gap-2">
              <ChevronLeft className="w-5 h-5" /> Back to Decks
            </button>
            <span className="text-slate-500 font-bold">Card {currentIndex + 1} of {cards.length}</span>
          </div>

          <div 
            className="perspective-1000 cursor-pointer h-[400px]"
            onClick={() => setIsFlipped(!isFlipped)}
          >
            <motion.div 
              className="relative w-full h-full transition-all duration-500 preserve-3d"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
            >
              {/* Front */}
              <div className="absolute inset-0 w-full h-full bg-[#0d1425] border-2 border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl">
                <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">Question</p>
                {editingCard === cards[currentIndex].id ? (
                  <textarea
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    className="w-full h-32 bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-xl resize-none"
                    placeholder="Enter question..."
                  />
                ) : (
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{cards[currentIndex].front}</h2>
                )}
                <div className="absolute bottom-8 text-slate-500 flex items-center gap-2 text-sm">
                  <RotateCw className="w-4 h-4" /> Click to flip
                </div>
              </div>

              {/* Back */}
              <div className="absolute inset-0 w-full h-full bg-indigo-600 border-2 border-indigo-500 rounded-3xl p-12 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 shadow-2xl">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">Answer</p>
                {editingCard === cards[currentIndex].id ? (
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    className="w-full h-32 bg-indigo-700 border border-indigo-400 rounded-lg p-3 text-white text-xl resize-none"
                    placeholder="Enter answer..."
                  />
                ) : (
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{cards[currentIndex].back}</h2>
                )}
              </div>
            </motion.div>
          </div>

          <div className="flex justify-center gap-6">
            <button onClick={prevCard} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={nextCard} className="p-4 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-all">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="flex justify-center gap-4 flex-wrap">
            {editingCard === cards[currentIndex].id ? (
              <>
                <button 
                  onClick={saveEdit}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button 
                  onClick={cancelEdit}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => markAsMastered(cards[currentIndex].id!, cards[currentIndex].mastered)}
                  className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${
                    cards[currentIndex].mastered 
                      ? 'bg-yellow-600 hover:bg-yellow-500 text-white' 
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  {cards[currentIndex].mastered ? 'Unmark Mastered' : 'Mark Mastered'}
                </button>
                <button 
                  onClick={() => startEdit(cards[currentIndex])}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button 
                  onClick={() => deleteCard(cards[currentIndex].id!)}
                  className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#0d1425] border border-slate-800 rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Generate Flashcards</h2>
              <button 
                onClick={() => setShowGenerator(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Input Type Tabs */}
            <div className="flex gap-2 mb-6">
              {[
                { type: 'text', label: 'Text', icon: FileText },
                { type: 'file', label: 'File', icon: Upload },
                { type: 'url', label: 'URL', icon: Link },
                { type: 'youtube', label: 'YouTube', icon: Youtube }
              ].map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setInputType(type as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                    inputType === type
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Input Fields */}
            <div className="space-y-4 mb-6">
              {inputType === 'text' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Study Material</label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your study material here..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-[200px] resize-none"
                  />
                </div>
              )}

              {inputType === 'file' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Upload File</label>
                  <div
                    className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-indigo-500/50 transition-colors cursor-pointer"
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (files.length > 0) {
                        const file = files[0];
                        if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') {
                          setFileInput(file);
                        } else {
                          alert('Please upload a PDF, JPG, or PNG file.');
                        }
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">
                      Drag & drop a PDF, JPG, or PNG file here
                    </p>
                    <p className="text-slate-500 text-sm">or</p>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setFileInput(file);
                      }}
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

                  {fileInput && (
                    <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-800">
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
                            <p className="text-white font-bold">{fileInput.name}</p>
                            <p className="text-slate-400 text-sm">{(fileInput.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setFileInput(null)}
                          className="text-red-400 hover:text-red-300 p-1"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {inputType === 'url' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Website URL</label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/article"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              )}

              {inputType === 'youtube' && (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">YouTube Video URL</label>
                  <input
                    type="url"
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowGenerator(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleGenerateCards}
                disabled={loading || (inputType === 'text' && !textInput.trim()) || (inputType === 'file' && !fileInput) || (inputType === 'url' && !urlInput.trim()) || (inputType === 'youtube' && !youtubeInput.trim())}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RotateCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loading ? 'Generating...' : 'Generate Cards'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
