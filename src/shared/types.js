"use strict";
/**
 * AllDown - Shared Type Definitions
 * Core types used across main and renderer processes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SETTINGS = exports.DEFAULT_CATEGORIES = exports.DEFAULT_RETRY_DELAY = exports.DEFAULT_RETRY_COUNT = exports.DEFAULT_READ_TIMEOUT = exports.DEFAULT_CONNECT_TIMEOUT = exports.DEFAULT_BUFFER_SIZE = exports.MIN_CHUNK_SIZE = exports.MAX_THREAD_COUNT = exports.DEFAULT_THREAD_COUNT = void 0;
// ============================================
// Default Values
// ============================================
exports.DEFAULT_THREAD_COUNT = 8;
exports.MAX_THREAD_COUNT = 64;
exports.MIN_CHUNK_SIZE = 1024 * 1024; // 1MB
exports.DEFAULT_BUFFER_SIZE = 64; // KB
exports.DEFAULT_CONNECT_TIMEOUT = 30; // seconds
exports.DEFAULT_READ_TIMEOUT = 60; // seconds
exports.DEFAULT_RETRY_COUNT = 3;
exports.DEFAULT_RETRY_DELAY = 5; // seconds
exports.DEFAULT_CATEGORIES = [
    {
        id: 'documents',
        name: 'Documents',
        color: '#3b82f6',
        icon: 'file-text',
        extensions: ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'],
        defaultPath: 'Documents',
        autoAdd: true,
        order: 1,
    },
    {
        id: 'videos',
        name: 'Videos',
        color: '#ec4899',
        icon: 'video',
        extensions: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'],
        defaultPath: 'Videos',
        autoAdd: true,
        order: 2,
    },
    {
        id: 'audio',
        name: 'Audio',
        color: '#8b5cf6',
        icon: 'music',
        extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'],
        defaultPath: 'Music',
        autoAdd: true,
        order: 3,
    },
    {
        id: 'images',
        name: 'Images',
        color: '#10b981',
        icon: 'image',
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico', 'heic'],
        defaultPath: 'Pictures',
        autoAdd: true,
        order: 4,
    },
    {
        id: 'archives',
        name: 'Archives',
        color: '#f59e0b',
        icon: 'archive',
        extensions: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg'],
        defaultPath: 'Downloads',
        autoAdd: true,
        order: 5,
    },
    {
        id: 'software',
        name: 'Software',
        color: '#ef4444',
        icon: 'cpu',
        extensions: ['exe', 'msi', 'apk', 'dmg', 'pkg', 'deb', 'rpm', 'appimage', 'sh', 'bat'],
        defaultPath: 'Downloads',
        autoAdd: true,
        order: 6,
    },
    {
        id: 'other',
        name: 'Other',
        color: '#64748b',
        icon: 'file',
        extensions: [],
        defaultPath: 'Downloads',
        autoAdd: true,
        order: 7,
    },
];
exports.DEFAULT_SETTINGS = {
    general: {
        language: 'en',
        theme: 'system',
        minimizeToTray: true,
        closeToTray: false,
        startMinimized: false,
        checkUpdates: true,
        betaUpdates: false,
    },
    downloads: {
        defaultSavePath: 'Downloads',
        askSavePath: false,
        createSubfolders: true,
        overwriteBehavior: 'rename',
        tempFolder: 'temp',
        bufferSize: 64,
        maxRedirects: 10,
        connectTimeout: 30,
        readTimeout: 60,
        retryCount: 3,
        retryDelay: 5,
        userAgent: 'AllDown/1.0',
    },
    network: {
        proxy: {
            enabled: false,
            host: '',
            port: 8080,
            type: 'http',
        },
        bandwidthLimit: {
            enabled: false,
            download: 0,
            upload: 0,
        },
        dnsOverHttps: false,
        ipv6: true,
    },
    browser: {
        enabled: true,
        browsers: ['chrome', 'edge', 'firefox', 'brave', 'vivaldi', 'opera'],
        monitorClipboard: true,
        clipboardPatterns: [
            '^https?://',
            '^magnet:',
            '^ftp://',
        ],
        interceptDownloads: true,
        showDownloadPanel: true,
    },
    advanced: {
        logLevel: 'info',
        maxLogFiles: 10,
        maxLogSize: 10,
        crashReporting: true,
        hardwareAcceleration: true,
        experimentalFeatures: false,
        developerTools: false,
    },
    queue: {
        maxConcurrentDownloads: 3,
        maxConcurrentPerHost: 2,
        defaultThreadCount: 8,
        defaultPriority: 'normal',
        autoStartQueue: true,
        pauseOnBattery: true,
        pauseOnMeteredConnection: true,
    },
    categories: exports.DEFAULT_CATEGORIES,
};
