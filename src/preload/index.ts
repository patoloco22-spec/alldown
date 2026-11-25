/**
 * AllDown - Preload Script
 * Secure bridge between main and renderer processes
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  DownloadFile,
  DownloadAddPayload,
  BatchDownloadPayload,
  DownloadPriority,
  DownloadCategory,
  AllSettings,
  DownloadProgressEvent,
  DownloadStateChangeEvent,
  QueueUpdateEvent,
  CategoryUpdateEvent,
  MediaSniffResult,
  UpdateInfo,
} from '@shared/types';
import { IPC_CHANNELS } from '../main/ipc/channels';

// ============================================
// Type Definitions for Renderer
// ============================================

interface ElectronAPI {
  // Downloads
  downloads: {
    add: (payload: DownloadAddPayload) => Promise<{ success: boolean; download?: DownloadFile; error?: string }>;
    batchAdd: (payload: BatchDownloadPayload) => Promise<{ success: boolean; downloads?: DownloadFile[]; error?: string }>;
    start: (id: string) => Promise<{ success: boolean; error?: string }>;
    pause: (id: string) => Promise<{ success: boolean; error?: string }>;
    resume: (id: string) => Promise<{ success: boolean; error?: string }>;
    cancel: (id: string, deleteFile?: boolean) => Promise<{ success: boolean; error?: string }>;
    retry: (id: string) => Promise<{ success: boolean; error?: string }>;
    remove: (id: string) => Promise<{ success: boolean; error?: string }>;
    get: (id: string) => Promise<DownloadFile | null>;
    getAll: () => Promise<DownloadFile[]>;
    clearCompleted: () => Promise<{ success: boolean; count: number }>;
    clearFailed: () => Promise<{ success: boolean; count: number }>;
    pauseAll: () => Promise<{ success: boolean }>;
    resumeAll: () => Promise<{ success: boolean }>;
    move: (id: string, index: number) => Promise<{ success: boolean }>;
    setPriority: (id: string, priority: DownloadPriority) => Promise<{ success: boolean }>;
    setCategory: (id: string, categoryId: string) => Promise<{ success: boolean }>;
    openFile: (id: string) => Promise<{ success: boolean; error?: string }>;
    openFolder: (id: string) => Promise<{ success: boolean; error?: string }>;
    copyLink: (id: string) => Promise<{ success: boolean; error?: string }>;
    onProgress: (callback: (event: DownloadProgressEvent) => void) => () => void;
    onStateChange: (callback: (event: DownloadStateChangeEvent) => void) => () => void;
  };

  // Queue
  queue: {
    onUpdate: (callback: (event: QueueUpdateEvent) => void) => () => void;
  };

  // Categories
  categories: {
    getAll: () => Promise<DownloadCategory[]>;
    get: (id: string) => Promise<DownloadCategory | undefined>;
    add: (category: Omit<DownloadCategory, 'id'> & { id?: string }) => Promise<{ success: boolean; category?: DownloadCategory }>;
    update: (id: string, updates: Partial<DownloadCategory>) => Promise<{ success: boolean; category?: DownloadCategory }>;
    remove: (id: string) => Promise<{ success: boolean }>;
    onUpdate: (callback: (event: CategoryUpdateEvent) => void) => () => void;
  };

  // Settings
  settings: {
    getAll: () => Promise<AllSettings>;
    get: (section: keyof AllSettings) => Promise<AllSettings[keyof AllSettings]>;
    update: (section: keyof AllSettings, updates: Partial<AllSettings[keyof AllSettings]>) => Promise<{ success: boolean }>;
    reset: (section?: keyof AllSettings) => Promise<{ success: boolean }>;
    export: () => Promise<{ success: boolean; path?: string; cancelled?: boolean }>;
    import: () => Promise<{ success: boolean; cancelled?: boolean }>;
  };

  // Clipboard
  clipboard: {
    start: () => Promise<{ success: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    onUrlDetected: (callback: (url: string) => void) => () => void;
  };

  // Browser Integration
  browser: {
    start: () => Promise<{ success: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    getStatus: () => Promise<{ enabled: boolean; connected: boolean; extensionId?: string }>;
  };

  // Media Sniffing
  media: {
    sniff: (pageUrl: string) => Promise<{ success: boolean; result?: MediaSniffResult }>;
  };

  // Updates
  updates: {
    check: () => Promise<UpdateInfo | null>;
    download: (url: string) => Promise<{ success: boolean; path?: string; error?: string }>;
  };

  // System
  system: {
    openExternal: (url: string) => Promise<{ success: boolean }>;
    showItemInFolder: (path: string) => Promise<{ success: boolean }>;
    getAppVersion: () => Promise<{ version: string }>;
    getAppPath: () => Promise<{ path: string }>;
    minimize: () => Promise<{ success: boolean }>;
    maximize: () => Promise<{ success: boolean }>;
    close: () => Promise<{ success: boolean }>;
    quit: () => Promise<{ success: boolean }>;
  };

  // UI
  ui: {
    onWindowReady: (callback: () => void) => () => void;
  };

  // Statistics
  stats: {
    get: () => Promise<any>;
  };
}

// ============================================
// Helper Functions
// ============================================

function createListenerRemover(channel: string, listener: (...args: any[]) => void): () => void {
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

// ============================================
// Expose API
// ============================================

const electronAPI: ElectronAPI = {
  downloads: {
    add: (payload) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_ADD, payload),
    batchAdd: (payload) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_BATCH_ADD, payload),
    start: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_START, id),
    pause: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_PAUSE, id),
    resume: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RESUME, id),
    cancel: (id, deleteFile) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CANCEL, id, deleteFile),
    retry: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RETRY, id),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_REMOVE, id),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_GET, id),
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_GET_ALL),
    clearCompleted: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CLEAR_COMPLETED),
    clearFailed: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_CLEAR_FAILED),
    pauseAll: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_PAUSE_ALL),
    resumeAll: () => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_RESUME_ALL),
    move: (id, index) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_MOVE, id, index),
    setPriority: (id, priority) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_SET_PRIORITY, id, priority),
    setCategory: (id, categoryId) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_SET_CATEGORY, id, categoryId),
    openFile: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_OPEN_FILE, id),
    openFolder: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER, id),
    copyLink: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD_COPY_LINK, id),

    onProgress: (callback) => {
      const listener = (_event: any, event: DownloadProgressEvent) => callback(event);
      ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_PROGRESS, listener);
      return createListenerRemover(IPC_CHANNELS.DOWNLOAD_PROGRESS, listener);
    },

    onStateChange: (callback) => {
      const listener = (_event: any, event: DownloadStateChangeEvent) => callback(event);
      ipcRenderer.on(IPC_CHANNELS.DOWNLOAD_STATE_CHANGE, listener);
      return createListenerRemover(IPC_CHANNELS.DOWNLOAD_STATE_CHANGE, listener);
    },
  },

  queue: {
    onUpdate: (callback) => {
      const listener = (_event: any, event: QueueUpdateEvent) => callback(event);
      ipcRenderer.on(IPC_CHANNELS.QUEUE_UPDATE, listener);
      return createListenerRemover(IPC_CHANNELS.QUEUE_UPDATE, listener);
    },
  },

  categories: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_GET_ALL),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_GET, id),
    add: (category) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_ADD, category),
    update: (id, updates) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_UPDATE, id, updates),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_REMOVE, id),

    onUpdate: (callback) => {
      const listener = (_event: any, event: CategoryUpdateEvent) => callback(event);
      ipcRenderer.on(IPC_CHANNELS.CATEGORY_UPDATE_EVENT, listener);
      return createListenerRemover(IPC_CHANNELS.CATEGORY_UPDATE_EVENT, listener);
    },
  },

  settings: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
    get: (section) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, section),
    update: (section, updates) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, section, updates),
    reset: (section) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET, section),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_EXPORT),
    import: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_IMPORT),
  },

  clipboard: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_START),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPBOARD_STOP),

    onUrlDetected: (callback) => {
      const listener = (_event: any, data: { url: string }) => callback(data.url);
      ipcRenderer.on(IPC_CHANNELS.CLIPBOARD_URL_DETECTED, listener);
      return createListenerRemover(IPC_CHANNELS.CLIPBOARD_URL_DETECTED, listener);
    },
  },

  browser: {
    start: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_START),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_STOP),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.BROWSER_GET_STATUS),
  },

  media: {
    sniff: (pageUrl) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA_SNIFF, pageUrl),
  },

  updates: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    download: (url) => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_DOWNLOAD, url),
  },

  system: {
    openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, url),
    showItemInFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_SHOW_ITEM_IN_FOLDER, path),
    getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_VERSION),
    getAppPath: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_APP_PATH),
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_CLOSE),
    quit: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_QUIT),
  },

  ui: {
    onWindowReady: (callback) => {
      const listener = () => callback();
      ipcRenderer.once(IPC_CHANNELS.WINDOW_READY, listener);
      return createListenerRemover(IPC_CHANNELS.WINDOW_READY, listener);
    },
  },

  stats: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.STATS_GET),
  },
};

// Expose to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Also expose types for TypeScript
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}