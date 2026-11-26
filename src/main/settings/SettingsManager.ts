/**
 * AllDown - Settings Manager
 * Handles loading, saving, and migrating application settings
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { AllSettings, GeneralSettings, DownloadSettings, NetworkSettings, BrowserIntegrationSettings, AdvancedSettings, QueueSettings, DownloadCategory } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { Logger } from '../utils/Logger';

// ============================================
// Settings Manager Class
// ============================================

export class SettingsManager {
  private settings: AllSettings;
  private logger: Logger;
  private settingsFile: string;
  private migrations: Map<number, (settings: any) => any> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
    this.settings = { ...DEFAULT_SETTINGS };
    this.settingsFile = path.join(this.getUserDataPath(), 'settings.json');
    this.registerMigrations();
  }

  getUserDataPath(): string {
    return app.getPath('userData');
  }

  getAll(): AllSettings {
    return { ...this.settings };
  }

  get<K extends keyof AllSettings>(section: K): AllSettings[K] {
    return { ...this.settings[section] };
  }

  async load(): Promise<void> {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const data = JSON.parse(await fs.promises.readFile(this.settingsFile, 'utf-8'));
        this.settings = this.migrateSettings(data);
        this.validateSettings();
        this.logger.info('Settings loaded successfully');
      } else {
        this.settings = { ...DEFAULT_SETTINGS };
        await this.save();
        this.logger.info('Created default settings');
      }
    } catch (error) {
      this.logger.error('Failed to load settings, using defaults', { error: String(error) });
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async save(): Promise<void> {
    try {
      await fs.promises.writeFile(this.settingsFile, JSON.stringify(this.settings, null, 2));
      this.logger.debug('Settings saved');
    } catch (error) {
      this.logger.error('Failed to save settings', { error: String(error) });
      throw error;
    }
  }

  async updateSection<K extends keyof AllSettings>(section: K, updates: Partial<AllSettings[K]>): Promise<void> {
    this.settings[section] = { ...this.settings[section], ...updates } as AllSettings[K];
    await this.save();
  }

  async resetToDefaults(section?: keyof AllSettings): Promise<void> {
    if (section) {
      this.settings[section] = { ...DEFAULT_SETTINGS[section] };
    } else {
      this.settings = { ...DEFAULT_SETTINGS };
    }
    await this.save();
  }

  // ============================================
  // Migration System
  // ============================================

  private registerMigrations(): void {
    // Version 1: Initial version
    // Version 2: Added browser integration settings
    this.migrations.set(2, (settings: any) => ({
      ...settings,
      browser: {
        ...DEFAULT_SETTINGS.browser,
        ...settings.browser,
      },
    }));

    // Version 3: Added queue settings
    this.migrations.set(3, (settings: any) => ({
      ...settings,
      queue: {
        ...DEFAULT_SETTINGS.queue,
        ...settings.queue,
      },
    }));

    // Version 4: Added categories
    this.migrations.set(4, (settings: any) => ({
      ...settings,
      categories: settings.categories || DEFAULT_SETTINGS.categories,
    }));
  }

  private migrateSettings(settings: any): AllSettings {
    let version = settings.version || 1;
    const currentVersion = 4;

    while (version < currentVersion) {
      const migration = this.migrations.get(version + 1);
      if (migration) {
        settings = migration(settings);
        version++;
        this.logger.info(`Migrated settings to version ${version}`);
      } else {
        break;
      }
    }

    settings.version = currentVersion;
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  // ============================================
  // Validation
  // ============================================

  private validateSettings(): void {
    // Ensure all required sections exist
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AllSettings>) {
      if (!this.settings[key]) {
        this.settings[key] = { ...DEFAULT_SETTINGS[key] };
      } else {
        // Merge with defaults to ensure all keys exist
        this.settings[key] = { ...DEFAULT_SETTINGS[key], ...this.settings[key] };
      }
    }

    // Validate specific values
    this.validateGeneralSettings();
    this.validateDownloadSettings();
    this.validateNetworkSettings();
    this.validateQueueSettings();
    this.validateCategories();
  }

  private validateGeneralSettings(): void {
    const s = this.settings.general;
    s.theme = ['light', 'dark', 'system'].includes(s.theme) ? s.theme : 'system';
    s.language = typeof s.language === 'string' && s.language.length > 0 ? s.language : 'en';
  }

  private validateDownloadSettings(): void {
    const s = this.settings.downloads;
    s.defaultThreadCount = Math.max(1, Math.min(64, s.defaultThreadCount || 8));
    s.bufferSize = Math.max(1, Math.min(1024, s.bufferSize || 64));
    s.connectTimeout = Math.max(1, Math.min(300, s.connectTimeout || 30));
    s.readTimeout = Math.max(1, Math.min(600, s.readTimeout || 60));
    s.retryCount = Math.max(0, Math.min(10, s.retryCount || 3));
    s.retryDelay = Math.max(0, Math.min(60, s.retryDelay || 5));
    s.maxRedirects = Math.max(0, Math.min(50, s.maxRedirects || 10));
    s.overwriteBehavior = ['ask', 'overwrite', 'rename', 'skip'].includes(s.overwriteBehavior) ? s.overwriteBehavior : 'rename';
  }

  private validateNetworkSettings(): void {
    const s = this.settings.network;
    if (s.proxy) {
      s.proxy.port = Math.max(1, Math.min(65535, s.proxy.port || 8080));
      s.proxy.type = ['http', 'https', 'socks4', 'socks5'].includes(s.proxy.type) ? s.proxy.type : 'http';
    }
    if (s.bandwidthLimit) {
      s.bandwidthLimit.download = Math.max(0, s.bandwidthLimit.download || 0);
      s.bandwidthLimit.upload = Math.max(0, s.bandwidthLimit.upload || 0);
    }
  }

  private validateQueueSettings(): void {
    const s = this.settings.queue;
    s.maxConcurrentDownloads = Math.max(1, Math.min(16, s.maxConcurrentDownloads || 3));
    s.maxConcurrentPerHost = Math.max(1, Math.min(8, s.maxConcurrentPerHost || 2));
    s.defaultThreadCount = Math.max(1, Math.min(64, s.defaultThreadCount || 8));
    s.defaultPriority = ['low', 'normal', 'high', 'critical'].includes(s.defaultPriority) ? s.defaultPriority : 'normal';
  }

  private validateCategories(): void {
    if (!Array.isArray(this.settings.categories) || this.settings.categories.length === 0) {
      this.settings.categories = [...DEFAULT_SETTINGS.categories];
    }

    // Ensure 'other' category exists
    const hasOther = this.settings.categories.some(c => c.id === 'other');
    if (!hasOther) {
      this.settings.categories.push(DEFAULT_SETTINGS.categories.find(c => c.id === 'other')!);
    }
  }

  // ============================================
  // Import/Export
  // ============================================

  async exportSettings(filePath: string): Promise<void> {
    const exportData = {
      version: this.settings.version || 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
    };
    await fs.promises.writeFile(filePath, JSON.stringify(exportData, null, 2));
  }

  async importSettings(filePath: string): Promise<void> {
    const data = JSON.parse(await fs.promises.readFile(filePath, 'utf-8'));
    if (data.settings) {
      this.settings = this.migrateSettings(data.settings);
      this.validateSettings();
      await this.save();
    }
  }
}