/**
 * AllDown - Browser Integration
 * Handles browser extension communication and download interception
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import type { AllSettings, ExtensionDownloadInfo, ExtensionMessage } from '../../shared/types';
import { Logger } from '../utils/Logger';

// ============================================
// Browser Integration Class
// ============================================

export class BrowserIntegration {
  private settings: AllSettings;
  private logger: Logger;
  private callback: (info: ExtensionDownloadInfo) => void;
  private extensionPort: any = null;
  private isRunning = false;

  constructor(
    settingsManager: { getAll: () => AllSettings },
    logger: Logger,
    callback: (info: ExtensionDownloadInfo) => void
  ) {
    this.settings = settingsManager.getAll();
    this.logger = logger;
    this.callback = callback;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.setupNativeMessaging();
    this.logger.info('Browser integration started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    this.extensionPort = null;
    this.logger.info('Browser integration stopped');
  }

  getStatus(): { enabled: boolean; connected: boolean; extensionId?: string } {
    return {
      enabled: this.settings.browser.enabled,
      connected: !!this.extensionPort,
      extensionId: this.settings.browser.extensionId,
    };
  }

  private setupNativeMessaging(): void {
    // Set up native messaging host for browser extensions
    // This creates the manifest files for Chrome/Firefox/Edge

    const manifestDir = this.getNativeMessagingManifestDir();
    if (!manifestDir) return;

    const manifest = {
      name: 'com.alldown.browser',
      description: 'AllDown Browser Integration',
      path: this.getExecutablePath(),
      type: 'stdio',
      allowed_origins: [
        'chrome-extension://*/*',
        'moz-extension://*/*',
      ],
    };

    try {
      if (!fs.existsSync(manifestDir)) {
        fs.mkdirSync(manifestDir, { recursive: true });
      }

      const manifestPath = path.join(manifestDir, 'com.alldown.browser.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      this.logger.info('Native messaging manifest created', { path: manifestPath });
    } catch (error) {
      this.logger.error('Failed to create native messaging manifest', { error: String(error) });
    }
  }

  private getNativeMessagingManifestDir(): string | null {
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Registry-based, but we can also use the AppData approach for user-level
      return path.join(app.getPath('userData'), 'NativeMessagingHosts');
    } else if (platform === 'darwin') {
      // macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
      return path.join(app.getPath('home'), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
    } else {
      // Linux: ~/.config/google-chrome/NativeMessagingHosts/
      return path.join(app.getPath('home'), '.config', 'google-chrome', 'NativeMessagingHosts');
    }
  }

  private getExecutablePath(): string {
    // Return path to the native messaging host executable
    // In development, this would be a Node.js script
    // In production, this would be a compiled binary
    return process.execPath;
  }

  // ============================================
  // Native Messaging Host (for stdin/stdout communication)
  // ============================================

  static runNativeMessagingHost(logger: Logger, callback: (info: ExtensionDownloadInfo) => void): void {
    let buffer = '';

    process.stdin.on('data', (chunk) => {
      buffer += chunk.toString();

      // Messages are length-prefixed (4 bytes)
      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (buffer.length >= 4 + length) {
          const messageJson = buffer.slice(4, 4 + length);
          buffer = buffer.slice(4 + length);

          try {
            const message: ExtensionMessage = JSON.parse(messageJson);
            BrowserIntegration.handleExtensionMessage(message, logger, callback);
          } catch (error) {
            logger.error('Failed to parse extension message', { error: String(error) });
          }
        } else {
          break;
        }
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });

    logger.info('Native messaging host started');
  }

  private static handleExtensionMessage(
    message: ExtensionMessage,
    logger: Logger,
    callback: (info: ExtensionDownloadInfo) => void
  ): void {
    switch (message.type) {
      case 'download':
        if ('url' in message.payload) {
          callback(message.payload as ExtensionDownloadInfo);
        }
        break;

      case 'media':
        // Handle media sniffing results
        break;

      case 'page':
        // Handle page info
        break;

      case 'link':
        // Handle link context menu
        if ('url' in message.payload) {
          callback(message.payload as ExtensionDownloadInfo);
        }
        break;

      case 'selection':
        // Handle selected text with URLs
        break;
    }

    // Send response
    const response = { success: true };
    const responseJson = JSON.stringify(response);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(responseJson.length, 0);
    process.stdout.write(Buffer.concat([lengthBuffer, Buffer.from(responseJson)]));
  }

  updateSettings(settings: AllSettings): void {
    this.settings = settings;
    if (settings.browser.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }
}

// If this file is run directly (as native messaging host)
if (require.main === module) {
  const logger = new Logger();
  BrowserIntegration.runNativeMessagingHost(logger, (info) => {
    // In native messaging host mode, we'd forward to main process via IPC
    // For now, just log
    logger.info('Download requested via extension', info);
  });
}