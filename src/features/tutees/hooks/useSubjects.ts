import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { useAuth } from '@/features/auth/hooks/useAuth';

export interface Subject {
  id: string;
  name: string;
  createdAt: string;
}

export const useSubjects = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSubjects = async () => {
    if (!user) {
      setSubjects([]);
      setIsLoading(false);
      return;
    }

    try {
      const subjectsRef = collection(db, 'users', user.id, 'subjects');
      const q = query(subjectsRef, orderBy('createdAt', 'asc'));
      const snapshot = await getDocs(q);

      const loadedSubjects = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        createdAt: doc.data().createdAt,
      }));

      setSubjects(loadedSubjects);
    } catch (error) {
      console.error('Error loading subjects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [user]);

  const addSubject = async (name: string) => {
    if (!user) throw new Error('User not authenticated');

    const subjectsRef = collection(db, 'users', user.id, 'subjects');
    const docRef = await addDoc(subjectsRef, {
      name,
      createdAt: new Date().toISOString(),
    });

    await loadSubjects();
    return docRef.id;
  };

  const deleteSubject = async (id: string) => {
    if (!user) throw new Error('User not authenticated');

    const subjectRef = doc(db, 'users', user.id, 'subjects', id);
    await deleteDoc(subjectRef);
    await loadSubjects();
  };

  return {
    subjects,
    isLoading,
    addSubject,
    deleteSubject,
    reloadSubjects: loadSubjects,
  };
};
