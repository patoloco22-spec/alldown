import React from 'react';
import {
  Download,
  CheckCircle,
  XCircle,
  PauseCircle,
  Clock,
  Folder,
  Plus,
  Settings,
  ChevronRight,
  ChevronLeft,
  FileText,
  Video,
  Music,
  Image,
  Archive,
  Cpu,
  MoreHorizontal,
} from 'lucide-react';
import type { DownloadCategory } from '@shared/types';
import { clsx } from 'clsx';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeView: string;
  onViewChange: (view: string) => void;
  categories: DownloadCategory[];
  stats: {
    total: number;
    downloading: number;
    completed: number;
    failed: number;
    paused: number;
  };
  onManageCategories: () => void;
}

const NAV_ITEMS = [
  { id: 'all', label: 'All Downloads', icon: Download, countKey: 'total' as const },
  { id: 'downloading', label: 'Downloading', icon: Clock, countKey: 'downloading' as const, color: 'text-primary-600 dark:text-primary-400' },
  { id: 'completed', label: 'Completed', icon: CheckCircle, countKey: 'completed' as const, color: 'text-green-600 dark:text-green-400' },
  { id: 'failed', label: 'Failed', icon: XCircle, countKey: 'failed' as const, color: 'text-red-600 dark:text-red-400' },
  { id: 'paused', label: 'Paused', icon: PauseCircle, countKey: 'paused' as const, color: 'text-yellow-600 dark:text-yellow-400' },
] as const;

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  documents: FileText,
  videos: Video,
  audio: Music,
  images: Image,
  archives: Archive,
  software: Cpu,
  other: Folder,
};

export function Sidebar({
  collapsed,
  onToggle,
  activeView,
  onViewChange,
  categories,
  stats,
  onManageCategories,
}: SidebarProps) {
  return (
    <aside className={clsx('sidebar flex flex-col transition-all duration-300', collapsed ? 'w-16' : 'w-64')}>
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-slate-200 dark:border-slate-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">AllDown</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="btn-icon p-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1" role="navigation" aria-label="Main navigation">
        {/* Main Views */}
        <div>
          {!collapsed && (
            <div className="px-3 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Library
            </div>
          )}
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const count = stats[item.countKey];
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150',
                  'group',
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
                  collapsed && 'justify-center'
                )}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={clsx('w-5 h-5 flex-shrink-0', item.color)} aria-hidden="true" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                    <span className={clsx(
                      'badge badge-neutral flex-shrink-0',
                      isActive && 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'
                    )}>
                      {count}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1">
              {!collapsed && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Categories
                </span>
              )}
              {!collapsed && (
                <button
                  onClick={onManageCategories}
                  className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Manage categories"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>
            {categories.map(category => {
              const Icon = CATEGORY_ICONS[category.icon] || Folder;
              const isActive = activeView === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => onViewChange(category.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150',
                    'group',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100',
                    collapsed && 'justify-center'
                  )}
                  style={{ '--category-color': category.color }}
                  title={collapsed ? category.name : undefined}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: category.color + '20' }}
                    >
                      <Icon className="w-4 h-4" style={{ color: category.color }} aria-hidden="true" />
                    </div>
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-sm font-medium truncate">{category.name}</span>
                        <span className="badge badge-neutral flex-shrink-0">
                          {categories.filter(c => c.id === category.id).length > 0 ? '📁' : ''}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700">
        {!collapsed && (
          <div className="space-y-1">
            <button className="btn-secondary w-full justify-start gap-3">
              <Plus className="w-4 h-4" />
              <span>Add Download</span>
            </button>
            <button className="btn-ghost w-full justify-start gap-3">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </div>
        )}
        {collapsed && (
          <div className="space-y-1">
            <button className="btn-secondary w-full justify-center" aria-label="Add Download">
              <Plus className="w-5 h-5" />
            </button>
            <button className="btn-ghost w-full justify-center" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}