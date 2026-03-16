import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../lib/firebaseService';

export const deleteStudyRoom = async (roomId: string) => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.STUDY_ROOMS, roomId));
  } catch (error) {
    console.error('Error deleting study room:', error);
    throw error;
  }
};