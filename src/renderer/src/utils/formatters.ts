import {
  FileText,
  Video,
  Music,
  Image,
  Archive,
  Cpu,
  File,
  Globe,
} from 'lucide-react';
import type { React.ComponentType } from 'react';

// ============================================
// File Size Formatting
// ============================================

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '—';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// ============================================
// Speed Formatting
// ============================================

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return '—';
  if (bytesPerSecond < 0) return '—';

  return `${formatBytes(bytesPerSecond, 1)}/s`;
}

// ============================================
// Time Formatting
// ============================================

export function formatTime(seconds: number): string {
  if (seconds <= 0) return '—';
  if (!isFinite(seconds)) return '—';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatDuration(ms: number): string {
  return formatTime(ms / 1000);
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

// ============================================
// File Icon Mapping
// ============================================

const EXTENSION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  // Documents
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  rtf: FileText,
  odt: FileText,
  xls: FileText,
  xlsx: FileText,
  ppt: FileText,
  pptx: FileText,
  csv: FileText,
  md: FileText,

  // Videos
  mp4: Video,
  mkv: Video,
  avi: Video,
  mov: Video,
  wmv: Video,
  flv: Video,
  webm: Video,
  m4v: Video,
  mpg: Video,
  mpeg: Video,
  ts: Video,
  m3u8: Video,

  // Audio
  mp3: Music,
  wav: Music,
  flac: Music,
  aac: Music,
  ogg: Music,
  wma: Music,
  m4a: Music,
  opus: Music,

  // Images
  jpg: Image,
  jpeg: Image,
  png: Image,
  gif: Image,
  bmp: Image,
  webp: Image,
  tiff: Image,
  tif: Image,
  svg: Image,
  ico: Image,
  heic: Image,
  heif: Image,

  // Archives
  zip: Archive,
  rar: Archive,
  '7z': Archive,
  tar: Archive,
  gz: Archive,
  bz2: Archive,
  xz: Archive,
  iso: Archive,
  dmg: Archive,

  // Software
  exe: Cpu,
  msi: Cpu,
  apk: Cpu,
  app: Cpu,
  deb: Cpu,
  rpm: Cpu,
  appimage: Cpu,
  sh: Cpu,
  bat: Cpu,
  cmd: Cpu,
  ps1: Cpu,
};

export function getFileIcon(filename: string): React.ComponentType<{ className?: string }> {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext && EXTENSION_ICONS[ext]) {
    return EXTENSION_ICONS[ext];
  }

  // Check for common patterns
  if (filename.startsWith('http')) return Globe;
  if (filename.includes('.')) return FileText;

  return File;
}

// ============================================
// Category Color Helpers
// ============================================

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

export function getColorWithOpacity(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

// ============================================
// URL Validation
// ============================================

export function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
  } catch {
    return false;
  }
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|magnet:\?[^\s]+)/gi;
  return text.match(urlRegex) || [];
}

// ============================================
// Filename Sanitization
// ============================================

export function sanitizeFilename(filename: string): string {
  // Remove invalid characters for all platforms
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255);
}

// ============================================
// Priority Helpers
// ============================================

export type DownloadPriority = 'low' | 'normal' | 'high' | 'critical';

export function getPriorityValue(priority: DownloadPriority): number {
  const values: Record<DownloadPriority, number> = {
    low: 0,
    normal: 1,
    high: 2,
    critical: 3,
  };
  return values[priority] ?? 1;
}

export function comparePriority(a: DownloadPriority, b: DownloadPriority): number {
  return getPriorityValue(b) - getPriorityValue(a);
}

// ============================================
// Status Helpers
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

export function isActiveStatus(status: DownloadStatus): boolean {
  return ['downloading', 'connecting', 'queued', 'pending'].includes(status);
}

export function isTerminalStatus(status: DownloadStatus): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status);
}

export function getStatusDisplayName(status: DownloadStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
}

// ============================================
// Number Formatting
// ============================================

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}