import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Query,
  DocumentData,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

// Collection names
export const COLLECTIONS = {
  TUTEES: 'tutees',
  PAYMENTS: 'payments',
  SESSIONS: 'sessions'
};

// Helper function to get user-specific collection
export const getUserCollection = (userId: string, collectionName: string) => {
  return collection(db, `users/${userId}/${collectionName}`);
};

// Generic CRUD operations
export const createDocument = async (userId: string, collectionName: string, data: any) => {
  const col = getUserCollection(userId, collectionName);
  const docRef = await addDoc(col, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const getDocument = async (userId: string, collectionName: string, docId: string) => {
  const docRef = doc(db, `users/${userId}/${collectionName}/${docId}`);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

export const getAllDocuments = async (userId: string, collectionName: string) => {
  const col = getUserCollection(userId, collectionName);
  const querySnapshot = await getDocs(col);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export const updateDocument = async (
  userId: string,
  collectionName: string,
  docId: string,
  data: any
) => {
  const docRef = doc(db, `users/${userId}/${collectionName}/${docId}`);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const deleteDocument = async (userId: string, collectionName: string, docId: string) => {
  const docRef = doc(db, `users/${userId}/${collectionName}/${docId}`);
  await deleteDoc(docRef);
};

// Query helper
export const queryDocuments = async (
  userId: string,
  collectionName: string,
  conditions: any[] = []
) => {
  const col = getUserCollection(userId, collectionName);
  const q = query(col, ...conditions);
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

export { db, Timestamp, serverTimestamp, where, orderBy };