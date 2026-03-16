import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, StudySession } from '../lib/firebaseService';

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
  return sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
};

// Get mastered cards count
export const getMasteredCards = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.FLASHCARDS),
    where('userId', '==', userId),
    where('mastered', '==', true)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
};

// Get total cards count
export const getTotalCards = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.FLASHCARDS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
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