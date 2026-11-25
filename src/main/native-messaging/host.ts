/**
 * AllDown - Native Messaging Host
 * Bridge between browser extension and main application
 * Run this as a separate process or integrate into main process
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

// Message types
interface ExtensionMessage {
  type: 'download' | 'media' | 'page' | 'link' | 'selection' | 'ping' | 'pong';
  payload: any;
}

interface DownloadPayload {
  url: string;
  filename?: string;
  referrer?: string;
  cookies?: string;
  headers?: Record<string, string>;
  userAgent?: string;
  mimeType?: string;
}

// Read message from stdin (length-prefixed)
function readMessage(): Promise<ExtensionMessage | null> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let buffer = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 4) {
        const length = buffer.readUInt32LE(0);
        if (buffer.length >= 4 + length) {
          const messageBuffer = buffer.slice(4, 4 + length);
          buffer = buffer.slice(4 + length);

          try {
            const message = JSON.parse(messageBuffer.toString('utf-8'));
            resolve(message);
            return;
          } catch (error) {
            console.error('Failed to parse message:', error);
            resolve(null);
            return;
          }
        } else {
          break;
        }
      }
    };

    stdin.on('data', onData);
    stdin.on('end', () => resolve(null));
    stdin.on('error', () => resolve(null));
  });
}

// Write message to stdout (length-prefixed)
function writeMessage(message: any): void {
  const json = JSON.stringify(message);
  const buffer = Buffer.from(json, 'utf-8');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32LE(buffer.length, 0);
  process.stdout.write(Buffer.concat([lengthBuffer, buffer]));
}

// Handle download request from extension
async function handleDownloadRequest(payload: DownloadPayload): Promise<void> {
  try {
    // Forward to main process via IPC
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      mainWindow.webContents.send('extension:download', payload);
    }

    // Respond to extension
    writeMessage({ success: true });
  } catch (error) {
    writeMessage({ success: false, error: String(error) });
  }
}

// Handle media sniffing results
function handleMediaResults(payload: any): void {
  const mainWindow = BrowserWindow.getAllWindows()[0];
  if (mainWindow) {
    mainWindow.webContents.send('extension:media', payload);
  }
  writeMessage({ success: true });
}

// Main message loop
async function messageLoop(): Promise<void> {
  console.error('AllDown Native Messaging Host started');

  while (true) {
    const message = await readMessage();
    if (!message) {
      // EOF or error
      break;
    }

    switch (message.type) {
      case 'download':
        await handleDownloadRequest(message.payload);
        break;

      case 'media':
        handleMediaResults(message.payload);
        break;

      case 'ping':
        writeMessage({ type: 'pong' });
        break;

      default:
        writeMessage({ success: false, error: `Unknown message type: ${message.type}` });
    }
  }

  console.error('Native Messaging Host shutting down');
  process.exit(0);
}

// If run directly (not as module)
if (require.main === module) {
  messageLoop().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for integration with main process
export { messageLoop, writeMessage, readMessage };