import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Interfaces
export interface Flashcard {
  id?: string;
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
export const getFlashcardDecksSummary = async (userId: string): Promise<{ title: string; masteryPercentage: number }[]> => {
  const q = query(
    collection(db, 'decks'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const decks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  return decks.map((deck) => {
    const deckCards = Array.isArray(deck.cards) ? deck.cards : [];
    const totalCards = deckCards.length;
    const masteredCards = deckCards.filter((card: any) => card.mastered).length;
    const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
    return { title: deck.title ?? 'Generated Deck', masteryPercentage };
  }).slice(0, 2); // Limit to 2 for dashboard
};

// Get all flashcard decks for user
export const getFlashcardDecks = async (userId: string): Promise<Deck[]> => {
  const q = query(
    collection(db, 'decks'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const decks = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as any));

  return decks.map((deck) => ({
    id: deck.id,
    title: deck.title ?? 'Generated Deck',
    cards: Array.isArray(deck.cards)
      ? deck.cards.map((card: any) => ({
          id: card.id,
          front: card.front,
          back: card.back,
          mastered: Boolean(card.mastered),
        }))
      : [],
    createdAt: deck.createdAt,
  }));
};
