import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/firebaseService';

// Interfaces
export interface Flashcard {
  front: string;
  back: string;
  mastered: boolean;
}

export interface Deck {
  id: string;
  title: string;
  cards: Flashcard[];
  createdAt: Timestamp;
}

// Get flashcard decks summary
export const getFlashcardDecksSummary = async (userId: string): Promise<{ title: string; masteryPercentage: number; cardCount: number }[]> => {
  let querySnapshot;

  try {
    querySnapshot = await getDocs(query(
      collection(db, COLLECTIONS.FLASHCARDS),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    ));
  } catch (error) {
    console.warn('[Firestore] Deck query with orderBy failed, falling back:', error);
    querySnapshot = await getDocs(query(
      collection(db, COLLECTIONS.FLASHCARDS),
      where('userId', '==', userId),
    ));
  }

  const docs = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  console.log("Fetched data:", docs);

  const structuredDecks = docs.filter((doc) => Array.isArray(doc.cards));
  if (structuredDecks.length > 0) {
    return structuredDecks.map((deck) => {
      const deckCards = Array.isArray(deck.cards) ? deck.cards : [];
      const totalCards = deckCards.length;
      const masteredCards = deckCards.filter((card: any) => card.mastered).length;
      const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

      return {
        title: deck.title ?? 'Generated Deck',
        masteryPercentage,
        cardCount: totalCards,
      };
    }).slice(0, 3);
  }

  const totalCards = docs.length;
  const masteredCards = docs.filter((doc) => Boolean(doc.mastered)).length;
  const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;

  return totalCards > 0
    ? [{ title: 'AI Generated Deck', masteryPercentage, cardCount: totalCards }]
    : [];
};

// Get all flashcard decks for user
export const getFlashcardDecks = async (userId: string): Promise<Deck[]> => {
  let querySnapshot;

  try {
    querySnapshot = await getDocs(query(
      collection(db, COLLECTIONS.FLASHCARDS),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    ));
  } catch (error) {
    console.warn('[Firestore] Deck list query with orderBy failed, falling back:', error);
    querySnapshot = await getDocs(query(
      collection(db, COLLECTIONS.FLASHCARDS),
      where('userId', '==', userId),
    ));
  }

  const decks = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));
  console.log("Fetched data:", decks);

  return decks.map((deck) => ({
    id: deck.id,
    title: deck.title ?? 'Generated Deck',
    cards: Array.isArray(deck.cards)
      ? deck.cards.map((card: any) => ({
          front: card.question ?? card.front ?? '',
          back: card.answer ?? card.back ?? '',
          mastered: Boolean(card.mastered),
        }))
      : [],
    createdAt: deck.createdAt,
  }));
};
