/**
 * AllDown - Download Engine
 * Core multi-threaded download engine with pause/resume, chunk management, and progress tracking
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import fetch, { RequestInit, Response } from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type {
  DownloadFile,
  DownloadChunk,
  DownloadStatus,
  DownloadPriority,
  ProxyConfig,
  ScheduleConfig,
  FileVerification,
  DownloadProgressEvent,
  DownloadStateChangeEvent,
  DownloadAddPayload,
} from '@shared/types';
import { Logger } from '../utils/Logger';
import { SettingsManager } from '../settings/SettingsManager';

// ============================================
// Constants
// ============================================

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MIN_CHUNK_SIZE = 1024 * 1024; // 1MB minimum
const PROGRESS_UPDATE_INTERVAL = 500; // ms
const SPEED_CALCULATION_WINDOW = 5000; // ms
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // ms

// ============================================
// Types
// ============================================

interface DownloadThread {
  chunkIndex: number;
  controller: AbortController;
  promise: Promise<void>;
  downloaded: number;
  startTime: number;
  lastSpeedUpdate: number;
  recentBytes: number;
}

interface SpeedSample {
  timestamp: number;
  bytes: number;
}

interface DownloadOptions {
  url: string;
  filename?: string;
  savePath?: string;
  category?: string;
  priority?: DownloadPriority;
  threadCount?: number;
  headers?: Record<string, string>;
  referrer?: string;
  cookies?: string;
  schedule?: ScheduleConfig;
  proxy?: ProxyConfig;
  bandwidthLimit?: number;
}

// ============================================
// Download Engine Class
// ============================================

export class DownloadEngine extends EventEmitter {
  private downloads: Map<string, DownloadFile> = new Map();
  private activeThreads: Map<string, DownloadThread[]> = new Map();
  private settings: SettingsManager;
  private logger: Logger;
  private speedSamples: Map<string, SpeedSample[]> = new Map();
  private progressIntervals: Map<string, NodeJS.Timeout> = new Map();
  private bandwidthThrottles: Map<string, { tokens: number; lastRefill: number }> = new Map();

  constructor(settings: SettingsManager, logger: Logger) {
    super();
    this.settings = settings;
    this.logger = logger;
    this.setMaxListeners(100);
  }

  // ============================================
  // Public API
  // ============================================

  async addDownload(options: DownloadOptions): Promise<DownloadFile> {
    const download = await this.createDownload(options);
    this.downloads.set(download.id, download);

    // Check if scheduled
    if (download.schedule?.enabled && download.schedule.startTime && download.schedule.startTime > Date.now()) {
      download.status = 'queued';
      this.scheduleDownload(download);
    } else {
      await this.startDownload(download.id);
    }

    return download;
  }

  async startDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) throw new Error('Download not found');

    if (['downloading', 'connecting'].includes(download.status)) {
      return; // Already running
    }

    // Check concurrency limits
    const queueSettings = this.settings.getAll().queue;
    const activeCount = this.getActiveDownloadCount();
    if (activeCount >= queueSettings.maxConcurrentDownloads) {
      download.status = 'queued';
      this.emit('progress', this.createProgressEvent(download));
      return;
    }

    // Check per-host limit
    const host = new URL(download.url).hostname;
    const hostActiveCount = this.getActiveDownloadCountForHost(host);
    if (hostActiveCount >= queueSettings.maxConcurrentPerHost) {
      download.status = 'queued';
      this.emit('progress', this.createProgressEvent(download));
      return;
    }

    await this.executeDownload(download);
  }

  async pauseDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) throw new Error('Download not found');

    if (!['downloading', 'connecting'].includes(download.status)) {
      return;
    }

    await this.stopDownloadThreads(downloadId);
    download.status = 'paused';
    download.updatedAt = Date.now();
    this.emit('progress', this.createProgressEvent(download));
    this.emit('stateChange', this.createStateChangeEvent(download, 'paused'));
  }

  async resumeDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) throw new Error('Download not found');

    if (download.status !== 'paused') {
      return;
    }

    await this.startDownload(downloadId);
  }

  async cancelDownload(downloadId: string, deleteFile = false): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) throw new Error('Download not found');

    await this.stopDownloadThreads(downloadId);

    if (deleteFile && fs.existsSync(download.savePath)) {
      try {
        fs.unlinkSync(download.savePath);
        // Also delete temp files
        const tempDir = path.dirname(download.savePath);
        const tempFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(`${download.filename}.part`));
        for (const f of tempFiles) {
          fs.unlinkSync(path.join(tempDir, f));
        }
      } catch (e) {
        this.logger.warn('Failed to delete file on cancel', { error: String(e) });
      }
    }

    download.status = 'cancelled';
    download.updatedAt = Date.now();
    this.emit('progress', this.createProgressEvent(download));
    this.emit('stateChange', this.createStateChangeEvent(download, 'cancelled'));
  }

  async retryDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) throw new Error('Download not found');

    // Reset download state
    download.status = 'pending';
    download.error = undefined;
    download.downloadedSize = 0;
    download.progress = 0;
    download.speed = 0;
    download.eta = 0;
    download.chunks.forEach(chunk => {
      chunk.downloaded = 0;
      chunk.status = 'pending';
    });
    download.updatedAt = Date.now();

    // Remove partial files
    try {
      if (fs.existsSync(download.savePath)) fs.unlinkSync(download.savePath);
      const tempDir = path.dirname(download.savePath);
      const tempFiles = fs.readdirSync(tempDir).filter(f => f.startsWith(`${download.filename}.part`));
      for (const f of tempFiles) {
        fs.unlinkSync(path.join(tempDir, f));
      }
    } catch (e) {
      this.logger.warn('Failed to clean up on retry', { error: String(e) });
    }

    await this.startDownload(downloadId);
  }

  removeDownload(downloadId: string): void {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    this.downloads.delete(downloadId);
    this.speedSamples.delete(downloadId);
    this.bandwidthThrottles.delete(downloadId);

    const interval = this.progressIntervals.get(downloadId);
    if (interval) clearInterval(interval);
    this.progressIntervals.delete(downloadId);
  }

  getDownload(downloadId: string): DownloadFile | undefined {
    return this.downloads.get(downloadId);
  }

  getAllDownloads(): DownloadFile[] {
    return Array.from(this.downloads.values());
  }

  getActiveDownloadCount(): number {
    let count = 0;
    for (const download of this.downloads.values()) {
      if (['downloading', 'connecting'].includes(download.status)) count++;
    }
    return count;
  }

  getActiveDownloadCountForHost(host: string): number {
    let count = 0;
    for (const download of this.downloads.values()) {
      if (['downloading', 'connecting'].includes(download.status)) {
        try {
          if (new URL(download.url).hostname === host) count++;
        } catch {}
      }
    }
    return count;
  }

  hasActiveDownloads(): boolean {
    return this.getActiveDownloadCount() > 0;
  }

  hasPausedDownloads(): boolean {
    for (const download of this.downloads.values()) {
      if (download.status === 'paused') return true;
    }
    return false;
  }

  async pauseAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const download of this.downloads.values()) {
      if (['downloading', 'connecting'].includes(download.status)) {
        promises.push(this.pauseDownload(download.id));
      }
    }
    await Promise.all(promises);
  }

  async resumeAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const download of this.downloads.values()) {
      if (download.status === 'paused') {
        promises.push(this.resumeDownload(download.id));
      }
    }
    await Promise.all(promises);
  }

  destroy(): void {
    // Stop all downloads
    for (const downloadId of this.downloads.keys()) {
      this.stopDownloadThreads(downloadId);
    }

    // Clear intervals
    for (const interval of this.progressIntervals.values()) {
      clearInterval(interval);
    }
    this.progressIntervals.clear();

    this.removeAllListeners();
  }

  // ============================================
  // Core Download Logic
  // ============================================

  private async createDownload(options: DownloadOptions): Promise<DownloadFile> {
    const id = crypto.randomUUID();
    const now = Date.now();

    // Determine filename
    let filename = options.filename;
    if (!filename) {
      try {
        const url = new URL(options.url);
        filename = path.basename(url.pathname) || 'download';
        if (!path.extname(filename)) {
          filename += '.bin';
        }
      } catch {
        filename = 'download.bin';
      }
    }

    // Determine save path
    const basePath = options.savePath || this.settings.getAll().downloads.defaultSavePath;
    const category = this.settings.getAll().categories.find(c => c.id === options.category);
    const saveDir = category ? path.join(basePath, category.name) : basePath;
    const savePath = path.join(saveDir, filename);

    // Ensure directory exists
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }

    // Handle existing file
    const downloadSettings = this.settings.getAll().downloads;
    let finalPath = savePath;
    if (fs.existsSync(savePath)) {
      switch (downloadSettings.overwriteBehavior) {
        case 'overwrite':
          break;
        case 'skip':
          throw new Error('File already exists');
        case 'ask':
          // In real app, would show dialog - for now rename
        case 'rename':
        default:
          finalPath = this.getUniquePath(savePath);
      }
    }

    // Create chunks (will be adjusted after HEAD request)
    const threadCount = Math.min(options.threadCount || downloadSettings.defaultThreadCount, 64);
    const chunks: DownloadChunk[] = Array.from({ length: threadCount }, (_, i) => ({
      index: i,
      start: 0,
      end: 0,
      downloaded: 0,
      status: 'pending' as const,
    }));

    const download: DownloadFile = {
      id,
      url: options.url,
      filename: path.basename(finalPath),
      savePath: finalPath,
      totalSize: 0,
      downloadedSize: 0,
      status: 'pending',
      priority: options.priority || downloadSettings.defaultPriority,
      chunks,
      threadCount,
      speed: 0,
      eta: 0,
      progress: 0,
      headers: options.headers || {},
      referrer: options.referrer,
      cookies: options.cookies,
      userAgent: this.settings.getAll().downloads.userAgent,
      proxy: options.proxy,
      bandwidthLimit: options.bandwidthLimit,
      schedule: options.schedule,
      category: options.category || 'other',
      tags: [],
      createdAt: now,
      updatedAt: now,
      metadata: {
        supportsRange: false,
        redirects: [],
      },
    };

    return download;
  }

  private getUniquePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    let counter = 1;
    let newPath = filePath;

    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${name} (${counter})${ext}`);
      counter++;
    }

    return newPath;
  }

  private async executeDownload(download: DownloadFile): Promise<void> {
    download.status = 'connecting';
    download.startedAt = download.startedAt || Date.now();
    download.updatedAt = Date.now();
    this.emit('progress', this.createProgressEvent(download));
    this.emit('stateChange', this.createStateChangeEvent(download, 'connecting'));

    try {
      // Initial HEAD request to get file info
      const fileInfo = await this.fetchFileInfo(download);
      download.totalSize = fileInfo.totalSize;
      download.metadata.supportsRange = fileInfo.supportsRange;
      download.metadata.contentType = fileInfo.contentType;
      download.metadata.contentDisposition = fileInfo.contentDisposition;
      download.metadata.lastModified = fileInfo.lastModified;
      download.metadata.etag = fileInfo.etag;
      download.metadata.redirects = fileInfo.redirects;

      // Update filename from Content-Disposition if available
      if (fileInfo.contentDisposition && !download.filename) {
        const filenameMatch = fileInfo.contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          download.filename = filenameMatch[1].replace(/['"]/g, '');
          download.savePath = path.join(path.dirname(download.savePath), download.filename);
        }
      }

      // Calculate chunks
      this.calculateChunks(download);

      // Check for existing partial download (resume)
      await this.checkResumeCapability(download);

      // Start download threads
      download.status = 'downloading';
      download.updatedAt = Date.now();
      this.emit('progress', this.createProgressEvent(download));
      this.emit('stateChange', this.createStateChangeEvent(download, 'downloading'));

      await this.startDownloadThreads(download);

      // Start progress reporting
      this.startProgressReporting(download.id);

    } catch (error) {
      await this.handleDownloadError(download, error);
    }
  }

  private async fetchFileInfo(download: DownloadFile): Promise<{
    totalSize: number;
    supportsRange: boolean;
    contentType?: string;
    contentDisposition?: string;
    lastModified?: string;
    etag?: string;
    redirects: string[];
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.getAll().downloads.connectTimeout * 1000);

    try {
      const response = await this.fetchWithProxy(download.url, {
        method: 'HEAD',
        headers: this.buildHeaders(download),
        signal: controller.signal,
        redirect: 'manual',
      }, download.proxy);

      clearTimeout(timeout);

      // Follow redirects manually to track them
      const redirects: string[] = [];
      let currentResponse = response;
      let currentUrl = download.url;

      while ([301, 302, 303, 307, 308].includes(currentResponse.status)) {
        const location = currentResponse.headers.get('location');
        if (!location) break;

        const redirectUrl = new URL(location, currentUrl).href;
        redirects.push(redirectUrl);
        currentUrl = redirectUrl;

        const nextResponse = await this.fetchWithProxy(currentUrl, {
          method: 'HEAD',
          headers: this.buildHeaders(download),
          signal: controller.signal,
          redirect: 'manual',
        }, download.proxy);

        currentResponse = nextResponse;
      }

      const contentLength = currentResponse.headers.get('content-length');
      const acceptRanges = currentResponse.headers.get('accept-ranges');
      const contentType = currentResponse.headers.get('content-type');
      const contentDisposition = currentResponse.headers.get('content-disposition');
      const lastModified = currentResponse.headers.get('last-modified');
      const etag = currentResponse.headers.get('etag');

      return {
        totalSize: contentLength ? parseInt(contentLength, 10) : 0,
        supportsRange: acceptRanges === 'bytes',
        contentType: contentType || undefined,
        contentDisposition: contentDisposition || undefined,
        lastModified: lastModified || undefined,
        etag: etag || undefined,
        redirects,
      };
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }

  private calculateChunks(download: DownloadFile): void {
    const { totalSize, threadCount } = download;
    if (totalSize <= 0 || !download.metadata.supportsRange) {
      // Single chunk for unknown size or non-range-supported
      download.chunks = [{
        index: 0,
        start: 0,
        end: totalSize,
        downloaded: 0,
        status: 'pending',
      }];
      download.threadCount = 1;
      return;
    }

    const chunkSize = Math.max(MIN_CHUNK_SIZE, Math.ceil(totalSize / threadCount));
    const actualThreadCount = Math.min(threadCount, Math.ceil(totalSize / chunkSize));

    download.chunks = Array.from({ length: actualThreadCount }, (_, i) => {
      const start = i * chunkSize;
      const end = i === actualThreadCount - 1 ? totalSize : (i + 1) * chunkSize - 1;
      return {
        index: i,
        start,
        end,
        downloaded: 0,
        status: 'pending' as const,
      };
    });
    download.threadCount = actualThreadCount;
  }

  private async checkResumeCapability(download: DownloadFile): Promise<void> {
    const tempDir = path.dirname(download.savePath);
    const baseName = path.basename(download.savePath);

    for (const chunk of download.chunks) {
      const chunkPath = path.join(tempDir, `${baseName}.part${chunk.index}`);
      if (fs.existsSync(chunkPath)) {
        const stats = fs.statSync(chunkPath);
        if (stats.size > 0 && stats.size <= (chunk.end - chunk.start + 1)) {
          chunk.downloaded = stats.size;
          chunk.status = 'pending'; // Will be resumed
          download.downloadedSize += stats.size;
        }
      }
    }

    // Also check for combined temp file
    const combinedPath = path.join(tempDir, `${baseName}.tmp`);
    if (fs.existsSync(combinedPath) && download.chunks.length === 1) {
      const stats = fs.statSync(combinedPath);
      if (stats.size > 0) {
        download.chunks[0].downloaded = stats.size;
        download.chunks[0].status = 'pending';
        download.downloadedSize = stats.size;
      }
    }

    download.progress = download.totalSize > 0 ? (download.downloadedSize / download.totalSize) * 100 : 0;
  }

  private async startDownloadThreads(download: DownloadFile): Promise<void> {
    const threads: DownloadThread[] = [];

    for (const chunk of download.chunks) {
      if (chunk.status === 'completed') continue;

      const thread = this.createDownloadThread(download, chunk);
      threads.push(thread);
    }

    this.activeThreads.set(download.id, threads);

    // Wait for all threads to complete
    try {
      await Promise.all(threads.map(t => t.promise));
      await this.finalizeDownload(download);
    } catch (error) {
      // Error handled in thread
    } finally {
      this.activeThreads.delete(download.id);
    }
  }

  private createDownloadThread(download: DownloadFile, chunk: DownloadChunk): DownloadThread {
    const controller = new AbortController();
    const startTime = Date.now();

    const promise = (async () => {
      chunk.status = 'downloading';
      let retryCount = 0;

      while (retryCount <= MAX_RETRIES) {
        try {
          await this.downloadChunk(download, chunk, controller);
          chunk.status = 'completed';
          break;
        } catch (error) {
          if (controller.signal.aborted) {
            chunk.status = 'pending';
            throw new Error('Cancelled');
          }

          retryCount++;
          if (retryCount > MAX_RETRIES) {
            chunk.status = 'failed';
            throw error;
          }

          this.logger.warn(`Chunk ${chunk.index} retry ${retryCount}/${MAX_RETRIES}`, {
            downloadId: download.id,
            error: String(error),
          });

          await new Promise(r => setTimeout(r, RETRY_DELAY * retryCount));
        }
      }
    })();

    return {
      chunkIndex: chunk.index,
      controller,
      promise,
      downloaded: 0,
      startTime,
      lastSpeedUpdate: startTime,
      recentBytes: 0,
    };
  }

  private async downloadChunk(download: DownloadFile, chunk: DownloadChunk, controller: AbortController): Promise<void> {
    const startByte = chunk.start + chunk.downloaded;
    const endByte = chunk.end;

    if (startByte > endByte) return; // Already complete

    const response = await this.fetchWithProxy(download.url, {
      method: 'GET',
      headers: {
        ...this.buildHeaders(download),
        'Range': `bytes=${startByte}-${endByte}`,
      },
      signal: controller.signal,
    }, download.proxy);

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (match) {
        const chunkStart = parseInt(match[1], 10);
        const chunkEnd = parseInt(match[2], 10);
        const totalSize = parseInt(match[3], 10);
        download.totalSize = totalSize;
      }
    }

    // Create write stream for this chunk
    const tempDir = path.dirname(download.savePath);
    const baseName = path.basename(download.savePath);
    const chunkPath = path.join(tempDir, `${baseName}.part${chunk.index}`);

    const writeStream = fs.createWriteStream(chunkPath, { flags: 'a' });

    return new Promise((resolve, reject) => {
      let chunkDownloaded = 0;
      const reader = response.body?.getReader();

      if (!reader) {
        writeStream.end();
        reject(new Error('No response body'));
        return;
      }

      const pump = async () => {
        try {
          while (true) {
            if (controller.signal.aborted) {
              writeStream.end();
              reject(new Error('Cancelled'));
              return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            // Apply bandwidth limiting
            if (download.bandwidthLimit && download.bandwidthLimit > 0) {
              await this.throttleBandwidth(download.id, value.length, download.bandwidthLimit);
            }

            writeStream.write(value);
            chunkDownloaded += value.length;
            chunk.downloaded = chunkDownloaded + (chunk.downloaded - (startByte - chunk.start));
            download.downloadedSize += value.length;

            // Update speed samples
            this.recordSpeedSample(download.id, value.length);
          }

          writeStream.end();
          resolve();
        } catch (error) {
          writeStream.destroy();
          reject(error);
        }
      };

      pump();
    });
  }

  private async finalizeDownload(download: DownloadFile): Promise<void> {
    // Verify all chunks completed
    const allCompleted = download.chunks.every(c => c.status === 'completed');
    if (!allCompleted) {
      const failedChunk = download.chunks.find(c => c.status === 'failed');
      throw new Error(`Chunk ${failedChunk?.index} failed`);
    }

    // Combine chunks into final file
    const tempDir = path.dirname(download.savePath);
    const baseName = path.basename(download.savePath);
    const finalPath = download.savePath;

    const writeStream = fs.createWriteStream(finalPath);

    try {
      for (const chunk of download.chunks) {
        const chunkPath = path.join(tempDir, `${baseName}.part${chunk.index}`);
        if (fs.existsSync(chunkPath)) {
          const chunkData = fs.readFileSync(chunkPath);
          writeStream.write(chunkData);
          fs.unlinkSync(chunkPath);
        }
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Verify file size
      const stats = fs.statSync(finalPath);
      if (stats.size !== download.totalSize && download.totalSize > 0) {
        this.logger.warn('File size mismatch', {
          expected: download.totalSize,
          actual: stats.size,
        });
      }

      // Run verification if enabled
      if (download.verification?.enabled && download.verification.expectedHash) {
        download.status = 'verifying';
        this.emit('progress', this.createProgressEvent(download));
        this.emit('stateChange', this.createStateChangeEvent(download, 'verifying'));

        const actualHash = await this.calculateHash(finalPath, download.verification.algorithm);
        download.verification.actualHash = actualHash;
        download.verification.verified = actualHash === download.verification.expectedHash;

        if (!download.verification.verified) {
          throw new Error('File verification failed: hash mismatch');
        }
      }

      download.status = 'completed';
      download.completedAt = Date.now();
      download.progress = 100;
      download.downloadedSize = download.totalSize;
      download.updatedAt = Date.now();

      this.emit('progress', this.createProgressEvent(download));
      this.emit('stateChange', this.createStateChangeEvent(download, 'completed'));

      this.logger.info('Download completed', { downloadId: download.id, path: finalPath });

    } catch (error) {
      writeStream.destroy();
      if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
      throw error;
    }
  }

  private async calculateHash(filePath: string, algorithm: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  private async handleDownloadError(download: DownloadFile, error: unknown): Promise<void> {
    await this.stopDownloadThreads(download.id);

    download.status = 'failed';
    download.error = error instanceof Error ? error.message : String(error);
    download.updatedAt = Date.now();

    this.emit('progress', this.createProgressEvent(download));
    this.emit('stateChange', this.createStateChangeEvent(download, 'failed', download.error));

    this.logger.error('Download failed', {
      downloadId: download.id,
      url: download.url,
      error: download.error,
    });
  }

  private async stopDownloadThreads(downloadId: string): Promise<void> {
    const threads = this.activeThreads.get(downloadId);
    if (!threads) return;

    for (const thread of threads) {
      thread.controller.abort();
    }

    // Wait for threads to clean up
    await Promise.allSettled(threads.map(t => t.promise));
    this.activeThreads.delete(downloadId);

    const interval = this.progressIntervals.get(downloadId);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(downloadId);
    }
  }

  // ============================================
  // Network & Proxy
  // ============================================

  private buildHeaders(download: DownloadFile): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': download.userAgent || this.settings.getAll().downloads.userAgent,
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Don't accept compressed for range requests
      'Connection': 'keep-alive',
    };

    if (download.referrer) {
      headers['Referer'] = download.referrer;
    }

    if (download.cookies) {
      headers['Cookie'] = download.cookies;
    }

    // Add custom headers
    Object.assign(headers, download.headers);

    return headers;
  }

  private async fetchWithProxy(
    url: string,
    options: RequestInit,
    proxy?: ProxyConfig
  ): Promise<Response> {
    let agent: any;

    if (proxy?.enabled) {
      const proxyUrl = `${proxy.type}://${proxy.username ? `${proxy.username}:${proxy.password}@` : ''}${proxy.host}:${proxy.port}`;

      if (proxy.type === 'socks4' || proxy.type === 'socks5') {
        agent = new SocksProxyAgent(proxyUrl);
      } else {
        agent = new HttpsProxyAgent(proxyUrl);
      }
    }

    return fetch(url, {
      ...options,
      agent,
      follow: 0, // Handle redirects manually
      timeout: this.settings.getAll().downloads.readTimeout * 1000,
    });
  }

  // ============================================
  // Bandwidth Throttling
  // ============================================

  private async throttleBandwidth(downloadId: string, bytes: number, limit: number): Promise<void> {
    const now = Date.now();
    let throttle = this.bandwidthThrottles.get(downloadId);

    if (!throttle) {
      throttle = { tokens: limit, lastRefill: now };
      this.bandwidthThrottles.set(downloadId, throttle);
    }

    // Refill tokens based on time passed
    const elapsed = now - throttle.lastRefill;
    const refillAmount = (elapsed / 1000) * limit;
    throttle.tokens = Math.min(limit, throttle.tokens + refillAmount);
    throttle.lastRefill = now;

    if (throttle.tokens >= bytes) {
      throttle.tokens -= bytes;
      return;
    }

    // Need to wait for tokens
    const deficit = bytes - throttle.tokens;
    const waitTime = (deficit / limit) * 1000;

    throttle.tokens = 0;
    await new Promise(r => setTimeout(r, waitTime));
  }

  // ============================================
  // Progress & Speed Tracking
  // ============================================

  private startProgressReporting(downloadId: string): void {
    const interval = setInterval(() => {
      const download = this.downloads.get(downloadId);
      if (!download || !['downloading', 'connecting'].includes(download.status)) {
        clearInterval(interval);
        this.progressIntervals.delete(downloadId);
        return;
      }

      this.updateDownloadProgress(download);
      this.emit('progress', this.createProgressEvent(download));
    }, PROGRESS_UPDATE_INTERVAL);

    this.progressIntervals.set(downloadId, interval);
  }

  private updateDownloadProgress(download: DownloadFile): void {
    const now = Date.now();
    const samples = this.speedSamples.get(downloadId) || [];

    // Calculate speed (bytes/second) over the window
    const windowStart = now - SPEED_CALCULATION_WINDOW;
    const recentSamples = samples.filter(s => s.timestamp >= windowStart);
    const totalBytes = recentSamples.reduce((sum, s) => sum + s.bytes, 0);
    const timeSpan = Math.max(1, (recentSamples[recentSamples.length - 1]?.timestamp || now) - (recentSamples[0]?.timestamp || now));

    download.speed = totalBytes / (timeSpan / 1000);

    // Calculate ETA
    if (download.speed > 0 && download.totalSize > download.downloadedSize) {
      download.eta = Math.ceil((download.totalSize - download.downloadedSize) / download.speed);
    } else {
      download.eta = 0;
    }

    // Update progress
    if (download.totalSize > 0) {
      download.progress = (download.downloadedSize / download.totalSize) * 100;
    }

    download.updatedAt = now;
  }

  private recordSpeedSample(downloadId: string, bytes: number): void {
    const samples = this.speedSamples.get(downloadId) || [];
    samples.push({ timestamp: Date.now(), bytes });

    // Keep only recent samples
    const cutoff = Date.now() - SPEED_CALCULATION_WINDOW * 2;
    const filtered = samples.filter(s => s.timestamp > cutoff);

    this.speedSamples.set(downloadId, filtered);
  }

  // ============================================
  // Scheduling
  // ============================================

  private scheduleDownload(download: DownloadFile): void {
    if (!download.schedule?.enabled || !download.schedule.startTime) return;

    const delay = download.schedule.startTime - Date.now();
    if (delay <= 0) {
      this.startDownload(download.id);
      return;
    }

    setTimeout(() => {
      const d = this.downloads.get(download.id);
      if (d && d.status === 'queued') {
        this.startDownload(download.id);
      }
    }, delay);
  }

  // ============================================
  // Event Creation
  // ============================================

  private createProgressEvent(download: DownloadFile): DownloadProgressEvent {
    return {
      downloadId: download.id,
      progress: download.progress,
      downloadedSize: download.downloadedSize,
      totalSize: download.totalSize,
      speed: download.speed,
      eta: download.eta,
      status: download.status,
    };
  }

  private createStateChangeEvent(
    download: DownloadFile,
    newStatus: DownloadStatus,
    error?: string
  ): DownloadStateChangeEvent {
    return {
      downloadId: download.id,
      previousStatus: download.status,
      newStatus,
      error,
    };
  }
}