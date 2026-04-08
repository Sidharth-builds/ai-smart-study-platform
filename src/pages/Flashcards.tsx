import React, { useState, useEffect } from 'react';
import { Layers, Plus, Search, Sparkles, X, ChevronLeft, ChevronRight, RotateCw, Download, FileText, Upload, Link, Youtube, Check, Edit, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateFlashcards } from '../lib/gemini';
import { db } from '../lib/firebase';
import { collection, addDoc, Timestamp, updateDoc, doc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../lib/AuthContext';
import { jsPDF } from 'jspdf';
import { extractMeaningfulTextFromHtml, extractTextFromPdfFile } from '../lib/documentProcessing';

interface Flashcard {
  id?: string;
  front: string;
  back: string;
  mastered: boolean;
}

export default function Flashcards() {
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [savedFlashcards, setSavedFlashcards] = useState<Flashcard[]>([]);
  const [flashcardsLoading, setFlashcardsLoading] = useState(true);
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
      fetchFlashcards();
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

  const fetchFlashcards = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'Flashcards'),
        where('userId', '==', user.uid),
      );
      const snapshot = await getDocs(q);
      const flashcards = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data() as {
          question?: string;
          answer?: string;
          front?: string;
          back?: string;
          mastered?: boolean;
        };

        return {
          id: docSnapshot.id,
          front: data.question ?? data.front ?? '',
          back: data.answer ?? data.back ?? '',
          mastered: Boolean(data.mastered),
        };
      });

      setSavedFlashcards(flashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const saveGeneratedCards = async (generatedCards: Flashcard[]) => {
    if (!user) {
      console.error('User not logged in');
      return generatedCards;
    }

    try {
      const savePromises = generatedCards.map((card) =>
        addDoc(collection(db, 'Flashcards'), {
          userId: user.uid,
          question: card.front,
          answer: card.back,
          mastered: Boolean(card.mastered),
          createdAt: Timestamp.now(),
        }),
      );

      const docRefs = await Promise.all(savePromises);
      console.log('Flashcards saved successfully');

      return generatedCards.map((card, index) => ({
        ...card,
        id: docRefs[index].id,
      }));
    } catch (error) {
      console.error('Error saving flashcards:', error);
      return generatedCards;
    }
  };

  const extractTextFromInput = async (): Promise<string> => {
    switch (inputType) {
      case 'text':
        return textInput;
      case 'file':
        if (!fileInput) throw new Error('No file selected');
        if (fileInput.type === 'application/pdf') {
          return extractTextFromPdfFile(fileInput);
        } else if (fileInput.type.startsWith('image/')) {
          // For images, placeholder - would need OCR
          return `Image file: ${fileInput.name} - OCR not implemented yet`;
        } else {
          return `Unsupported file: ${fileInput.name}`;
        }
      case 'url':
        try {
          const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(urlInput)}`);

          if (!response.ok) {
            throw new Error('Unable to fetch content from URL');
          }

          const html = await response.text();
          const extractedText = extractMeaningfulTextFromHtml(html);

          if (!extractedText.trim()) {
            throw new Error('Unable to fetch content from URL');
          }

          return extractedText;
        } catch (error) {
          console.error('Error fetching URL content:', error);
          throw new Error('Unable to fetch content from URL');
        }
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
      const savedCardsWithIds = await saveGeneratedCards(cardsWithMastered);

      setCards(savedCardsWithIds);
      setShowGenerator(false);
      setShowPractice(true);
      setCurrentIndex(0);
      setIsFlipped(false);
      fetchFlashcards();
    } catch (error) {
      console.error("Error generating cards:", error);
      alert(`Failed to generate flashcards: ${error.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const markAsMastered = async (cardIndex: number, mastered: boolean) => {
    try {
      const currentCard = cards[cardIndex];
      if (!currentCard?.id) return;

      await updateDoc(doc(db, 'Flashcards', currentCard.id), { mastered: !mastered });

      const updatedCards = cards.map((card, index) =>
        index === cardIndex ? { ...card, mastered: !mastered } : card,
      );
      setCards(updatedCards);
      setSavedFlashcards((prev) =>
        prev.map((card) =>
          card.id === currentCard.id ? { ...card, mastered: !mastered } : card,
        ),
      );
    } catch (error) {
      console.error('Error updating card:', error);
    }
  };

  const deleteCard = async (cardIndex: number) => {
    if (!window.confirm('Are you sure you want to delete this flashcard?')) return;
    try {
      const currentCard = cards[cardIndex];
      if (!currentCard?.id) return;

      await deleteDoc(doc(db, 'Flashcards', currentCard.id));

      const updatedCards = cards.filter((_, index) => index !== cardIndex);
      setCards(updatedCards);
      setSavedFlashcards((prev) => prev.filter((card) => card.id !== currentCard.id));
      if (cards.length === 1) {
        setShowPractice(false);
      } else if (currentIndex >= cards.length - 1) {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
    } catch (error) {
      console.error('Error deleting card:', error);
    }
  };

  const startEdit = (card: Flashcard) => {
    if (!card.id) return;
    setEditingCard(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  };

  const saveEdit = async () => {
    if (editingCard) {
      try {
        const currentCard = cards.find((card) => card.id === editingCard);
        if (!currentCard?.id) return;

        await updateDoc(doc(db, 'Flashcards', currentCard.id), {
          question: editFront,
          answer: editBack,
        });

        const updatedCards = cards.map((card, index) => 
          card.id === editingCard ? { ...card, front: editFront, back: editBack } : card,
        );
        setCards(updatedCards);
        setSavedFlashcards((prev) =>
          prev.map((card) =>
            card.id === editingCard ? { ...card, front: editFront, back: editBack } : card,
          ),
        );
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

  const openFlashcards = (startIndex: number) => {
    setCards(savedFlashcards);
    setShowPractice(true);
    setCurrentIndex(startIndex);
    setIsFlipped(false);
    setEditingCard(null);
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
              placeholder="Search your flashcards..."
              className="w-full bg-[#0d1425] border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {flashcardsLoading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400">Loading flashcards...</p>
              </div>
            ) : savedFlashcards.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <p className="text-slate-400">No flashcards yet. Generate your first flashcards!</p>
              </div>
            ) : (
              savedFlashcards.map((flashcard, index) => {
                return (
                  <div
                    key={flashcard.id}
                    onClick={() => openFlashcards(index)}
                    className="bg-[#0d1425] border border-slate-800 p-6 rounded-2xl hover:border-indigo-500/50 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="bg-indigo-600/10 p-3 rounded-xl group-hover:bg-indigo-600/20 transition-colors">
                        <Layers className="w-6 h-6 text-indigo-500" />
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase">
                        {flashcard.mastered ? 'Mastered' : 'Learning'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-3">{flashcard.front}</h3>
                    <p className="text-slate-400 text-sm line-clamp-4">{flashcard.back}</p>
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
              <ChevronLeft className="w-5 h-5" /> Back to Flashcards
            </button>
            <span className="text-slate-500 font-bold">Card {currentIndex + 1} of {cards.length}</span>
          </div>

          <div
            className={`cursor-pointer h-[400px] ${isFlipped ? 'flipped' : ''}`}
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ perspective: '1000px' }}
          >
            <motion.div 
              className="relative w-full h-full"
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.6 }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 w-full h-full bg-[#0d1425] border-2 border-slate-800 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl"
                style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
              >
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
              <div
                className="absolute inset-0 w-full h-full bg-indigo-600 border-2 border-indigo-500 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                }}
              >
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
                  onClick={() => markAsMastered(currentIndex, cards[currentIndex].mastered)}
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
                  onClick={() => deleteCard(currentIndex)}
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
