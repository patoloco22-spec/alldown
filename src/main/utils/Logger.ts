/**
 * AllDown - Logger
 * Structured logging with levels, file rotation, and pretty console output
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',    // Cyan
  info: '\x1b[32m',     // Green
  warn: '\x1b[33m',     // Yellow
  error: '\x1b[31m',    // Red
};

const RESET_COLOR = '\x1b[0m';

export class Logger {
  private logLevel: LogLevel = 'info';
  private logFile: string;
  private maxLogFiles: number = 10;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB
  private writeQueue: LogEntry[] = [];
  private isWriting = false;

  constructor() {
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFile = path.join(logsDir, 'alldown.log');
    this.rotateLogsIfNeeded();
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setMaxFiles(count: number): void {
    this.maxLogFiles = Math.max(1, Math.min(50, count));
  }

  setMaxSize(sizeMB: number): void {
    this.maxLogSize = Math.max(1, Math.min(100, sizeMB)) * 1024 * 1024;
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, any>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.logLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    // Console output
    this.writeToConsole(entry);

    // File output (queued)
    this.writeQueue.push(entry);
    this.processWriteQueue();
  }

  private writeToConsole(entry: LogEntry): void {
    const color = LEVEL_COLORS[entry.level];
    const levelStr = entry.level.toUpperCase().padEnd(5);
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';

    console.log(
      `${color}[${entry.timestamp}] ${levelStr}${RESET_COLOR} ${entry.message}${contextStr}`
    );
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    const entries = [...this.writeQueue];
    this.writeQueue = [];

    try {
      const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      await fs.promises.appendFile(this.logFile, lines, 'utf-8');
      await this.rotateLogsIfNeeded();
    } catch (error) {
      // Put entries back on failure
      this.writeQueue.unshift(...entries);
      console.error('Failed to write log file:', error);
    } finally {
      this.isWriting = false;

      // Process any new entries that arrived while writing
      if (this.writeQueue.length > 0) {
        this.processWriteQueue();
      }
    }
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.logFile);
      if (stats.size < this.maxLogSize) return;

      // Rotate logs
      for (let i = this.maxLogFiles - 1; i >= 1; i--) {
        const oldPath = `${this.logFile}.${i}`;
        const newPath = `${this.logFile}.${i + 1}`;

        if (fs.existsSync(oldPath)) {
          if (i === this.maxLogFiles - 1) {
            await fs.promises.unlink(oldPath);
          } else {
            await fs.promises.rename(oldPath, newPath);
          }
        }
      }

      await fs.promises.rename(this.logFile, `${this.logFile}.1`);
    } catch (error) {
      // Ignore rotation errors
    }
  }

  async getRecentLogs(count: number = 100): Promise<LogEntry[]> {
    try {
      const content = await fs.promises.readFile(this.logFile, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-count).map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  async clearLogs(): Promise<void> {
    try {
      await fs.promises.writeFile(this.logFile, '');
      // Also remove rotated files
      for (let i = 1; i <= this.maxLogFiles; i++) {
        const rotatedPath = `${this.logFile}.${i}`;
        if (fs.existsSync(rotatedPath)) {
          await fs.promises.unlink(rotatedPath);
        }
      }
    } catch (error) {
      this.error('Failed to clear logs', { error: String(error) });
    }
  }
}

// Singleton instance
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger();
  }
  return loggerInstance;
}