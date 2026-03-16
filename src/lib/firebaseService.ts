import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';

// Collection Names
export const COLLECTIONS = {
  USERS: 'Users',
  NOTES: 'Notes',
  FLASHCARDS: 'Flashcards',
  STUDY_ROOMS: 'StudyRooms',
  MESSAGES: 'Messages',
  PREVIOUS_PAPERS: 'PreviousPapers',
  PREDICTED_QUESTIONS: 'PredictedQuestions',
  STUDY_PROGRESS: 'StudyProgress',
  STUDY_TASKS: 'StudyTasks',
  BOOKMARKS: 'Bookmarks',
  STUDY_SESSIONS: 'StudySessions',
};

// Types
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  stream?: string;
  createdAt: Timestamp;
}

export interface Note {
  id?: string;
  userId: string;
  title: string;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface FlashcardDeck {
  id?: string;
  userId: string;
  title: string;
  cardCount: number;
  masteredCount: number;
  createdAt: Timestamp;
}

export interface Flashcard {
  id?: string;
  userId: string;
  deckId?: string;
  question: string;
  answer: string;
  mastered: boolean;
  createdAt: Timestamp;
}

export interface StudyRoom {
  id?: string;
  name: string;
  topic: string;
  memberCount: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

export interface PreviousPaper {
  id?: string;
  userId: string;
  subject: string;
  year: number;
  questions: string[];
  createdAt: Timestamp;
}

export interface PredictedQuestion {
  id?: string;
  userId: string;
  subject: string;
  predictedTopics: any[];
  questions: { text: string; probability: number; reason: string }[];
  createdAt: Timestamp;
}

export interface StudyTask {
  id?: string;
  userId: string;
  title: string;
  date: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
}

export interface RoomMessage {
  id?: string;
  roomId: string;
  userId: string;
  userName: string;
  text: string;
  type: 'text' | 'file' | 'note';
  fileUrl?: string;
  createdAt: Timestamp;
}

export interface Bookmark {
  id?: string;
  userId: string;
  type: 'question' | 'topic' | 'note';
  content: any;
  createdAt: Timestamp;
}

export interface StudySession {
  id?: string;
  userId: string;
  subject: string;
  duration: number; // in hours
  date: Timestamp;
}

// Basic Service Functions
export const getUserProfile = async (uid: string) => {
  const docRef = doc(db, COLLECTIONS.USERS, uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() as UserProfile : null;
};

export const createUserProfile = async (profile: UserProfile) => {
  await setDoc(doc(db, COLLECTIONS.USERS, profile.uid), profile);
};

export const getRecentNotes = async (userId: string, count = 3) => {
  const q = query(
    collection(db, COLLECTIONS.NOTES),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(count)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note));
};

export const getStudyRooms = async () => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_ROOMS),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRoom));
};

export const createStudyRoom = async (roomData: Omit<StudyRoom, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.STUDY_ROOMS), {
    ...roomData,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const savePreviousPaper = async (paper: Omit<PreviousPaper, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.PREVIOUS_PAPERS), {
    ...paper,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const getPreviousPapers = async (userId: string, subject?: string) => {
  let q = query(
    collection(db, COLLECTIONS.PREVIOUS_PAPERS),
    where('userId', '==', userId),
    orderBy('year', 'desc')
  );
  
  if (subject) {
    q = query(q, where('subject', '==', subject));
  }

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PreviousPaper));
};

export const getPredictedQuestions = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.PREDICTED_QUESTIONS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(3) // Limit to 3 for dashboard
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PredictedQuestion));
};

export const savePredictions = async (prediction: Omit<PredictedQuestion, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.PREDICTED_QUESTIONS), {
    ...prediction,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

// Study Planner Functions
export const getStudyTasks = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_TASKS),
    where('userId', '==', userId),
    orderBy('date', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyTask));
};

export const addStudyTask = async (task: Omit<StudyTask, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.STUDY_TASKS), {
    ...task,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateStudyTask = async (taskId: string, updates: Partial<StudyTask>) => {
  const docRef = doc(db, COLLECTIONS.STUDY_TASKS, taskId);
  await setDoc(docRef, updates, { merge: true });
};

// Study Room Message Functions
export const getRoomMessages = async (roomId: string) => {
  const q = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('roomId', '==', roomId),
    orderBy('createdAt', 'asc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomMessage));
};

export const saveRoomMessage = async (message: Omit<RoomMessage, 'id' | 'createdAt'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
    ...message,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

// Bookmark Functions
export const toggleBookmark = async (userId: string, type: string, content: any) => {
  const q = query(
    collection(db, COLLECTIONS.BOOKMARKS),
    where('userId', '==', userId),
    where('type', '==', type),
    where('content.text', '==', content.text || content)
  );
  
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return { exists: true, id: querySnapshot.docs[0].id };
  } else {
    const docRef = await addDoc(collection(db, COLLECTIONS.BOOKMARKS), {
      userId,
      type,
      content,
      createdAt: Timestamp.now(),
    });
    return { exists: false, id: docRef.id };
  }
};

export const getBookmarks = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.BOOKMARKS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bookmark));
};

// Study Sessions Functions
export const getStudySessions = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession));
};

export const addStudySession = async (session: Omit<StudySession, 'id'>) => {
  const docRef = await addDoc(collection(db, COLLECTIONS.STUDY_SESSIONS), session);
  return docRef.id;
};

export const getTotalStudyHours = async (userId: string) => {
  const sessions = await getStudySessions(userId);
  return sessions.reduce((sum, session) => sum + session.duration, 0);
};

// Flashcard Decks Functions
export const getFlashcardDecks = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.FLASHCARDS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FlashcardDeck));
};

export const getTotalMasteredCards = async (userId: string) => {
  const decks = await getFlashcardDecks(userId);
  return decks.reduce((sum, deck) => sum + deck.masteredCount, 0);
};
