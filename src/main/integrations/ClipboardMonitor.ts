/**
 * AllDown - Clipboard Monitor
 * Watches clipboard for URLs and downloadable content
 */

import { clipboard } from 'electron';
import type { AllSettings } from '../../shared/types';
import { Logger } from '../utils/Logger';

// ============================================
// Clipboard Monitor Class
// ============================================

export class ClipboardMonitor {
  private settings: AllSettings;
  private logger: Logger;
  private callback: (url: string) => void;
  private interval: NodeJS.Timeout | null = null;
  private lastClipboardContent: string = '';
  private isRunning = false;

  constructor(
    settingsManager: { getAll: () => AllSettings },
    logger: Logger,
    callback: (url: string) => void
  ) {
    this.settings = settingsManager.getAll();
    this.logger = logger;
    this.callback = callback;
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastClipboardContent = clipboard.readText() || '';

    this.interval = setInterval(() => {
      this.checkClipboard();
    }, 1000); // Check every second

    this.logger.info('Clipboard monitor started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.logger.info('Clipboard monitor stopped');
  }

  private checkClipboard(): void {
    try {
      const content = clipboard.readText() || '';

      if (content !== this.lastClipboardContent && content.length > 0) {
        this.lastClipboardContent = content;
        this.processClipboardContent(content);
      }
    } catch (error) {
      // Clipboard might be locked by another app
      this.logger.debug('Clipboard read error', { error: String(error) });
    }
  }

  private processClipboardContent(content: string): void {
    const patterns = this.settings.browser.clipboardPatterns || [
      '^https?://',
      '^magnet:',
      '^ftp://',
    ];

    // Check each line for URLs
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      for (const pattern of patterns) {
        try {
          const regex = new RegExp(pattern, 'i');
          if (regex.test(trimmed)) {
            // Extract URL from the line
            const urlMatch = trimmed.match(regex);
            if (urlMatch) {
              this.logger.info('URL detected in clipboard', { url: urlMatch[0] });
              this.callback(urlMatch[0]);
              return; // Only process first match
            }
          }
        } catch (e) {
          // Invalid regex, skip
        }
      }
    }
  }

  updateSettings(settings: AllSettings): void {
    this.settings = settings;
    if (settings.browser.monitorClipboard) {
      this.start();
    } else {
      this.stop();
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }
}