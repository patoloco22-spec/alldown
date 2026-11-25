import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { DownloadList } from './components/DownloadList';
import { StatusBar } from './components/StatusBar';
import { AddDownloadModal } from './components/modals/AddDownloadModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { MediaSnifferModal } from './components/modals/MediaSnifferModal';
import { CategoryManagerModal } from './components/modals/CategoryManagerModal';
import { useDownloads } from './hooks/useDownloads';
import { useCategories } from './hooks/useCategories';
import { useSettings } from './hooks/useSettings';
import { useClipboard } from './hooks/useClipboard';
import type { DownloadFile, DownloadCategory, AllSettings } from '@shared/types';

export function App() {
  const [activeView, setActiveView] = useState<'all' | 'downloading' | 'completed' | 'failed' | 'paused' | string>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMediaSnifferModal, setShowMediaSnifferModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const {
    downloads,
    loading,
    error,
    refetch,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    removeDownload,
    openFile,
    openFolder,
    copyLink,
    clearCompleted,
    clearFailed,
    pauseAll,
    resumeAll,
  } = useDownloads();

  const { categories, refetch: refetchCategories } = useCategories();
  const { settings, updateSettings } = useSettings();
  const { startMonitoring, stopMonitoring } = useClipboard();

  // Initialize clipboard monitoring
  useEffect(() => {
    if (settings.browser.monitorClipboard) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
    return () => stopMonitoring();
  }, [settings.browser.monitorClipboard]);

  // Handle clipboard URL detection
  useEffect(() => {
    const handleUrlDetected = (url: string) => {
      setShowAddModal(true);
      // The modal will pre-fill the URL
    };

    // We'd subscribe to the clipboard events here
    // For now, the modal handles it
  }, []);

  // Filter downloads by active view
  const filteredDownloads = downloads.filter(download => {
    if (activeView === 'all') return true;
    if (activeView === 'downloading') return ['downloading', 'connecting'].includes(download.status);
    if (activeView === 'completed') return download.status === 'completed';
    if (activeView === 'failed') return download.status === 'failed';
    if (activeView === 'paused') return download.status === 'paused';
    // Category view
    return download.category === activeView;
  });

  // Sort: active downloads first, then by priority, then by date
  const sortedDownloads = [...filteredDownloads].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      downloading: 0,
      connecting: 1,
      paused: 2,
      queued: 3,
      pending: 4,
      completed: 5,
      failed: 6,
      cancelled: 7,
      verifying: 8,
    };

    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;

    const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    const priorityDiff = (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    if (priorityDiff !== 0) return priorityDiff;

    return b.createdAt - a.createdAt;
  });

  // Stats
  const stats = {
    total: downloads.length,
    downloading: downloads.filter(d => ['downloading', 'connecting'].includes(d.status)).length,
    completed: downloads.filter(d => d.status === 'completed').length,
    failed: downloads.filter(d => d.status === 'failed').length,
    paused: downloads.filter(d => d.status === 'paused').length,
  };

  return (
    <div className="h-screen w-full flex flex-col bg-[rgb(var(--color-bg-secondary))]">
      {/* Toolbar */}
      <Toolbar
        stats={stats}
        onAddClick={() => setShowAddModal(true)}
        onSettingsClick={() => setShowSettingsModal(true)}
        onMediaSnifferClick={() => setShowMediaSnifferModal(true)}
        onMinimize={() => window.electronAPI.system.minimize()}
        onMaximize={() => window.electronAPI.system.maximize()}
        onClose={() => window.electronAPI.system.close()}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeView={activeView}
          onViewChange={setActiveView}
          categories={categories}
          stats={stats}
          onManageCategories={() => setShowCategoryModal(true)}
        />

        {/* Download List */}
        <main className="main-content flex-1 flex flex-col min-w-0">
          <DownloadList
            downloads={sortedDownloads}
            loading={loading}
            error={error}
            activeView={activeView}
            categories={categories}
            onPause={pauseDownload}
            onResume={resumeDownload}
            onCancel={cancelDownload}
            onRetry={retryDownload}
            onRemove={removeDownload}
            onOpenFile={openFile}
            onOpenFolder={openFolder}
            onCopyLink={copyLink}
            onClearCompleted={clearCompleted}
            onClearFailed={clearFailed}
            onPauseAll={pauseAll}
            onResumeAll={resumeAll}
          />

          {/* Status Bar */}
          <StatusBar
            stats={stats}
            totalSpeed={downloads.reduce((sum, d) => sum + d.speed, 0)}
          />
        </main>
      </div>

      {/* Modals */}
      <AddDownloadModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        categories={categories}
        defaultThreadCount={settings.queue.defaultThreadCount}
        defaultPriority={settings.queue.defaultPriority}
      />

      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdate={updateSettings}
        categories={categories}
        onCategoriesChange={refetchCategories}
      />

      <MediaSnifferModal
        open={showMediaSnifferModal}
        onClose={() => setShowMediaSnifferModal(false)}
      />

      <CategoryManagerModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        categories={categories}
        onCategoriesChange={refetchCategories}
      />
    </div>
  );
}