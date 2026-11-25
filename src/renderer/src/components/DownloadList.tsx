import React, { useState, useRef, useEffect } from 'react';
import {
  Pause,
  Play,
  X,
  RotateCcw,
  Trash2,
  FileText,
  FolderOpen,
  Copy,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Settings,
  Globe,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DownloadFile, DownloadCategory, DownloadStatus, DownloadPriority } from '@shared/types';
import { formatBytes, formatSpeed, formatTime, getFileIcon } from '../utils/formatters';

interface DownloadListProps {
  downloads: DownloadFile[];
  loading: boolean;
  error: string | null;
  activeView: string;
  categories: DownloadCategory[];
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => Promise<void>;
  onCancel: (id: string, deleteFile?: boolean) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onOpenFile: (id: string) => Promise<void>;
  onOpenFolder: (id: string) => Promise<void>;
  onCopyLink: (id: string) => Promise<void>;
  onClearCompleted: () => Promise<void>;
  onClearFailed: () => Promise<void>;
  onPauseAll: () => Promise<void>;
  onResumeAll: () => Promise<void>;
}

const STATUS_ICONS: Record<DownloadStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  queued: Clock,
  connecting: Loader2,
  downloading: Loader2,
  paused: Pause,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: X,
  verifying: Settings,
};

const STATUS_COLORS: Record<DownloadStatus, string> = {
  pending: 'text-slate-500',
  queued: 'text-slate-500',
  connecting: 'text-primary-600 dark:text-primary-400 animate-spin',
  downloading: 'text-primary-600 dark:text-primary-400 animate-spin',
  paused: 'text-yellow-600 dark:text-yellow-400',
  completed: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
  cancelled: 'text-slate-500',
  verifying: 'text-blue-600 dark:text-blue-400 animate-spin',
};

const PRIORITY_LABELS: Record<DownloadPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

const PRIORITY_COLORS: Record<DownloadPriority, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function DownloadList({
  downloads,
  loading,
  error,
  activeView,
  categories,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onOpenFile,
  onOpenFolder,
  onCopyLink,
  onClearCompleted,
  onClearFailed,
  onPauseAll,
  onResumeAll,
}: DownloadListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle empty states
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
            Failed to load downloads
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <FileText className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
          No downloads yet
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
          Click "Add Download" to start your first download, or copy a URL to your clipboard
          to automatically detect it.
        </p>
        <button onClick={() => window.electronAPI.downloads.add({ url: '' })} className="btn-primary">
          Add Download
        </button>
      </div>
    );
  }

  const completedCount = downloads.filter(d => d.status === 'completed').length;
  const failedCount = downloads.filter(d => d.status === 'failed').length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Table Header */}
      <div className="table-header sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="table-header w-12"></th>
              <th className="table-header">File</th>
              <th className="table-header hidden md:table-cell w-32">Status</th>
              <th className="table-header hidden lg:table-cell w-24">Progress</th>
              <th className="table-header hidden lg:table-cell w-28">Speed</th>
              <th className="table-header hidden xl:table-cell w-20">ETA</th>
              <th className="table-header hidden xl:table-cell w-20">Size</th>
              <th className="table-header w-16"></th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Download Rows */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <tbody>
            {downloads.map((download, index) => (
              <React.Fragment key={download.id}>
                <tr
                  className={clsx(
                    'table-row',
                    expandedId === download.id && 'bg-primary-50/50 dark:bg-primary-900/10'
                  )}
                  onClick={() => setExpandedId(expandedId === download.id ? null : download.id)}
                >
                  <td className="table-cell w-12">
                    {download.status === 'downloading' || download.status === 'connecting' ? (
                      <Loader2 className="w-5 h-5 text-primary-600 animate-spin mx-auto" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto"
                        style={{ backgroundColor: download.metadata.contentType?.startsWith('image/') ? '#e0e7ff' : '#f1f5f9' }}
                      >
                        <getFileIcon(download.filename) className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                      </div>
                    )}
                  </td>

                  <td className="table-cell min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate block">{download.filename}</span>
                        {download.verification?.enabled && (
                          <span className={clsx(
                            'badge text-xs',
                            download.verification.verified ? 'badge-success' : 'badge-warning'
                          )}>
                            {download.verification.verified ? 'Verified' : 'Unverified'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="truncate block max-w-[200px]" title={download.url}>
                          {download.url}
                        </span>
                        <span className={clsx('badge text-xs', PRIORITY_COLORS[download.priority])}>
                          {PRIORITY_LABELS[download.priority]}
                        </span>
                        <span className="badge badge-neutral text-xs">
                          {categories.find(c => c.id === download.category)?.name || download.category}
                        </span>
                        {download.threadCount > 1 && (
                          <span className="badge badge-primary text-xs">
                            {download.threadCount} threads
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="table-cell hidden md:table-cell w-32">
                    <div className="flex items-center gap-2">
                      <STATUS_ICONS[download.status]
                        className={clsx('w-4 h-4', STATUS_COLORS[download.status])}
                        aria-hidden="true"
                      />
                      <span className={clsx('text-sm font-medium', STATUS_COLORS[download.status])}>
                        {download.status.charAt(0).toUpperCase() + download.status.slice(1)}
                      </span>
                      {download.error && (
                        <span className="text-red-600 dark:text-red-400 text-xs truncate max-w-[120px]" title={download.error}>
                          {download.error}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="table-cell hidden lg:table-cell w-24">
                    <div className="w-full max-w-[80px]">
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${Math.min(100, Math.max(0, download.progress))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>{formatBytes(download.downloadedSize)}</span>
                        <span>{download.progress.toFixed(1)}%</span>
                        <span>{formatBytes(download.totalSize)}</span>
                      </div>
                    </div>
                  </td>

                  <td className="table-cell hidden lg:table-cell w-28">
                    <span className="text-sm font-mono text-slate-700 dark:text-slate-300">
                      {formatSpeed(download.speed)}
                    </span>
                  </td>

                  <td className="table-cell hidden xl:table-cell w-20">
                    <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                      {download.eta > 0 ? formatTime(download.eta) : '—'}
                    </span>
                  </td>

                  <td className="table-cell hidden xl:table-cell w-20">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {formatBytes(download.totalSize)}
                    </span>
                  </td>

                  <td className="table-cell w-16">
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownId(dropdownId === download.id ? null : download.id);
                        }}
                        className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label="More actions"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {dropdownId === download.id && (
                        <div
                          ref={dropdownRef}
                          className="dropdown"
                          role="menu"
                        >
                          {download.status === 'downloading' || download.status === 'connecting' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); onPause(download.id); setDropdownId(null); }}
                              className="dropdown-item"
                              role="menuitem"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </button>
                          ) : download.status === 'paused' ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); onResume(download.id); setDropdownId(null); }}
                              className="dropdown-item"
                              role="menuitem"
                            >
                              <Play className="w-4 h-4" />
                              Resume
                            </button>
                          ) : null}

                          {download.status === 'completed' && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenFile(download.id); setDropdownId(null); }}
                                className="dropdown-item"
                                role="menuitem"
                              >
                                <FileText className="w-4 h-4" />
                                Open File
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); onOpenFolder(download.id); setDropdownId(null); }}
                                className="dropdown-item"
                                role="menuitem"
                              >
                                <FolderOpen className="w-4 h-4" />
                                Open Folder
                              </button>
                              <div className="dropdown-divider" />
                            </>
                          )}

                          {download.status === 'failed' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onRetry(download.id); setDropdownId(null); }}
                              className="dropdown-item"
                              role="menuitem"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Retry
                            </button>
                          )}

                          <button
                            onClick={(e) => { e.stopPropagation(); onCopyLink(download.id); setDropdownId(null); }}
                            className="dropdown-item"
                            role="menuitem"
                          >
                            <Copy className="w-4 h-4" />
                            Copy Link
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onOpenFolder(download.id); setDropdownId(null); }}
                            className="dropdown-item"
                            role="menuitem"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Show in Folder
                          </button>

                          <div className="dropdown-divider" />

                          <button
                            onClick={(e) => { e.stopPropagation(); onCancel(download.id, false); setDropdownId(null); }}
                            className="dropdown-item text-red-600 dark:text-red-400"
                            role="menuitem"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>

                          <button
                            onClick={(e) => { e.stopPropagation(); onRemove(download.id); setDropdownId(null); }}
                            className="dropdown-item text-red-600 dark:text-red-400"
                            role="menuitem"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove from List
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>

                {/* Expanded Row */}
                {expandedId === download.id && (
                  <tr className="bg-slate-50 dark:bg-slate-800/50 animate-slide-in">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">URL</span>
                          <a
                            href={download.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 dark:text-primary-400 hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {download.url}
                          </a>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Save Path</span>
                          <span className="font-mono truncate block">{download.savePath}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Created</span>
                          <span>{new Date(download.createdAt).toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">
                            {download.startedAt ? 'Started' : '—'}
                          </span>
                          <span>{download.startedAt ? new Date(download.startedAt).toLocaleString() : '—'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-slate-500 dark:text-slate-400 block">Referrer</span>
                          <span className="truncate block">{download.referrer || '—'}</span>
                        </div>
                        <div className="md:col-span-2">
                          <span className="text-slate-500 dark:text-slate-400 block">User Agent</span>
                          <span className="font-mono text-xs truncate block">{download.userAgent}</span>
                        </div>
                        {download.verification?.enabled && (
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 block">Verification</span>
                            <span className={clsx('font-medium', download.verification.verified ? 'text-green-600' : 'text-yellow-600')}>
                              {download.verification.verified ? 'Passed' : 'Failed'}
                              {download.verification.actualHash && (
                                <span className="ml-2 font-mono text-xs text-slate-500">
                                  ({download.verification.algorithm.toUpperCase()})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Content Type</span>
                          <span>{download.metadata.contentType || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 block">Supports Range</span>
                          <span>{download.metadata.supportsRange ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Actions */}
      {(completedCount > 0 || failedCount > 0) && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
            {completedCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {completedCount} completed
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="w-4 h-4 text-red-500" />
                {failedCount} failed
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={onClearCompleted}
                className="btn-ghost text-sm"
              >
                Clear Completed
              </button>
            )}
            {failedCount > 0 && (
              <button
                onClick={onClearFailed}
                className="btn-ghost text-sm"
              >
                Clear Failed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}