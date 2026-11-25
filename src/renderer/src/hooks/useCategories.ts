import { useState, useEffect, useCallback } from 'react';
import type { DownloadCategory } from '@shared/types';

export function useCategories() {
  const [categories, setCategories] = useState<DownloadCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.categories.getAll();
      setCategories(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Subscribe to category updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.categories.onUpdate((event) => {
      if (event.type === 'added' || event.type === 'updated') {
        setCategories(prev => {
          const exists = prev.some(c => c.id === event.category.id);
          if (exists) {
            return prev.map(c => c.id === event.category.id ? event.category : c);
          }
          return [...prev, event.category].sort((a, b) => a.order - b.order);
        });
      } else if (event.type === 'removed') {
        setCategories(prev => prev.filter(c => c.id !== event.category.id));
      }
    });

    return unsubscribe;
  }, []);

  const addCategory = useCallback(async (category: Omit<DownloadCategory, 'id'> & { id?: string }) => {
    const result = await window.electronAPI.categories.add(category);
    if (result.success) {
      fetchCategories();
    }
    return result;
  }, [fetchCategories]);

  const updateCategory = useCallback(async (id: string, updates: Partial<DownloadCategory>) => {
    const result = await window.electronAPI.categories.update(id, updates);
    if (result.success) {
      fetchCategories();
    }
    return result;
  }, [fetchCategories]);

  const removeCategory = useCallback(async (id: string) => {
    const result = await window.electronAPI.categories.remove(id);
    if (result.success) {
      fetchCategories();
    }
    return result;
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    addCategory,
    updateCategory,
    removeCategory,
  };
}