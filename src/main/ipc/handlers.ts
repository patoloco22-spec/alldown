/**
 * AllDown - IPC Handlers
 * Handles all communication between main and renderer processes
 */

import { ipcMain, dialog, shell, app } from 'electron';
import type {
  DownloadFile,
  DownloadAddPayload,
  BatchDownloadPayload,
  DownloadPriority,
  DownloadCategory,
  AllSettings,
  QueueUpdateEvent,
  CategoryUpdateEvent,
  MediaSniffResult,
} from '@shared/types';
import { IPC_CHANNELS } from './channels';
import { DownloadEngine } from '../engine/DownloadEngine';
import { QueueManager } from '../queue/QueueManager';
import { SettingsManager } from '../settings/SettingsManager';
import { ClipboardMonitor } from '../integrations/ClipboardMonitor';
import { BrowserIntegration } from '../integrations/BrowserIntegration';
import { UpdateChecker } from '../utils/UpdateChecker';
import { Logger } from '../utils/Logger';
import { MediaSniffer } from '../integrations/MediaSniffer';

// ============================================
// Types
// ============================================

interface IpcHandlers {
  downloadEngine: DownloadEngine;
  queueManager: QueueManager;
  settingsManager: SettingsManager;
  clipboardMonitor: ClipboardMonitor;
  browserIntegration: BrowserIntegration;
  updateChecker: UpdateChecker;
  logger: Logger;
  getMainWindow: () => Electron.BrowserWindow | null;
}

// ============================================
// Setup Function
// ============================================

export function setupIpcHandlers(handlers: IpcHandlers): void {
  const {
    downloadEngine,
    queueManager,
    settingsManager,
    clipboardMonitor,
    browserIntegration,
    updateChecker,
    logger,
    getMainWindow,
  } = handlers;

  // ============================================
  // Download Management
  // ============================================

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_ADD, async (_event, payload: DownloadAddPayload) => {
    try {
      const download = await queueManager.addDownload(payload);
      return { success: true, download };
    } catch (error) {
      logger.error('IPC: Failed to add download', { error: String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_BATCH_ADD, async (_event, payload: BatchDownloadPayload) => {
    try {
      const downloads = await queueManager.addBatchDownload(payload);
      return { success: true, downloads };
    } catch (error) {
      logger.error('IPC: Failed to add batch downloads', { error: String(error) });
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_START, async (_event, downloadId: string) => {
    try {
      await downloadEngine.startDownload(downloadId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_PAUSE, async (_event, downloadId: string) => {
    try {
      await queueManager.pauseDownload(downloadId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RESUME, async (_event, downloadId: string) => {
    try {
      await queueManager.resumeDownload(downloadId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CANCEL, async (_event, downloadId: string, deleteFile = false) => {
    try {
      await queueManager.cancelDownload(downloadId, deleteFile);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RETRY, async (_event, downloadId: string) => {
    try {
      await queueManager.retryDownload(downloadId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_REMOVE, async (_event, downloadId: string) => {
    try {
      queueManager.removeDownload(downloadId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_GET, async (_event, downloadId: string) => {
    const download = downloadEngine.getDownload(downloadId);
    return download || null;
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_GET_ALL, async () => {
    return downloadEngine.getAllDownloads();
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CLEAR_COMPLETED, async () => {
    const count = await queueManager.clearCompleted();
    return { success: true, count };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_CLEAR_FAILED, async () => {
    const count = await queueManager.clearFailed();
    return { success: true, count };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_PAUSE_ALL, async () => {
    await queueManager.pauseAll();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_RESUME_ALL, async () => {
    await queueManager.resumeAll();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_MOVE, async (_event, downloadId: string, newIndex: number) => {
    queueManager.moveDownload(downloadId, newIndex);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_SET_PRIORITY, async (_event, downloadId: string, priority: DownloadPriority) => {
    queueManager.setPriority(downloadId, priority);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_SET_CATEGORY, async (_event, downloadId: string, categoryId: string) => {
    queueManager.setCategory(downloadId, categoryId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_OPEN_FILE, async (_event, downloadId: string) => {
    const download = downloadEngine.getDownload(downloadId);
    if (download && download.status === 'completed') {
      await shell.openPath(download.savePath);
      return { success: true };
    }
    return { success: false, error: 'File not found or not completed' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_OPEN_FOLDER, async (_event, downloadId: string) => {
    const download = downloadEngine.getDownload(downloadId);
    if (download) {
      await shell.showItemInFolder(download.savePath);
      return { success: true };
    }
    return { success: false, error: 'Download not found' };
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_COPY_LINK, async (_event, downloadId: string) => {
    const download = downloadEngine.getDownload(downloadId);
    if (download) {
      const { clipboard } = require('electron');
      clipboard.writeText(download.url);
      return { success: true };
    }
    return { success: false, error: 'Download not found' };
  });

  // ============================================
  // Categories
  // ============================================

  ipcMain.handle(IPC_CHANNELS.CATEGORY_GET_ALL, async () => {
    return queueManager.getCategories();
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_GET, async (_event, id: string) => {
    return queueManager.getCategory(id);
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_ADD, async (_event, category: Omit<DownloadCategory, 'id'> & { id?: string }) => {
    const newCategory = queueManager.addCategory(category);
    return { success: true, category: newCategory };
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_UPDATE, async (_event, id: string, updates: Partial<DownloadCategory>) => {
    const category = queueManager.updateCategory(id, updates);
    return { success: !!category, category };
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_REMOVE, async (_event, id: string) => {
    const success = queueManager.removeCategory(id);
    return { success };
  });

  // ============================================
  // Settings
  // ============================================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    return settingsManager.getAll();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, section: keyof AllSettings) => {
    return settingsManager.get(section);
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_event, section: keyof AllSettings, updates: Partial<AllSettings[keyof AllSettings]>) => {
    await settingsManager.updateSection(section, updates);

    // Apply settings immediately
    const allSettings = settingsManager.getAll();
    applySettingsRuntime(allSettings, {
      clipboardMonitor,
      browserIntegration,
      queueManager,
      downloadEngine,
    });

    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async (_event, section?: keyof AllSettings) => {
    await settingsManager.resetToDefaults(section);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_EXPORT, async () => {
    const { filePath } = await dialog.showSaveDialog(getMainWindow()!, {
      title: 'Export Settings',
      defaultPath: 'alldown-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (filePath) {
      await settingsManager.exportSettings(filePath);
      return { success: true, path: filePath };
    }
    return { success: false, cancelled: true };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_IMPORT, async () => {
    const { filePaths } = await dialog.showOpenDialog(getMainWindow()!, {
      title: 'Import Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (filePaths.length > 0) {
      await settingsManager.importSettings(filePaths[0]);
      return { success: true };
    }
    return { success: false, cancelled: true };
  });

  // ============================================
  // Clipboard
  // ============================================

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_START, async () => {
    clipboardMonitor.start();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CLIPBOARD_STOP, async () => {
    clipboardMonitor.stop();
    return { success: true };
  });

  // ============================================
  // Browser Integration
  // ============================================

  ipcMain.handle(IPC_CHANNELS.BROWSER_START, async () => {
    browserIntegration.start();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_STOP, async () => {
    browserIntegration.stop();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.BROWSER_GET_STATUS, async () => {
    return browserIntegration.getStatus();
  });

  // ============================================
  // Media Sniffing
  // ============================================

  ipcMain.handle(IPC_CHANNELS.MEDIA_SNIFF, async (_event, pageUrl: string) => {
    const sniffer = new MediaSniffer(logger);
    const result = await sniffer.sniff(pageUrl);
    return { success: true, result };
  });

  // ============================================
  // Updates
  // ============================================

  ipcMain.handle(IPC_CHANNELS.UPDATE_CHECK, async () => {
    const info = await updateChecker.checkForUpdates();
    return info;
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_DOWNLOAD, async (_event, downloadUrl: string) => {
    const path = await updateChecker.downloadUpdate(downloadUrl);
    return { success: true, path };
  });

  // ============================================
  // System
  // ============================================

  ipcMain.handle(IPC_CHANNELS.SYSTEM_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_SHOW_ITEM_IN_FOLDER, async (_event, path: string) => {
    await shell.showItemInFolder(path);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_APP_VERSION, async () => {
    return { version: app.getVersion() };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_APP_PATH, async () => {
    return { path: app.getAppPath() };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_MINIMIZE, async () => {
    getMainWindow()?.minimize();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_MAXIMIZE, async () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_CLOSE, async () => {
    getMainWindow()?.hide();
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SYSTEM_QUIT, async () => {
    app.quit();
    return { success: true };
  });

  // ============================================
  // Statistics
  // ============================================

  ipcMain.handle(IPC_CHANNELS.STATS_GET, async () => {
    const downloads = downloadEngine.getAllDownloads();
    return calculateStats(downloads);
  });

  // ============================================
  // Event Forwarding (Main -> Renderer)
  // ============================================

  // Download progress
  downloadEngine.on('progress', (event) => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.DOWNLOAD_PROGRESS, event);
  });

  downloadEngine.on('stateChange', (event) => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.DOWNLOAD_STATE_CHANGE, event);
  });

  // Queue updates
  queueManager.on('queueUpdate', (event: QueueUpdateEvent) => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.QUEUE_UPDATE, event);
  });

  // Category updates
  queueManager.on('categoryUpdate', (event: CategoryUpdateEvent) => {
    getMainWindow()?.webContents.send(IPC_CHANNELS.CATEGORY_UPDATE_EVENT, event);
  });

  logger.info('IPC handlers registered');
}

// ============================================
// Helper Functions
// ============================================

function applySettingsRuntime(
  settings: AllSettings,
  services: {
    clipboardMonitor: ClipboardMonitor;
    browserIntegration: BrowserIntegration;
    queueManager: QueueManager;
    downloadEngine: DownloadEngine;
  }
): void {
  // Clipboard
  if (settings.browser.monitorClipboard) {
    services.clipboardMonitor.start();
  } else {
    services.clipboardMonitor.stop();
  }

  // Browser integration
  if (settings.browser.enabled) {
    services.browserIntegration.start();
  } else {
    services.browserIntegration.stop();
  }

  // Queue settings
  services.queueManager.updateSettings(settings.queue);
}

function calculateStats(downloads: DownloadFile[]): any {
  const stats = {
    totalDownloads: downloads.length,
    completedDownloads: 0,
    failedDownloads: 0,
    activeDownloads: 0,
    totalDownloaded: 0,
    totalTime: 0,
    averageSpeed: 0,
    byCategory: {} as Record<string, { count: number; size: number }>,
    byType: {} as Record<string, { count: number; size: number }>,
    dailyStats: [] as Array<{ date: string; count: number; size: number }>,
  };

  let totalSpeed = 0;
  let speedCount = 0;

  for (const d of downloads) {
    if (d.status === 'completed') {
      stats.completedDownloads++;
      stats.totalDownloaded += d.totalSize;
      if (d.startedAt && d.completedAt) {
        stats.totalTime += (d.completedAt - d.startedAt) / 1000;
      }
    } else if (d.status === 'failed') {
      stats.failedDownloads++;
    } else if (['downloading', 'connecting'].includes(d.status)) {
      stats.activeDownloads++;
    }

    // By category
    if (!stats.byCategory[d.category]) {
      stats.byCategory[d.category] = { count: 0, size: 0 };
    }
    stats.byCategory[d.category].count++;
    stats.byCategory[d.category].size += d.totalSize;

    // By type (extension)
    const ext = d.filename.split('.').pop()?.toLowerCase() || 'unknown';
    if (!stats.byType[ext]) {
      stats.byType[ext] = { count: 0, size: 0 };
    }
    stats.byType[ext].count++;
    stats.byType[ext].size += d.totalSize;

    // Speed
    if (d.speed > 0) {
      totalSpeed += d.speed;
      speedCount++;
    }
  }

  stats.averageSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

  // Daily stats (last 30 days)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dailyMap = new Map<string, { count: number; size: number }>();

  for (const d of downloads) {
    if (d.completedAt) {
      const date = new Date(d.completedAt).toISOString().split('T')[0];
      const existing = dailyMap.get(date) || { count: 0, size: 0 };
      existing.count++;
      existing.size += d.totalSize;
      dailyMap.set(date, existing);
    }
  }

  stats.dailyStats = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  return stats;
}