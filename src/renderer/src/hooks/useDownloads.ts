import { useState, useEffect, useCallback } from 'react';
import type { DownloadFile, DownloadAddPayload, BatchDownloadPayload, DownloadPriority, DownloadProgressEvent, DownloadStateChangeEvent, QueueUpdateEvent } from '@shared/types';

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all downloads
  const fetchDownloads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.downloads.getAll();
      setDownloads(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDownloads();
  }, [fetchDownloads]);

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribeProgress = window.electronAPI.downloads.onProgress((event) => {
      setDownloads(prev => prev.map(d => {
        if (d.id === event.downloadId) {
          return { ...d, ...event };
        }
        return d;
      }));
    });

    const unsubscribeStateChange = window.electronAPI.downloads.onStateChange((event) => {
      setDownloads(prev => prev.map(d => {
        if (d.id === event.downloadId) {
          return { ...d, status: event.newStatus, error: event.error, updatedAt: Date.now() };
        }
        return d;
      }));
    });

    const unsubscribeQueueUpdate = window.electronAPI.queue.onUpdate((event) => {
      if (event.type === 'added') {
        // New downloads will be fetched on next poll or we could fetch individually
        fetchDownloads();
      } else if (event.type === 'removed') {
        setDownloads(prev => prev.filter(d => !event.downloadIds.includes(d.id)));
      }
    });

    return () => {
      unsubscribeProgress();
      unsubscribeStateChange();
      unsubscribeQueueUpdate();
    };
  }, [fetchDownloads]);

  // Actions
  const addDownload = useCallback(async (payload: DownloadAddPayload) => {
    const result = await window.electronAPI.downloads.add(payload);
    if (result.success) {
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const batchAdd = useCallback(async (payload: BatchDownloadPayload) => {
    const result = await window.electronAPI.downloads.batchAdd(payload);
    if (result.success) {
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const startDownload = useCallback(async (id: string) => {
    return window.electronAPI.downloads.start(id);
  }, []);

  const pauseDownload = useCallback(async (id: string) => {
    return window.electronAPI.downloads.pause(id);
  }, []);

  const resumeDownload = useCallback(async (id: string) => {
    return window.electronAPI.downloads.resume(id);
  }, []);

  const cancelDownload = useCallback(async (id: string, deleteFile = false) => {
    const result = await window.electronAPI.downloads.cancel(id, deleteFile);
    if (result.success) {
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const retryDownload = useCallback(async (id: string) => {
    return window.electronAPI.downloads.retry(id);
  }, []);

  const removeDownload = useCallback(async (id: string) => {
    const result = await window.electronAPI.downloads.remove(id);
    if (result.success) {
      setDownloads(prev => prev.filter(d => d.id !== id));
    }
    return result;
  }, []);

  const openFile = useCallback(async (id: string) => {
    return window.electronAPI.downloads.openFile(id);
  }, []);

  const openFolder = useCallback(async (id: string) => {
    return window.electronAPI.downloads.openFolder(id);
  }, []);

  const copyLink = useCallback(async (id: string) => {
    return window.electronAPI.downloads.copyLink(id);
  }, []);

  const clearCompleted = useCallback(async () => {
    const result = await window.electronAPI.downloads.clearCompleted();
    if (result.success) {
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const clearFailed = useCallback(async () => {
    const result = await window.electronAPI.downloads.clearFailed();
    if (result.success) {
      fetchDownloads();
    }
    return result;
  }, [fetchDownloads]);

  const pauseAll = useCallback(async () => {
    return window.electronAPI.downloads.pauseAll();
  }, []);

  const resumeAll = useCallback(async () => {
    return window.electronAPI.downloads.resumeAll();
  }, []);

  return {
    downloads,
    loading,
    error,
    refetch: fetchDownloads,
    addDownload,
    batchAdd,
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    removeDownload,
    openFile,
    openFolder,
    copyLink,
    clearCompleted,
    clearFailed,
    pauseAll,
    resumeAll,
  };
}