/**
 * AllDown - Shared Type Definitions
 * Core types used across main and renderer processes
 */

// ============================================
// Download Core Types
// ============================================

export type DownloadStatus =
  | 'pending'
  | 'queued'
  | 'connecting'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'verifying';

export type DownloadPriority = 'low' | 'normal' | 'high' | 'critical';

export interface DownloadChunk {
  index: number;
  start: number;
  end: number;
  downloaded: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  threadId?: number;
}

export interface DownloadFile {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  totalSize: number;
  downloadedSize: number;
  status: DownloadStatus;
  priority: DownloadPriority;
  chunks: DownloadChunk[];
  threadCount: number;
  speed: number; // bytes/second
  eta: number; // seconds
  progress: number; // 0-100
  error?: string;
  headers: Record<string, string>;
  referrer?: string;
  cookies?: string;
  userAgent?: string;
  proxy?: ProxyConfig;
  bandwidthLimit?: number; // bytes/second, 0 = unlimited
  schedule?: ScheduleConfig;
  category: string;
  tags: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  updatedAt: number;
  metadata: {
    contentType?: string;
    contentDisposition?: string;
    lastModified?: string;
    etag?: string;
    supportsRange: boolean;
    redirects: string[];
  };
  verification?: FileVerification;
}

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
  type: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface ScheduleConfig {
  enabled: boolean;
  startTime?: number; // timestamp
  endTime?: number; // timestamp
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  repeat: 'once' | 'daily' | 'weekly' | 'monthly';
}

export interface FileVerification {
  enabled: boolean;
  algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512';
  expectedHash?: string;
  verified: boolean;
  actualHash?: string;
}

// ============================================
// Queue & Category Types
// ============================================

export interface DownloadCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  extensions: string[];
  defaultPath: string;
  autoAdd: boolean;
  order: number;
}

export interface QueueSettings {
  maxConcurrentDownloads: number;
  maxConcurrentPerHost: number;
  defaultThreadCount: number;
  defaultPriority: DownloadPriority;
  autoStartQueue: boolean;
  pauseOnBattery: boolean;
  pauseOnMeteredConnection: boolean;
}

// ============================================
// Settings Types
// ============================================

export interface GeneralSettings {
  language: string;
  theme: 'light' | 'dark' | 'system';
  minimizeToTray: boolean;
  closeToTray: boolean;
  startMinimized: boolean;
  checkUpdates: boolean;
  betaUpdates: boolean;
}

export interface DownloadSettings {
  defaultSavePath: string;
  askSavePath: boolean;
  createSubfolders: boolean;
  overwriteBehavior: 'ask' | 'overwrite' | 'rename' | 'skip';
  tempFolder: string;
  bufferSize: number; // KB
  maxRedirects: number;
  connectTimeout: number; // seconds
  readTimeout: number; // seconds
  retryCount: number;
  retryDelay: number; // seconds
  userAgent: string;
}

export interface NetworkSettings {
  proxy: ProxyConfig;
  bandwidthLimit: {
    enabled: boolean;
    download: number; // bytes/second
    upload: number; // bytes/second
    schedule?: ScheduleConfig;
  };
  dnsOverHttps: boolean;
  ipv6: boolean;
}

export interface BrowserIntegrationSettings {
  enabled: boolean;
  browsers: string[];
  monitorClipboard: boolean;
  clipboardPatterns: string[];
  extensionId?: string;
  interceptDownloads: boolean;
  showDownloadPanel: boolean;
}

export interface AdvancedSettings {
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxLogFiles: number;
  maxLogSize: number; // MB
  crashReporting: boolean;
  hardwareAcceleration: boolean;
  experimentalFeatures: boolean;
  developerTools: boolean;
}

export interface AllSettings {
  general: GeneralSettings;
  downloads: DownloadSettings;
  network: NetworkSettings;
  browser: BrowserIntegrationSettings;
  advanced: AdvancedSettings;
  queue: QueueSettings;
  categories: DownloadCategory[];
}

// ============================================
// IPC Communication Types
// ============================================

export interface IPCMessage<T = unknown> {
  channel: string;
  payload: T;
  id?: string;
}

export interface DownloadControlPayload {
  downloadId: string;
  action: 'start' | 'pause' | 'resume' | 'cancel' | 'retry' | 'remove' | 'openFile' | 'openFolder' | 'copyLink';
}

export interface DownloadAddPayload {
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

export interface BatchDownloadPayload {
  urls: string[];
  category?: string;
  priority?: DownloadPriority;
  threadCount?: number;
  savePath?: string;
}

export interface SettingsUpdatePayload {
  section: keyof AllSettings;
  settings: Partial<AllSettings[keyof AllSettings]>;
}

// ============================================
// Event Types
// ============================================

export interface DownloadProgressEvent {
  downloadId: string;
  progress: number;
  downloadedSize: number;
  totalSize: number;
  speed: number;
  eta: number;
  status: DownloadStatus;
}

export interface DownloadStateChangeEvent {
  downloadId: string;
  previousStatus: DownloadStatus;
  newStatus: DownloadStatus;
  error?: string;
}

export interface QueueUpdateEvent {
  type: 'added' | 'removed' | 'reordered' | 'cleared';
  downloadIds: string[];
}

export interface CategoryUpdateEvent {
  type: 'added' | 'updated' | 'removed';
  category: DownloadCategory;
}

// ============================================
// Browser Extension Types
// ============================================

export interface ExtensionDownloadInfo {
  url: string;
  filename?: string;
  referrer?: string;
  cookies?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  mimeType?: string;
  totalBytes?: number;
}

export interface ExtensionMessage {
  type: 'download' | 'media' | 'page' | 'link' | 'selection';
  payload: ExtensionDownloadInfo | ExtensionDownloadInfo[];
}

// ============================================
// Media Sniffing Types
// ============================================

export interface MediaResource {
  url: string;
  type: 'video' | 'audio' | 'image' | 'document' | 'archive' | 'other';
  format?: string;
  quality?: string;
  size?: number;
  duration?: number;
  title?: string;
  thumbnail?: string;
  pageUrl: string;
}

export interface MediaSniffResult {
  resources: MediaResource[];
  pageTitle: string;
  pageUrl: string;
  timestamp: number;
}

// ============================================
// Statistics Types
// ============================================

export interface DownloadStats {
  totalDownloads: number;
  completedDownloads: number;
  failedDownloads: number;
  activeDownloads: number;
  totalDownloaded: number; // bytes
  totalTime: number; // seconds
  averageSpeed: number; // bytes/second
  byCategory: Record<string, {
    count: number;
    size: number;
  }>;
  byType: Record<string, {
    count: number;
    size: number;
  }>;
  dailyStats: Array<{
    date: string;
    count: number;
    size: number;
  }>;
}

// ============================================
// Update Types
// ============================================

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  size: number;
  signature: string;
  mandatory: boolean;
}

// ============================================
// Default Values
// ============================================

export const DEFAULT_THREAD_COUNT = 8;
export const MAX_THREAD_COUNT = 64;
export const MIN_CHUNK_SIZE = 1024 * 1024; // 1MB
export const DEFAULT_BUFFER_SIZE = 64; // KB
export const DEFAULT_CONNECT_TIMEOUT = 30; // seconds
export const DEFAULT_READ_TIMEOUT = 60; // seconds
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_DELAY = 5; // seconds

export const DEFAULT_CATEGORIES: DownloadCategory[] = [
  {
    id: 'documents',
    name: 'Documents',
    color: '#3b82f6',
    icon: 'file-text',
    extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
    defaultPath: 'Documents',
    autoAdd: true,
    order: 1,
  },
  {
    id: 'videos',
    name: 'Videos',
    color: '#ec4899',
    icon: 'video',
    extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'],
    defaultPath: 'Videos',
    autoAdd: true,
    order: 2,
  },
  {
    id: 'audio',
    name: 'Audio',
    color: '#8b5cf6',
    icon: 'music',
    extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'],
    defaultPath: 'Music',
    autoAdd: true,
    order: 3,
  },
  {
    id: 'images',
    name: 'Images',
    color: '#10b981',
    icon: 'image',
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico', 'heic'],
    defaultPath: 'Pictures',
    autoAdd: true,
    order: 4,
  },
  {
    id: 'archives',
    name: 'Archives',
    color: '#f59e0b',
    icon: 'archive',
    extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'],
    defaultPath: 'Downloads',
    autoAdd: true,
    order: 5,
  },
  {
    id: 'software',
    name: 'Software',
    color: '#ef4444',
    icon: 'cpu',
    extensions: ['exe', 'msi', 'apk', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'sh', 'bat'],
    defaultPath: 'Downloads',
    autoAdd: true,
    order: 6,
  },
  {
    id: 'other',
    name: 'Other',
    color: '#64748b',
    icon: 'file',
    extensions: [],
    defaultPath: 'Downloads',
    autoAdd: true,
    order: 7,
  },
];

export const DEFAULT_SETTINGS: AllSettings = {
  general: {
    language: 'en',
    theme: 'system',
    minimizeToTray: true,
    closeToTray: false,
    startMinimized: false,
    checkUpdates: true,
    betaUpdates: false,
  },
  downloads: {
    defaultSavePath: 'Downloads',
    askSavePath: false,
    createSubfolders: true,
    overwriteBehavior: 'rename',
    tempFolder: 'temp',
    bufferSize: 64,
    maxRedirects: 10,
    connectTimeout: 30,
    readTimeout: 60,
    retryCount: 3,
    retryDelay: 5,
    userAgent: 'AllDown/1.0',
  },
  network: {
    proxy: {
      enabled: false,
      host: '',
      port: 8080,
      type: 'http',
    },
    bandwidthLimit: {
      enabled: false,
      download: 0,
      upload: 0,
    },
    dnsOverHttps: false,
    ipv6: true,
  },
  browser: {
    enabled: true,
    browsers: ['chrome', 'edge', 'firefox', 'brave', 'vivaldi', 'opera'],
    monitorClipboard: true,
    clipboardPatterns: [
      '^https?://',
      '^magnet:',
      '^ftp://',
    ],
    interceptDownloads: true,
    showDownloadPanel: true,
  },
  advanced: {
    logLevel: 'info',
    maxLogFiles: 10,
    maxLogSize: 10,
    crashReporting: true,
    hardwareAcceleration: true,
    experimentalFeatures: false,
    developerTools: false,
  },
  queue: {
    maxConcurrentDownloads: 3,
    maxConcurrentPerHost: 2,
    defaultThreadCount: 8,
    defaultPriority: 'normal',
    autoStartQueue: true,
    pauseOnBattery: true,
    pauseOnMeteredConnection: true,
  },
  categories: DEFAULT_CATEGORIES,
};