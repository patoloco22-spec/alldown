import React from 'react';
import { Plus, Settings, Search, Zap, Minimize, Maximize, Close, X } from 'lucide-react';
import { clsx } from 'clsx';

interface ToolbarProps {
  stats: {
    total: number;
    downloading: number;
    completed: number;
    failed: number;
    paused: number;
  };
  onAddClick: () => void;
  onSettingsClick: () => void;
  onMediaSnifferClick: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function Toolbar({
  stats,
  onAddClick,
  onSettingsClick,
  onMediaSnifferClick,
  onMinimize,
  onMaximize,
  onClose,
}: ToolbarProps) {
  const isMac = process.platform === 'darwin';

  return (
    <header className="toolbar flex items-center justify-between">
      {/* Left: Title and quick stats */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
          AllDown
        </h1>

        {!isMac && (
          <div className="flex items-center gap-1 ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
            <button
              onClick={onMediaSnifferClick}
              className="btn-ghost btn-icon"
              title="Media Sniffer"
            >
              <Zap className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 ml-4 text-sm text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="font-medium text-slate-700 dark:text-slate-300">{stats.total}</span>
            <span>total</span>
          </span>
          {stats.downloading > 0 && (
            <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
              </span>
              <span className="font-medium">{stats.downloading}</span>
            </span>
          )}
          {stats.completed > 0 && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <span className="font-medium">{stats.completed}</span>
              <span>done</span>
            </span>
          )}
          {stats.failed > 0 && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="font-medium">{stats.failed}</span>
              <span>failed</span>
            </span>
          )}
        </div>
      </div>

      {/* Center: Search */}
      <div className="flex-1 max-w-md mx-8 hidden sm:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search downloads..."
            className="input pl-10 pr-4 w-full"
          />
        </div>
      </div>

      {/* Right: Actions and window controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onAddClick}
          className="btn-primary hidden sm:flex"
        >
          <Plus className="w-4 h-4" />
          <span>Add Download</span>
        </button>

        <button
          onClick={onAddClick}
          className="btn-primary btn-icon sm:hidden"
          title="Add Download"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button
          onClick={onMediaSnifferClick}
          className="btn-secondary btn-icon"
          title="Media Sniffer"
        >
          <Zap className="w-5 h-5" />
        </button>

        <button
          onClick={onSettingsClick}
          className="btn-secondary btn-icon"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Window Controls */}
        <div className="flex items-center gap-1 ml-2 border-l border-slate-200 dark:border-slate-700 pl-3">
          {isMac ? (
            <>
              <button onClick={onMinimize} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30" title="Minimize">
                <Minimize className="w-5 h-5" />
              </button>
              <button onClick={onMaximize} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-green-100 dark:hover:bg-green-900/30" title="Maximize">
                <Maximize className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-red-100 dark:hover:bg-red-900/30" title="Close">
                <Close className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={onMinimize} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Minimize">
                <Minimize className="w-5 h-5" />
              </button>
              <button onClick={onMaximize} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Maximize">
                <Maximize className="w-5 h-5" />
              </button>
              <button onClick={onClose} className="btn-icon p-1.5 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Close">
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}