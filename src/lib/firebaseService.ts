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
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase';

// Collection Names
export const COLLECTIONS = {
  USERS: 'Users',
  NOTES: 'notes',
  FLASHCARDS: 'decks',
  STUDY_ROOMS: 'StudyRooms',
  MESSAGES: 'Messages',
  PREVIOUS_PAPERS: 'PreviousPapers',
  PREDICTED_QUESTIONS: 'PredictedQuestions',
  PREDICTIONS: 'predictions',
  STUDY_PROGRESS: 'StudyProgress',
  STUDY_TASKS: 'tasks',
  BOOKMARKS: 'Bookmarks',
  STUDY_SESSIONS: 'StudySessions',
};

const LEGACY_COLLECTIONS = {
  NOTES: 'Notes',
  FLASHCARDS: 'Flashcards',
  PREDICTIONS: 'PredictedQuestions',
};

const getMillis = (value: any) =>
  value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();

const fetchDocsWithFallback = async (
  primaryCollection: string,
  buildPrimaryQuery: (collectionName: string) => any,
  legacyCollection?: string,
  buildLegacyQuery?: (collectionName: string) => any,
) => {
  try {
    const querySnapshot = await getDocs(buildPrimaryQuery(primaryCollection));
    return querySnapshot.docs;
  } catch (error) {
    console.warn(`[Firestore] Primary query failed for ${primaryCollection}:`, error);
    if (!legacyCollection || !buildLegacyQuery) {
      throw error;
    }
    const fallbackSnapshot = await getDocs(buildLegacyQuery(legacyCollection));
    return fallbackSnapshot.docs;
  }
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
  type?: string;
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

export interface PredictionSession {
  id?: string;
  userId: string;
  topics?: string[];
  questions: string[];
  createdAt: Timestamp | Date;
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
  const docs = await fetchDocsWithFallback(
    COLLECTIONS.NOTES,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc'),
      limit(count),
    ),
    LEGACY_COLLECTIONS.NOTES,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
      limit(count),
    ),
  );

  const notes = docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Note))
    .sort((a, b) => getMillis(b.updatedAt) - getMillis(a.updatedAt))
    .slice(0, count);

  console.log("Fetched data:", notes);
  return notes;
};

export const getRecentSummaries = async (userId: string, count = 3) => {
  const docs = await fetchDocsWithFallback(
    COLLECTIONS.NOTES,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
      where('type', '==', 'ai_summary'),
      orderBy('updatedAt', 'desc'),
      limit(count),
    ),
    LEGACY_COLLECTIONS.NOTES,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
      where('type', '==', 'ai_summary'),
      limit(count),
    ),
  );

  const summaries = docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Note))
    .sort((a, b) => getMillis(b.updatedAt ?? b.createdAt) - getMillis(a.updatedAt ?? a.createdAt))
    .slice(0, count);

  console.log("Fetched summaries:", summaries);
  return summaries;
};

export const getStudyRooms = async (userId?: string) => {
  try {
    const roomQuery = userId
      ? query(
          collection(db, COLLECTIONS.STUDY_ROOMS),
          where('createdBy', '==', userId),
          orderBy('createdAt', 'desc'),
        )
      : query(
          collection(db, COLLECTIONS.STUDY_ROOMS),
          orderBy('createdAt', 'desc'),
        );

    const querySnapshot = await getDocs(roomQuery);
    const rooms = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRoom));
    console.log("Fetched data:", rooms);
    return rooms;
  } catch (error) {
    console.warn('[Firestore] Study rooms query with orderBy failed, falling back:', error);
    const fallbackQuery = userId
      ? query(
          collection(db, COLLECTIONS.STUDY_ROOMS),
          where('createdBy', '==', userId),
        )
      : query(collection(db, COLLECTIONS.STUDY_ROOMS));

    const querySnapshot = await getDocs(fallbackQuery);
    const rooms = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyRoom));
    console.log("Fetched data:", rooms);
    return rooms;
  }
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
    where('userId', '==', userId)
  );
  
  if (subject) {
    q = query(q, where('subject', '==', subject));
  }

  const querySnapshot = await getDocs(q);
  const papers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PreviousPaper));
  return papers.sort((a, b) => (b.year || 0) - (a.year || 0));
};

export const getPredictedQuestions = async (userId: string) => {
  const docs = await fetchDocsWithFallback(
    COLLECTIONS.PREDICTIONS,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
    ),
    LEGACY_COLLECTIONS.PREDICTIONS,
    (collectionName) => query(
      collection(db, collectionName),
      where('userId', '==', userId),
    ),
  );

  const predictions = docs.map((doc) => {
    const data = doc.data() as any;

    if (Array.isArray(data.predictedTopics)) {
      return { id: doc.id, ...data } as PredictedQuestion;
    }

    const predictedTopics = Array.isArray(data.topics)
      ? data.topics.map((topic: string) => ({ topic, probability: 75 }))
      : [];

    return {
      id: doc.id,
      userId: data.userId,
      subject: data.subject ?? "Study Predictions",
      predictedTopics,
      questions: Array.isArray(data.questions) ? data.questions.map((text: string) => ({ text, probability: 75, reason: "Generated from prediction session" })) : [],
      createdAt: data.createdAt,
    } as PredictedQuestion;
  });

  console.log("Fetched data:", predictions);
  return predictions
    .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
    .slice(0, 3);
};

export const getUserPredictions = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.PREDICTED_QUESTIONS),
    where('userId', '==', userId),
  );
  const querySnapshot = await getDocs(q);
  console.log("[Firestore] fetched predictions:", querySnapshot.size);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PredictedQuestion));
};

export const savePredictions = async (prediction: Omit<PredictedQuestion, 'id' | 'createdAt'>) => {
  console.log("[Firestore] saving predictions:", prediction.userId);
  const docRef = await addDoc(collection(db, COLLECTIONS.PREDICTED_QUESTIONS), {
    ...prediction,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const savePredictionSession = async (session: Omit<PredictionSession, 'id' | 'createdAt'>) => {
  console.log("[Firestore] saving prediction session:", session.userId);
  const docRef = await addDoc(collection(db, COLLECTIONS.PREDICTIONS), {
    ...session,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const getPredictionSessions = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.PREDICTIONS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PredictionSession));
  const sorted = sessions.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
  console.log("Fetched predictions:", sorted);
  return sorted;
};

// Study Planner Functions
export const getStudyTasks = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_TASKS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudyTask));
  const sorted = tasks.sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
  console.log("Fetched data:", sorted);
  return sorted;
};

export const addStudyTask = async (task: Omit<StudyTask, 'id' | 'createdAt'>) => {
  console.log("[Firestore] saving study task:", task.userId);
  const docRef = await addDoc(collection(db, COLLECTIONS.STUDY_TASKS), {
    ...task,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateStudyTask = async (taskId: string, updates: Partial<StudyTask>) => {
  const docRef = doc(db, COLLECTIONS.STUDY_TASKS, taskId);
  await setDoc(docRef, updates, { merge: true });
};

export const deleteStudyTask = async (taskId: string) => {
  const docRef = doc(db, COLLECTIONS.STUDY_TASKS, taskId);
  await deleteDoc(docRef);
};

// Study Room Message Functions
export const getRoomMessages = async (roomId: string) => {
  const q = query(
    collection(db, COLLECTIONS.MESSAGES),
    where('roomId', '==', roomId)
  );
  const querySnapshot = await getDocs(q);
  const messages = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoomMessage));
  const getMillis = (value: any) =>
    value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return messages.sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
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
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const bookmarks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bookmark));
  const getMillis = (value: any) =>
    value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return bookmarks.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
};

// Study Sessions Functions
export const getStudySessions = async (userId: string) => {
  const q = query(
    collection(db, COLLECTIONS.STUDY_SESSIONS),
    where('userId', '==', userId)
  );
  const querySnapshot = await getDocs(q);
  const sessions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySession));
  const getMillis = (value: any) =>
    value?.toMillis ? value.toMillis() : value instanceof Date ? value.getTime() : new Date(value || 0).getTime();
  return sessions.sort((a, b) => getMillis(b.date) - getMillis(a.date));
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
