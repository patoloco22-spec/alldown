/**
 * AllDown - Queue Manager
 * Manages download queue with priorities, scheduling, categories, and persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import type {
  DownloadFile,
  DownloadStatus,
  DownloadPriority,
  DownloadCategory,
  QueueSettings,
  DownloadAddPayload,
  BatchDownloadPayload,
  QueueUpdateEvent,
} from '../../shared/types';
import { DownloadEngine } from '../engine/DownloadEngine';
import { SettingsManager } from '../settings/SettingsManager';
import { Logger } from '../utils/Logger';
import { DEFAULT_CATEGORIES } from '../../shared/types';

// ============================================
// Queue Manager Class
// ============================================

export class QueueManager extends EventEmitter {
  private downloadEngine: DownloadEngine;
  private settingsManager: SettingsManager;
  private logger: Logger;
  private queueFile: string;
  private categoryFile: string;
  private categories: Map<string, DownloadCategory> = new Map();
  private processingQueue: boolean = false;

  constructor(downloadEngine: DownloadEngine, settingsManager: SettingsManager, logger: Logger) {
    super();
    this.downloadEngine = downloadEngine;
    this.settingsManager = settingsManager;
    this.logger = logger;

    const userDataPath = this.settingsManager.getUserDataPath();
    this.queueFile = path.join(userDataPath, 'queue.json');
    this.categoryFile = path.join(userDataPath, 'categories.json');

    this.loadCategories();
    this.loadQueue();
    this.setMaxListeners(100);
  }

  // ============================================
  // Public API - Download Management
  // ============================================

  async addDownload(payload: DownloadAddPayload): Promise<DownloadFile> {
    const download = await this.downloadEngine.addDownload(payload);

    // Auto-categorize if not specified
    if (!payload.category) {
      download.category = this.categorizeByExtension(download.filename);
    }

    // Save to persistent queue
    await this.saveQueue();

    this.emit('queueUpdate', {
      type: 'added',
      downloadIds: [download.id],
    } as QueueUpdateEvent);

    this.logger.info('Download added to queue', { id: download.id, url: download.url });
    return download;
  }

  async addBatchDownload(payload: BatchDownloadPayload): Promise<DownloadFile[]> {
    const downloads: DownloadFile[] = [];

    for (const url of payload.urls) {
      try {
        const download = await this.addDownload({
          url,
          category: payload.category,
          priority: payload.priority,
          threadCount: payload.threadCount,
          savePath: payload.savePath,
        });
        downloads.push(download);
      } catch (error) {
        this.logger.error('Failed to add batch download', { url, error: String(error) });
      }
    }

    return downloads;
  }

  async pauseDownload(downloadId: string): Promise<void> {
    await this.downloadEngine.pauseDownload(downloadId);
    await this.saveQueue();
  }

  async resumeDownload(downloadId: string): Promise<void> {
    await this.downloadEngine.resumeDownload(downloadId);
    await this.saveQueue();
  }

  async cancelDownload(downloadId: string, deleteFile = false): Promise<void> {
    await this.downloadEngine.cancelDownload(downloadId, deleteFile);
    await this.saveQueue();
  }

  async retryDownload(downloadId: string): Promise<void> {
    await this.downloadEngine.retryDownload(downloadId);
    await this.saveQueue();
  }

  removeDownload(downloadId: string): void {
    this.downloadEngine.removeDownload(downloadId);
    this.saveQueue();

    this.emit('queueUpdate', {
      type: 'removed',
      downloadIds: [downloadId],
    } as QueueUpdateEvent);
  }

  async clearCompleted(): Promise<number> {
    const downloads = this.downloadEngine.getAllDownloads();
    let count = 0;

    for (const download of downloads) {
      if (download.status === 'completed') {
        this.removeDownload(download.id);
        count++;
      }
    }

    return count;
  }

  async clearFailed(): Promise<number> {
    const downloads = this.downloadEngine.getAllDownloads();
    let count = 0;

    for (const download of downloads) {
      if (download.status === 'failed') {
        this.removeDownload(download.id);
        count++;
      }
    }

    return count;
  }

  async pauseAll(): Promise<void> {
    await this.downloadEngine.pauseAll();
    await this.saveQueue();
  }

  async resumeAll(): Promise<void> {
    await this.downloadEngine.resumeAll();
    await this.saveQueue();
  }

  // ============================================
  // Queue Operations
  // ============================================

  moveDownload(downloadId: string, newIndex: number): void {
    // Implementation for reordering queue
    this.emit('queueUpdate', {
      type: 'reordered',
      downloadIds: [downloadId],
    } as QueueUpdateEvent);
    this.saveQueue();
  }

  setPriority(downloadId: string, priority: DownloadPriority): void {
    const download = this.downloadEngine.getDownload(downloadId);
    if (download) {
      download.priority = priority;
      download.updatedAt = Date.now();
      this.saveQueue();
    }
  }

  setCategory(downloadId: string, categoryId: string): void {
    const download = this.downloadEngine.getDownload(downloadId);
    const category = this.categories.get(categoryId);
    if (download && category) {
      download.category = categoryId;
      download.updatedAt = Date.now();
      this.saveQueue();
    }
  }

  // ============================================
  // Category Management
  // ============================================

  getCategories(): DownloadCategory[] {
    return Array.from(this.categories.values()).sort((a, b) => a.order - b.order);
  }

  getCategory(id: string): DownloadCategory | undefined {
    return this.categories.get(id);
  }

  addCategory(category: Omit<DownloadCategory, 'id'> & { id?: string }): DownloadCategory {
    const newCategory: DownloadCategory = {
      ...category,
      id: category.id || `cat_${Date.now()}`,
    };

    this.categories.set(newCategory.id, newCategory);
    this.saveCategories();
    return newCategory;
  }

  updateCategory(id: string, updates: Partial<DownloadCategory>): DownloadCategory | undefined {
    const category = this.categories.get(id);
    if (!category) return undefined;

    const updated = { ...category, ...updates };
    this.categories.set(id, updated);
    this.saveCategories();
    return updated;
  }

  removeCategory(id: string): boolean {
    if (id === 'other') return false; // Cannot remove default category

    const deleted = this.categories.delete(id);
    if (deleted) {
      // Move downloads from this category to 'other'
      const downloads = this.downloadEngine.getAllDownloads();
      for (const download of downloads) {
        if (download.category === id) {
          download.category = 'other';
        }
      }
      this.saveCategories();
      this.saveQueue();
    }
    return deleted;
  }

  categorizeByExtension(filename: string): string {
    const ext = path.extname(filename).slice(1).toLowerCase();

    for (const category of this.categories.values()) {
      if (category.extensions.includes(ext)) {
        return category.id;
      }
    }

    return 'other';
  }

  // ============================================
  // Settings
  // ============================================

  updateSettings(settings: QueueSettings): void {
    // Engine will pick up new settings on next operation
    this.processQueue();
  }

  // ============================================
  // Persistence
  // ============================================

  private async saveQueue(): Promise<void> {
    try {
      const downloads = this.downloadEngine.getAllDownloads();
      const data = downloads.map(d => ({
        ...d,
        // Don't save functions or complex objects
        chunks: d.chunks.map(c => ({ ...c })),
      }));

      await fs.promises.writeFile(this.queueFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save queue', { error: String(error) });
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      if (!fs.existsSync(this.queueFile)) return;

      const data = JSON.parse(await fs.promises.readFile(this.queueFile, 'utf-8'));

      for (const item of data) {
        // Restore download to engine
        const download: DownloadFile = {
          ...item,
          status: item.status === 'downloading' ? 'paused' : item.status, // Pause active downloads on restart
          chunks: item.chunks.map((c: any) => ({
            ...c,
            status: c.status === 'downloading' ? 'pending' : c.status,
          })),
        };

        // Re-add to engine (without starting)
        this.downloadEngine.getAllDownloads(); // This just accesses the map
        (this.downloadEngine as any).downloads.set(download.id, download);
      }

      this.logger.info('Queue loaded', { count: data.length });
    } catch (error) {
      this.logger.error('Failed to load queue', { error: String(error) });
    }
  }

  private async saveCategories(): Promise<void> {
    try {
      const data = Array.from(this.categories.values());
      await fs.promises.writeFile(this.categoryFile, JSON.stringify(data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save categories', { error: String(error) });
    }
  }

  private loadCategories(): void {
    try {
      if (fs.existsSync(this.categoryFile)) {
        const data = JSON.parse(fs.readFileSync(this.categoryFile, 'utf-8'));
        for (const cat of data) {
          this.categories.set(cat.id, cat);
        }
      } else {
        // Load defaults
        for (const cat of DEFAULT_CATEGORIES) {
          this.categories.set(cat.id, cat);
        }
        this.saveCategories();
      }
    } catch (error) {
      this.logger.error('Failed to load categories', { error: String(error) });
      // Fallback to defaults
      for (const cat of DEFAULT_CATEGORIES) {
        this.categories.set(cat.id, cat);
      }
    }
  }

  // ============================================
  // Queue Processing
  // ============================================

  private processQueue(): void {
    if (this.processingQueue) return;
    this.processingQueue = true;

    const downloads = this.downloadEngine.getAllDownloads();
    const queued = downloads.filter(d => d.status === 'queued');

    // Sort by priority
    const priorityOrder: Record<DownloadPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    queued.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Start downloads up to concurrency limit
    for (const download of queued) {
      const activeCount = this.downloadEngine.getActiveDownloadCount();
      const settings = this.settingsManager.getAll().queue;

      if (activeCount >= settings.maxConcurrentDownloads) break;

      this.downloadEngine.startDownload(download.id).catch(err => {
        this.logger.error('Failed to start queued download', { id: download.id, error: String(err) });
      });
    }

    this.processingQueue = false;
  }

  hasActiveDownloads(): boolean {
    return this.downloadEngine.hasActiveDownloads();
  }

  hasPausedDownloads(): boolean {
    return this.downloadEngine.hasPausedDownloads();
  }
}