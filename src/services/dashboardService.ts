import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, StudySession } from '../lib/firebaseService';

const LEGACY_FLASHCARD_COLLECTION = 'Flashcards';

type FlashcardLikeDoc = {
  id: string;
  mastered?: boolean;
  cards?: Array<{ mastered?: boolean }>;
};

// Helper function to get start of week (Monday)
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  return new Date(d.setDate(diff));
}

// Helper function to get end of week (Sunday)
function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  return new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
}

// Get total study hours
export const getStudyHours = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => doc.data());
  console.log("Fetched data:", sessions);
  return sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
};

const getFlashcardDocuments = async (userId: string): Promise<FlashcardLikeDoc[]> => {
  const collectionNames = Array.from(new Set([COLLECTIONS.FLASHCARDS, LEGACY_FLASHCARD_COLLECTION]));

  const snapshots = await Promise.all(
    collectionNames.map(async (collectionName) => {
      try {
        return await getDocs(query(
          collection(db, collectionName),
          where('userId', '==', userId),
        ));
      } catch (error) {
        console.warn(`[Firestore] Flashcard query failed for ${collectionName}:`, error);
        return null;
      }
    }),
  );

  return snapshots
    .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null)
    .flatMap((snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as FlashcardLikeDoc)));
};

const getFlashcardCounts = (docs: FlashcardLikeDoc[]) => {
  return docs.reduce(
    (totals, doc) => {
      if (Array.isArray(doc.cards)) {
        const totalCards = doc.cards.length;
        const masteredCards = doc.cards.filter((card) => Boolean(card.mastered)).length;

        totals.total += totalCards;
        totals.mastered += masteredCards;
        return totals;
      }

      totals.total += 1;
      if (doc.mastered) {
        totals.mastered += 1;
      }
      return totals;
    },
    { total: 0, mastered: 0 },
  );
};

// Get mastered cards count
export const getMasteredCards = async (userId: string): Promise<number> => {
  const docs = await getFlashcardDocuments(userId);
  const counts = getFlashcardCounts(docs);
  console.log("Fetched data:", docs);
  return counts.mastered;
};

// Get total cards count
export const getTotalCards = async (userId: string): Promise<number> => {
  const docs = await getFlashcardDocuments(userId);
  const counts = getFlashcardCounts(docs);
  console.log("Fetched data:", docs);
  return counts.total;
};

// Get exam readiness percentage
export const getExamReadiness = async (userId: string): Promise<number> => {
  const [mastered, total] = await Promise.all([
    getMasteredCards(userId),
    getTotalCards(userId)
  ]);
  return total > 0 ? Math.round((mastered / total) * 100) : 0;
};

// Get weekly growth percentage
export const getWeeklyGrowth = async (userId: string): Promise<number> => {
  const now = new Date();
  const thisWeekStart = getStartOfWeek(now);
  const thisWeekEnd = getEndOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastWeekEnd = new Date(thisWeekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => ({ ...doc.data(), date: doc.data().date.toDate() } as StudySession & { date: Date }));
  console.log("Fetched data:", sessions);

  const thisWeekHours = sessions
    .filter(session => session.date >= thisWeekStart && session.date <= thisWeekEnd)
    .reduce((sum, session) => sum + (session.duration || 0), 0);

  const lastWeekHours = sessions
    .filter(session => session.date >= lastWeekStart && session.date <= lastWeekEnd)
    .reduce((sum, session) => sum + (session.duration || 0), 0);

  if (lastWeekHours === 0) {
    return thisWeekHours > 0 ? 100 : 0; // arbitrary, or 0
  }
  return Math.round(((thisWeekHours - lastWeekHours) / lastWeekHours) * 100);
};
