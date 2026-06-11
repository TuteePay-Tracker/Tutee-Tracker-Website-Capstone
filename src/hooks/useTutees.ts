import { useState, useEffect } from 'react';

import { Tutee } from '../types/tutee';
import { tuteeService } from '../services/tuteeService';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export const useTutees = () => {
  const { user } = useAuth();
  const [tutees, setTutees] = useState<Tutee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user === undefined) return;
    
    setIsLoading(true);
    let unsubscribe: () => void = () => {};

    if (user?.role === 'parent') {
      if (user.createdByTutorId) {
        unsubscribe = tuteeService.subscribeAll((data) => {
          setTutees(data);
          setIsLoading(false);
          setError(null);
        }, user.createdByTutorId);
      } else {
        setTutees([]);
        setIsLoading(false);
      }
    } else if (user) {
      unsubscribe = tuteeService.subscribeAll((data) => {
        setTutees(data);
        setIsLoading(false);
        setError(null);
      });
    } else {
      setTutees([]);
      setIsLoading(false);
    }

    return () => unsubscribe();
  }, [user]);

  const loadTutees = async () => {
    try {
      setIsLoading(true);
      
      let data: Tutee[] = [];
      
      if (user?.role === 'parent') {
        // If it's a parent, fetch tutees from the tutor's collection, filtered by parentId in Firestore
        if (user.createdByTutorId) {
          data = await tuteeService.getAll(user.createdByTutorId);
        } else {
          // createdByTutorId not yet set — nothing to show
          data = [];
        }
        // tuteeService.getAll() already filters by parentId == auth.currentUser.uid,
        // so no additional client-side filtering is needed here.
        setTutees(data);
      } else {
        // For tutors, it uses their own ID
        data = await tuteeService.getAll();
        setTutees(data);
      }

      setError(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load tutees';
      setError(errorMessage);
      console.error(err);
      if (err?.message !== 'User not authenticated') {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const addTutee = async (tutee: Omit<Tutee, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTutee = await tuteeService.create(tutee);
      setTutees(prev => [newTutee, ...prev]);
      return newTutee;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to add tutee';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const updateTutee = async (id: string, updates: Partial<Tutee>) => {
    try {
      const updatedTutee = await tuteeService.update(id, updates);
      setTutees(prev => prev.map(t => t.id === id ? updatedTutee : t));
      return updatedTutee;
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update tutee';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const deleteTutee = async (id: string) => {
    try {
      await tuteeService.delete(id);
      setTutees(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to delete tutee';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    }
  };

  const getTuteeById = (id: string): Tutee | undefined => {
    return tutees.find(t => t.id === id);
  };

  return {
    tutees,
    isLoading,
    error,
    addTutee,
    updateTutee,
    deleteTutee,
    getTuteeById,
    refreshTutees: loadTutees,
  };
};
