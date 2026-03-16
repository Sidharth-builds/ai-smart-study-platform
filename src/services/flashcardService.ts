import { collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
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
export const getFlashcardDecksSummary = async (userId: string): Promise<{ title: string; masteryPercentage: number }[]> => {
  const q = query(
    collection(db, COLLECTIONS.FLASHCARDS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const cards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  // Group by date
  const decksMap = new Map<string, any[]>();
  cards.forEach(card => {
    const date = card.createdAt.toDate().toDateString();
    if (!decksMap.has(date)) decksMap.set(date, []);
    decksMap.get(date)!.push(card);
  });

  return Array.from(decksMap.entries()).map(([date, deckCards]) => {
    const totalCards = deckCards.length;
    const masteredCards = deckCards.filter((c: any) => c.mastered).length;
    const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
    return { title: `AI Generated Deck - ${date}`, masteryPercentage };
  }).slice(0, 2); // Limit to 2 for dashboard
};

// Get all flashcard decks for user
export const getFlashcardDecks = async (userId: string): Promise<Deck[]> => {
  const q = query(
    collection(db, COLLECTIONS.FLASHCARDS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const cards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

  // Group by date
  const decksMap = new Map<string, any[]>();
  cards.forEach(card => {
    const date = card.createdAt.toDate().toDateString();
    if (!decksMap.has(date)) decksMap.set(date, []);
    decksMap.get(date)!.push(card);
  });

  return Array.from(decksMap.entries()).map(([date, deckCards]) => ({
    id: date, // Use date as id
    title: `AI Generated Deck - ${date}`,
    cards: deckCards.map((c: any) => ({
      front: c.question,
      back: c.answer,
      mastered: c.mastered
    })),
    createdAt: deckCards[0].createdAt
  }));
};