import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS, StudySession } from '../lib/firebaseService';

// Get total study hours
export const getTotalStudyHours = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => doc.data());
  return sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
};

// Get summaries created count
export const getSummariesCreated = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.NOTES),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
};

// Get current streak (consecutive days with study sessions)
export const getCurrentStreak = async (userId: string): Promise<number> => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => ({ ...doc.data(), date: doc.data().date.toDate() } as StudySession & { date: Date }));

  if (sessions.length === 0) return 0;

  // Get unique dates
  const uniqueDates = [...new Set(sessions.map(s => s.date.toDateString()))].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDates.length; i++) {
    const sessionDate = new Date(uniqueDates[i]);
    sessionDate.setHours(0, 0, 0, 0);
    const expectedDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);

    if (sessionDate.getTime() === expectedDate.getTime()) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
};