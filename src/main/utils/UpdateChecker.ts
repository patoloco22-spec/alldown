/**
 * AllDown - Update Checker
 * Checks for application updates from GitHub releases or custom endpoint
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { UpdateInfo } from '../../../shared/types';
import { Logger } from './Logger';

// ============================================
// Update Checker Class
// ============================================

export class UpdateChecker {
  private logger: Logger;
  private updateUrl: string;
  private currentVersion: string;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
    this.currentVersion = app.getVersion();
    // Default to GitHub releases API - user can override in settings
    this.updateUrl = 'https://api.github.com/repos/alldown/alldown/releases/latest';
  }

  setUpdateUrl(url: string): void {
    this.updateUrl = url;
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      this.logger.info('Checking for updates...', { currentVersion: this.currentVersion });

      const response = await fetch(this.updateUrl, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': `AllDown/${this.currentVersion}`,
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as any;

      // Parse GitHub release
      const latestVersion = data.tag_name?.replace('v', '') || data.name?.replace('v', '');
      if (!latestVersion) {
        throw new Error('No version found in release data');
      }

      if (this.compareVersions(latestVersion, this.currentVersion) <= 0) {
        this.logger.info('No updates available');
        return null;
      }

      // Find appropriate asset for current platform
      const asset = this.findPlatformAsset(data.assets);
      if (!asset) {
        throw new Error('No suitable asset found for this platform');
      }

      const updateInfo: UpdateInfo = {
        version: latestVersion,
        releaseDate: data.published_at || new Date().toISOString(),
        releaseNotes: data.body || 'No release notes provided.',
        downloadUrl: asset.browser_download_url,
        size: asset.size,
        signature: '', // Would be populated with actual signature verification
        mandatory: false, // Could be determined from release notes or tags
      };

      this.logger.info('Update available', { version: latestVersion });
      return updateInfo;
    } catch (error) {
      this.logger.error('Update check failed', { error: String(error) });
      return null;
    }
  }

  private findPlatformAsset(assets: any[]): any {
    const platform = process.platform;
    const arch = process.arch;

    let patterns: string[] = [];

    if (platform === 'win32') {
      patterns = ['.exe', '.msi'];
    } else if (platform === 'darwin') {
      patterns = arch === 'arm64' ? ['-arm64.dmg', '-universal.dmg', '.dmg'] : ['-x64.dmg', '.dmg'];
    } else {
      patterns = ['.AppImage', '.deb', '.rpm', '.tar.gz'];
    }

    // First try exact match
    for (const pattern of patterns) {
      const asset = assets.find(a => a.name.endsWith(pattern));
      if (asset) return asset;
    }

    // Fallback: any asset that might work
    return assets.find(a => patterns.some(p => a.name.includes(p))) || assets[0];
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) return p1 - p2;
    }

    return 0;
  }

  async downloadUpdate(downloadUrl: string): Promise<string> {
    try {
      this.logger.info('Downloading update...', { url: downloadUrl });

      const response = await fetch(downloadUrl, {
        headers: { 'User-Agent': `AllDown/${this.currentVersion}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tempDir = app.getPath('temp');
      const fileName = path.basename(new URL(downloadUrl).pathname);
      const filePath = path.join(tempDir, fileName);

      const fileStream = fs.createWriteStream(filePath);
      const reader = response.body?.getReader();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fileStream.write(value);
      }

      fileStream.end();

      await new Promise<void>((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });

      this.logger.info('Update downloaded', { path: filePath });
      return filePath;
    } catch (error) {
      this.logger.error('Update download failed', { error: String(error) });
      throw error;
  }
  }

  startPeriodicCheck(intervalHours: number = 24): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, intervalHours * 60 * 60 * 1000);

    this.logger.info(`Periodic update check started (every ${intervalHours}h)`);
  }

  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Periodic update check stopped');
    }
  }
}