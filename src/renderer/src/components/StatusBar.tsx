import React from 'react';
import { Download, CheckCircle, Clock, Zap, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { formatSpeed, formatBytes } from '../utils/formatters';

interface StatusBarProps {
  stats: {
    total: number;
    downloading: number;
    completed: number;
    failed: number;
    paused: number;
  };
  totalSpeed: number;
}

export function StatusBar({ stats, totalSpeed }: StatusBarProps) {
  return (
    <footer className="h-10 px-4 border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex items-center justify-between">
      {/* Left: Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <Download className="w-4 h-4" />
          <span>{stats.total} total</span>
        </span>

        {stats.downloading > 0 && (
          <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
            <Clock className="w-4 h-4 animate-spin" />
            <span>{stats.downloading} active</span>
          </span>
        )}

        {stats.completed > 0 && (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>{stats.completed} done</span>
          </span>
        )}

        {stats.failed > 0 && (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <RotateCcw className="w-4 h-4" />
            <span>{stats.failed} failed</span>
          </span>
        )}
      </div>

      {/* Right: Total Speed */}
      <div className="flex items-center gap-2 text-sm font-mono text-slate-700 dark:text-slate-300">
        <Zap className="w-4 h-4 text-yellow-500" />
        <span>{formatSpeed(totalSpeed)}</span>
        {totalSpeed > 0 && (
          <span className="text-slate-500 dark:text-slate-400">
            {' '}•{' '}
            {formatBytes(totalSpeed)}/s
          </span>
        )}
      </div>
    </footer>
  );
}