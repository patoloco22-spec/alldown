/**
 * AllDown - Main Process Entry Point
 * Electron main process with download engine, IPC, and system integration
 */

import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu, Tray, nativeImage, globalShortcut, powerMonitor, systemPreferences } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DownloadEngine } from './engine/DownloadEngine';
import { QueueManager } from './queue/QueueManager';
import { SettingsManager } from './settings/SettingsManager';
import { ClipboardMonitor } from './integrations/ClipboardMonitor';
import { BrowserIntegration } from './integrations/BrowserIntegration';
import { UpdateChecker } from './utils/UpdateChecker';
import { Logger } from './utils/Logger';
import { IPC_CHANNELS } from './ipc/channels';
import { setupIpcHandlers } from './ipc/handlers';
import type { AllSettings, DownloadFile, DownloadCategory, DownloadAddPayload, BatchDownloadPayload } from '@shared/types';

// ============================================
// Global State
// ============================================

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let downloadEngine: DownloadEngine;
let queueManager: QueueManager;
let settingsManager: SettingsManager;
let clipboardMonitor: ClipboardMonitor;
let browserIntegration: BrowserIntegration;
let updateChecker: UpdateChecker;
let logger: Logger;
let isQuitting = false;

// ============================================
// Initialization
// ============================================

async function initializeApp(): Promise<void> {
  // Initialize logger first
  logger = new Logger();
  logger.info('AllDown starting...', { version: app.getVersion() });

  // Initialize settings
  settingsManager = new SettingsManager(logger);
  await settingsManager.load();

  // Initialize download engine
  downloadEngine = new DownloadEngine(settingsManager, logger);

  // Initialize queue manager
  queueManager = new QueueManager(downloadEngine, settingsManager, logger);

  // Initialize clipboard monitor
  clipboardMonitor = new ClipboardMonitor(settingsManager, logger, (url) => handleClipboardUrl(url));

  // Initialize browser integration
  browserIntegration = new BrowserIntegration(settingsManager, logger, (info) => handleBrowserDownload(info));

  // Initialize update checker
  updateChecker = new UpdateChecker(logger);

  // Setup IPC handlers
  setupIpcHandlers({
    downloadEngine,
    queueManager,
    settingsManager,
    clipboardMonitor,
    browserIntegration,
    updateChecker,
    logger,
    getMainWindow: () => mainWindow,
  });

  // Apply settings
  applySettings(settingsManager.getAll());

  logger.info('AllDown initialized successfully');
}

function applySettings(settings: AllSettings): void {
  // Theme
  if (settings.general.theme === 'dark' || (settings.general.theme === 'system' && nativeTheme.shouldUseDarkColors)) {
    nativeTheme.themeSource = 'dark';
  } else {
    nativeTheme.themeSource = 'light';
  }

  // Clipboard monitoring
  if (settings.browser.monitorClipboard) {
    clipboardMonitor.start();
  } else {
    clipboardMonitor.stop();
  }

  // Browser integration
  if (settings.browser.enabled) {
    browserIntegration.start();
  } else {
    browserIntegration.stop();
  }

  // Queue settings
  queueManager.updateSettings(settings.queue);
}

// ============================================
// Window Management
// ============================================

function createMainWindow(): BrowserWindow {
  const settings = settingsManager.getAll();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: !settings.general.startMinimized,
    frame: process.platform !== 'darwin',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    icon: getIconPath(),
    backgroundColor: settings.general.theme === 'dark' ? '#0f172a' : '#ffffff',
  });

  // Load renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    if (settings.advanced.developerTools) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Window events
  mainWindow.on('close', (event) => {
    if (!isQuitting && settings.general.closeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
    if (!isQuitting && settings.general.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('minimize', (event) => {
    if (settings.general.minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Create tray
  createTray();

  return mainWindow;
}

function createTray(): void {
  const icon = nativeImage.createFromPath(getIconPath());
  const trayIcon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('AllDown');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show AllDown',
      click: () => mainWindow?.show(),
    },
    { type: 'separator' },
    {
      label: 'Add Download...',
      click: () => mainWindow?.webContents.send(IPC_CHANNELS.SHOW_ADD_DOWNLOAD),
    },
    {
      label: 'Pause All',
      click: () => queueManager.pauseAll(),
      enabled: queueManager.hasActiveDownloads(),
    },
    {
      label: 'Resume All',
      click: () => queueManager.resumeAll(),
      enabled: queueManager.hasPausedDownloads(),
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        mainWindow?.show();
        mainWindow?.webContents.send(IPC_CHANNELS.SHOW_SETTINGS);
      },
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function getIconPath(): string {
  const ext = process.platform === 'win32' ? '.ico' : process.platform === 'darwin' ? '.icns' : '.png';
  return path.join(__dirname, `../../assets/icon${ext}`);
}

// ============================================
// Event Handlers
// ============================================

function handleClipboardUrl(url: string): void {
  if (mainWindow) {
    mainWindow.webContents.send(IPC_CHANNELS.CLIPBOARD_URL_DETECTED, { url });
  }
}

function handleBrowserDownload(info: { url: string; filename?: string; referrer?: string; cookies?: string }): void {
  queueManager.addDownload({
    url: info.url,
    filename: info.filename,
    referrer: info.referrer,
    cookies: info.cookies,
    priority: 'normal',
    threadCount: settingsManager.getAll().queue.defaultThreadCount,
  });
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(async () => {
  await initializeApp();
  createMainWindow();

  // Register global shortcuts
  const settings = settingsManager.getAll();
  if (settings.advanced.experimentalFeatures) {
    globalShortcut.register('CommandOrControl+Shift+A', () => {
      mainWindow?.webContents.send(IPC_CHANNELS.SHOW_ADD_DOWNLOAD);
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || isQuitting) {
    app.quit();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  logger.info('Shutting down...');

  // Pause all active downloads
  await queueManager.pauseAll();

  // Save settings
  await settingsManager.save();

  // Stop monitors
  clipboardMonitor.stop();
  browserIntegration.stop();

  // Cleanup
  downloadEngine.destroy();
  globalShortcut.unregisterAll();

  logger.info('Shutdown complete');
});

// Power management
powerMonitor.on('suspend', () => {
  const settings = settingsManager.getAll();
  if (settings.queue.pauseOnBattery) {
    queueManager.pauseAll();
  }
});

powerMonitor.on('resume', () => {
  const settings = settingsManager.getAll();
  if (settings.queue.autoStartQueue) {
    queueManager.resumeAll();
  }
});

// Handle protocol links (alldown://)
if (process.platform === 'win32') {
  app.setAsDefaultProtocolClient('alldown');
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (url.startsWith('alldown://')) {
    const params = new URL(url).searchParams;
    const downloadUrl = params.get('url');
    if (downloadUrl) {
      queueManager.addDownload({ url: downloadUrl });
    }
  }
});

// Handle second instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Handle protocol URL
      const url = commandLine.find(arg => arg.startsWith('alldown://'));
      if (url) {
        const params = new URL(url).searchParams;
        const downloadUrl = params.get('url');
        if (downloadUrl) {
          queueManager.addDownload({ url: downloadUrl });
        }
      }
    }
  });
}

// Unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason: String(reason) });
});

export { mainWindow, downloadEngine, queueManager, settingsManager, logger };