import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, Globe, FolderOpen, Hash, ArrowDown, Minus, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import type { DownloadCategory, DownloadPriority } from '@shared/types';
import { isValidUrl, extractUrls } from '../../utils/formatters';

interface AddDownloadModalProps {
  open: boolean;
  onClose: () => void;
  categories: DownloadCategory[];
  defaultThreadCount: number;
  defaultPriority: DownloadPriority;
}

export function AddDownloadModal({
  open,
  onClose,
  categories,
  defaultThreadCount,
  defaultPriority,
}: AddDownloadModalProps) {
  const [urls, setUrls] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [savePath, setSavePath] = useState<string>('');
  const [category, setCategory] = useState<string>('other');
  const [priority, setPriority] = useState<DownloadPriority>(defaultPriority);
  const [threadCount, setThreadCount] = useState(defaultThreadCount);
  const [headers, setHeaders] = useState<string>('');
  const [referrer, setReferrer] = useState<string>('');
  const [cookies, setCookies] = useState<string>('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<string>('');
  const [verificationEnabled, setVerificationEnabled] = useState(false);
  const [verificationHash, setVerificationHash] = useState<string>('');
  const [verificationAlgorithm, setVerificationAlgorithm] = useState<'md5' | 'sha1' | 'sha256' | 'sha512'>('sha256');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-detect URLs from clipboard on open
  useEffect(() => {
    if (open) {
      // Check clipboard for URLs
      navigator.clipboard?.readText().then(text => {
        const foundUrls = extractUrls(text);
        if (foundUrls.length > 0) {
          setUrls(foundUrls.join('\n'));
        }
      }).catch(() => {
        // Ignore clipboard errors
      });

      // Focus URL input
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0) {
      setError('Please enter at least one URL');
      return;
    }

    // Validate URLs
    for (const url of urlList) {
      if (!isValidUrl(url)) {
        setError(`Invalid URL: ${url}`);
        return;
      }
    }

    setAdding(true);

    try {
      if (urlList.length === 1) {
        const result = await window.electronAPI.downloads.add({
          url: urlList[0],
          filename: filename || undefined,
          savePath: savePath || undefined,
          category: category || undefined,
          priority,
          threadCount,
          headers: headers ? JSON.parse(headers) : undefined,
          referrer: referrer || undefined,
          cookies: cookies || undefined,
          schedule: scheduleEnabled ? { enabled: true, startTime: new Date(scheduleTime).getTime(), repeat: 'once' } : undefined,
          bandwidthLimit: undefined,
        });

        if (!result.success) {
          setError(result.error || 'Failed to add download');
        }
      } else {
        const result = await window.electronAPI.downloads.batchAdd({
          urls: urlList,
          category: category || undefined,
          priority,
          threadCount,
          savePath: savePath || undefined,
        });

        if (!result.success) {
          setError(result.error || 'Failed to add downloads');
        }
      }

      if (!error) {
        onClose();
        resetForm();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setUrls('');
    setFilename('');
    setSavePath('');
    setCategory('other');
    setPriority(defaultPriority);
    setThreadCount(defaultThreadCount);
    setHeaders('');
    setReferrer('');
    setCookies('');
    setScheduleEnabled(false);
    setScheduleTime('');
    setVerificationEnabled(false);
    setVerificationHash('');
    setVerificationAlgorithm('sha256');
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl animate-slide-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Download</h2>
          <button onClick={onClose} className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* URLs */}
          <div>
            <label htmlFor="urls" className="label">URLs <span className="text-red-500">*</span></label>
            <textarea
              ref={urlInputRef}
              id="urls"
              value={urls}
              onChange={e => setUrls(e.target.value)}
              placeholder="Enter one or more URLs (one per line)"
              className="input font-mono text-sm min-h-[100px] resize-y"
              rows={4}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Paste multiple URLs to add them as a batch. Supports HTTP, HTTPS, FTP, and Magnet links.
            </p>
          </div>

          {/* Basic Options */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filename" className="label">Filename (optional)</label>
              <input
                id="filename"
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                placeholder="Auto-detected from URL"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="category" className="label">Category</label>
              <select
                id="category"
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="input"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="priority" className="label">Priority</label>
              <select
                id="priority"
                value={priority}
                onChange={e => setPriority(e.target.value as DownloadPriority)}
                className="input"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label htmlFor="threads" className="label">Threads</label>
              <div className="flex items-center gap-2">
                <input
                  id="threads"
                  type="number"
                  value={threadCount}
                  onChange={e => setThreadCount(Math.max(1, Math.min(64, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={64}
                  className="input w-24"
                />
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => setThreadCount(t => Math.min(64, t + 1))}
                    className="btn-icon p-1 text-xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setThreadCount(t => Math.max(1, t - 1))}
                    className="btn-icon p-1 text-xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Save Path */}
          <div>
            <label htmlFor="savePath" className="label">Save Location (optional)</label>
            <div className="flex gap-2">
              <input
                id="savePath"
                type="text"
                value={savePath}
                onChange={e => setSavePath(e.target.value)}
                placeholder="Default download folder"
                className="input flex-1"
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const result = await window.electronAPI.system.showItemInFolder(savePath || '');
                  // In real app, would open folder picker
                }}
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Advanced Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="btn-ghost text-left justify-start gap-2 w-full"
          >
            <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Options</span>
            <ArrowDown className={clsx('w-4 h-4 transition-transform', showAdvanced && 'rotate-180')} />
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4 animate-fade-in">
              {/* Headers */}
              <div>
                <label htmlFor="headers" className="label">Custom Headers (JSON)</label>
                <textarea
                  id="headers"
                  value={headers}
                  onChange={e => setHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer token", "Accept": "application/json"}'
                  className="input font-mono text-sm min-h-[80px] resize-y"
                  rows={3}
                />
              </div>

              {/* Referrer & Cookies */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="referrer" className="label">Referrer</label>
                  <input
                    id="referrer"
                    type="text"
                    value={referrer}
                    onChange={e => setReferrer(e.target.value)}
                    placeholder="https://example.com/page"
                    className="input"
                  />
                </div>

                <div>
                  <label htmlFor="cookies" className="label">Cookies</label>
                  <input
                    id="cookies"
                    type="text"
                    value={cookies}
                    onChange={e => setCookies(e.target.value)}
                    placeholder="session=abc123; auth=xyz"
                    className="input"
                  />
                </div>
              </div>

              {/* Scheduling */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={e => setScheduleEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Schedule Download</span>
                </label>
                {scheduleEnabled && (
                  <div className="mt-2 flex items-center gap-4">
                    <input
                      type="datetime-local"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="input flex-1"
                      min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                    />
                  </div>
                )}
              </div>

              {/* File Verification */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verificationEnabled}
                    onChange={e => setVerificationEnabled(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Verify File Integrity</span>
                </label>
                {verificationEnabled && (
                  <div className="mt-2 grid gap-4 sm:grid-cols-3">
                    <div>
                      <label htmlFor="verifyHash" className="label">Expected Hash</label>
                      <input
                        id="verifyHash"
                        type="text"
                        value={verificationHash}
                        onChange={e => setVerificationHash(e.target.value)}
                        placeholder="SHA256 hash..."
                        className="input font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="verifyAlgo" className="label">Algorithm</label>
                      <select
                        id="verifyAlgo"
                        value={verificationAlgorithm}
                        onChange={e => setVerificationAlgorithm(e.target.value as any)}
                        className="input"
                      >
                        <option value="md5">MD5</option>
                        <option value="sha1">SHA-1</option>
                        <option value="sha256">SHA-256</option>
                        <option value="sha512">SHA-512</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Leave empty to skip hash verification
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-2">
              <X className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 pt-4 sticky bottom-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm rounded-b-xl">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={adding}>
              {adding ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <ArrowDown className="w-4 h-4" />
                  Add Download
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}