import React, { useState, useRef } from 'react';
import { X, Search, Zap, Play, Download, Globe, ChevronDown, ChevronUp, Check, Loader2, Filter, X as XIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import type { MediaResource, MediaSniffResult } from '@shared/types';
import { formatBytes, getFileIcon } from '../../utils/formatters';

interface MediaSnifferModalProps {
  open: boolean;
  onClose: () => void;
}

const MEDIA_TYPE_COLORS: Record<MediaResource['type'], string> = {
  video: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  audio: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  image: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  document: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  archive: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const MEDIA_TYPE_ICONS: Record<MediaResource['type'], React.ComponentType<{ className?: string }>> = {
  video: Play,
  audio: Play,
  image: Globe,
  document: Globe,
  archive: Globe,
  other: Globe,
};

export function MediaSnifferModal({ open, onClose }: MediaSnifferModalProps) {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<MediaSniffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<MediaResource['type'] | 'all'>('all');
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleSniff = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const response = await window.electronAPI.media.sniff(url.trim());
      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setError('Failed to sniff media resources');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const filteredResources = result?.resources.filter(r => filter === 'all' || r.type === filter) || [];

  const toggleSelect = (resourceUrl: string) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceUrl)) next.delete(resourceUrl);
      else next.add(resourceUrl);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedResources.size === filteredResources.length) {
      setSelectedResources(new Set());
    } else {
      setSelectedResources(new Set(filteredResources.map(r => r.url)));
    }
  };

  const handleDownloadSelected = async () => {
    const urls = Array.from(selectedResources);
    if (urls.length === 0) return;

    await window.electronAPI.downloads.batchAdd({ urls });
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-xl animate-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
              <Zap className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Media Sniffer</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Find videos, audio, and images on any webpage</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* URL Input */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 sticky top-14 z-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                ref={urlInputRef}
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSniff()}
                placeholder="Enter webpage URL (e.g., https://youtube.com/watch?v=...)"
                className="input pl-10 pr-4"
              />
            </div>
            <button
              onClick={handleSniff}
              disabled={loading || !url.trim()}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sniffing...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Sniff
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <XIcon className="w-4 h-4" /> {error}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {result ? (
            <>
              {/* Results Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {result.pageTitle}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate max-w-md">
                    {result.pageUrl}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={filter}
                    onChange={e => setFilter(e.target.value as any)}
                    className="input py-1.5 px-3 text-sm"
                  >
                    <option value="all">All Types ({result.resources.length})</option>
                    <option value="video">Video ({result.resources.filter(r => r.type === 'video').length})</option>
                    <option value="audio">Audio ({result.resources.filter(r => r.type === 'audio').length})</option>
                    <option value="image">Images ({result.resources.filter(r => r.type === 'image').length})</option>
                    <option value="document">Documents ({result.resources.filter(r => r.type === 'document').length})</option>
                    <option value="archive">Archives ({result.resources.filter(r => r.type === 'archive').length})</option>
                    <option value="other">Other ({result.resources.filter(r => r.type === 'other').length})</option>
                  </select>

                  {selectedResources.size > 0 && (
                    <button
                      onClick={handleDownloadSelected}
                      className="btn-primary"
                    >
                      <Download className="w-4 h-4" />
                      Download ({selectedResources.size})
                    </button>
                  )}
                </div>
              </div>

              {/* Select All */}
              {filteredResources.length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedResources.size === filteredResources.length && filteredResources.length > 0}
                      indeterminate={selectedResources.size > 0 && selectedResources.size < filteredResources.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Select all {filteredResources.length} items
                    </span>
                  </label>
                </div>
              )}

              {/* Resource Grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredResources.map((resource, index) => (
                  <MediaResourceCard
                    key={resource.url}
                    resource={resource}
                    index={index}
                    selected={selectedResources.has(resource.url)}
                    onSelect={toggleSelect}
                    onToggleExpand={() => setExpandedId(expandedId === resource.url ? null : resource.url)}
                    expanded={expandedId === resource.url}
                  />
                ))}
              </div>

              {filteredResources.length === 0 && (
                <div className="text-center py-12">
                  <Filter className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                    No resources found
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400">
                    Try a different filter or check if the page has media content.
                  </p>
                </div>
              )}
            </>
          ) : (
            {/* Empty State */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Zap className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-6" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Sniff Media from Webpages
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                Enter a URL above to scan for videos, audio files, images, and other downloadable media.
                Works with YouTube, Vimeo, SoundCloud, and many other sites.
              </p>
              <div className="grid gap-4 sm:grid-cols-3 max-w-md w-full text-left">
                {[
                  { icon: Play, label: 'Videos', color: 'text-pink-600' },
                  { icon: Play, label: 'Audio', color: 'text-purple-600' },
                  { icon: Globe, label: 'Images', color: 'text-green-600' },
                ].map(item => (
                  <div key={item.label} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <item.icon className={`w-6 h-6 ${item.color} mb-2`} />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================
// Media Resource Card
// ============================================

interface MediaResourceCardProps {
  resource: MediaResource;
  index: number;
  selected: boolean;
  onSelect: (url: string) => void;
  onToggleExpand: () => void;
  expanded: boolean;
}

function MediaResourceCard({
  resource,
  index,
  selected,
  onSelect,
  onToggleExpand,
  expanded,
}: MediaResourceCardProps) {
  const Icon = MEDIA_TYPE_ICONS[resource.type] || Globe;
  const FileIcon = getFileIcon(resource.format || '');

  return (
    <div
      className={clsx(
        'card-hover relative overflow-hidden transition-all duration-200',
        selected && 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/10'
      )}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-2 right-2 z-10">
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(resource.url)}
            className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
        </label>
      </div>

      {/* Thumbnail/Icon */}
      <div className="aspect-video bg-slate-100 dark:bg-slate-700 relative overflow-hidden">
        {resource.thumbnail ? (
          <img
            src={resource.thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-12 h-12 text-slate-400 dark:text-slate-500" />
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-2 left-2">
          <span className={clsx('badge text-xs', MEDIA_TYPE_COLORS[resource.type])}>
            <Icon className="w-3 h-3 mr-1" />
            {resource.type}
          </span>
        </div>

        {/* Quality/Format Badge */}
        {(resource.quality || resource.format) && (
          <div className="absolute bottom-2 right-2">
            <span className="badge badge-neutral text-xs">
              {resource.quality || resource.format?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Duration */}
        {resource.duration && (
          <div className="absolute bottom-2 left-2">
            <span className="badge badge-neutral text-xs bg-black/70 text-white">
              {formatDuration(resource.duration)}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate mb-1">
          {resource.title || `Resource ${index + 1}`}
        </h4>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <FileIcon className="w-3.5 h-3.5" />
          <span className="truncate">{resource.format || 'Unknown'}</span>
          {resource.size && (
            <>
              <span>•</span>
              <span>{formatBytes(resource.size)}</span>
            </>
          )}
        </div>

        <div className="text-xs text-slate-400 dark:text-slate-500 truncate" title={resource.url}>
          {resource.url}
        </div>
      </div>

      {/* Expandable Details */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 animate-fade-in">
          <div className="grid gap-2 text-xs">
            <DetailRow label="URL" value={resource.url} copyable />
            {resource.pageUrl !== resource.url && (
              <DetailRow label="Page URL" value={resource.pageUrl} copyable />
            )}
            {resource.title && <DetailRow label="Title" value={resource.title} />}
            {resource.format && <DetailRow label="Format" value={resource.format} />}
            {resource.quality && <DetailRow label="Quality" value={resource.quality} />}
            {resource.size && <DetailRow label="Size" value={formatBytes(resource.size)} />}
            {resource.duration && <DetailRow label="Duration" value={formatDuration(resource.duration)} />}
            {resource.isEmbed && <DetailRow label="Type" value="Embedded Player" />}
            {resource.isManifest && <DetailRow label="Type" value="Stream Manifest (HLS/DASH)" />}
            {resource.metaTag && <DetailRow label="Source" value={`Meta tag: ${resource.metaTag}`} />}
            {resource.mimeType && <DetailRow label="MIME Type" value={resource.mimeType} />}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => navigator.clipboard.writeText(resource.url)}
              className="btn-secondary btn-icon text-xs flex-1"
              title="Copy URL"
            >
              <Globe className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.electronAPI.downloads.add({ url: resource.url })}
              className="btn-primary text-xs flex-1"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      )}

      {/* Expand Button */}
      <button
        onClick={onToggleExpand}
        className="absolute bottom-2 left-1/2 -translate-x-1/2 btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
    </div>
  );
}

function DetailRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-slate-500 dark:text-slate-400 font-medium w-20 flex-shrink-0">{label}</span>
      <span className="flex-1 truncate font-mono text-slate-700 dark:text-slate-300">{value}</span>
      {copyable && (
        <button
          onClick={() => navigator.clipboard.writeText(value)}
          className="btn-icon p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
          title="Copy"
        >
          <Globe className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}