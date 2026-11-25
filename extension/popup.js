/**
 * AllDown Browser Extension - Popup Script
 * Handles UI interactions in the browser action popup
 */

// DOM Elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const sniffBtn = document.getElementById('sniffBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const openAppBtn = document.getElementById('openAppBtn');
const mediaList = document.getElementById('mediaList');

// State
let detectedMedia = [];
let isConnected = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  loadStoredMedia();
  setupEventListeners();
});

// Check connection to native app
async function checkConnection() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'get-status' });
    isConnected = response?.connected || false;
    updateConnectionStatus();
  } catch (error) {
    console.error('Connection check failed:', error);
    isConnected = false;
    updateConnectionStatus();
  }
}

function updateConnectionStatus() {
  statusIndicator.classList.toggle('disconnected', !isConnected);
  statusText.textContent = isConnected ? 'Connected to AllDown' : 'AllDown not running';
  sniffBtn.disabled = !isConnected;
  downloadAllBtn.disabled = !isConnected || detectedMedia.length === 0;
}

// Setup event listeners
function setupEventListeners() {
  sniffBtn.addEventListener('click', handleSniffMedia);
  downloadAllBtn.addEventListener('click', handleDownloadAll);
  openAppBtn.addEventListener('click', handleOpenApp);

  // Listen for media results from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'media-results') {
      detectedMedia = message.payload.resources || [];
      renderMediaList();
      downloadAllBtn.disabled = !isConnected || detectedMedia.length === 0;
    }
  });
}

// Sniff media on current page
async function handleSniffMedia() {
  sniffBtn.disabled = true;
  sniffBtn.innerHTML = `
    <div class="spinner"></div>
    Sniffing...
  `;

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Send sniff message to content script
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'sniff-media' });

    if (response?.success && response.resources) {
      detectedMedia = response.resources;
      renderMediaList();
      downloadAllBtn.disabled = false;

      // Also send to native app
      chrome.runtime.sendMessage({
        type: 'media-results',
        payload: { resources: detectedMedia, pageTitle: tab.title, pageUrl: tab.url },
      });
    }
  } catch (error) {
    console.error('Sniff failed:', error);
    // Fallback: inject sniffing script
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.alldownSniffMedia?.(),
      });
    } catch (e) {
      console.error('Fallback sniff failed:', e);
    }
  } finally {
    sniffBtn.disabled = false;
    sniffBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      Sniff Media on This Page
    `;
  }
}

// Download all detected media
async function handleDownloadAll() {
  if (detectedMedia.length === 0) return;

  downloadAllBtn.disabled = true;
  downloadAllBtn.innerHTML = `
    <div class="spinner"></div>
    Downloading...
  `;

  try {
    const mediaUrls = detectedMedia
      .filter(r => ['video', 'audio'].includes(r.type))
      .map(r => r.url);

    if (mediaUrls.length > 0) {
      await chrome.runtime.sendMessage({
        type: 'download-selection',
        payload: { urls: mediaUrls },
      });
    }
  } catch (error) {
    console.error('Download all failed:', error);
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = `
      <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Download All Media
    `;
  }
}

// Open AllDown app
function handleOpenApp() {
  // Use native messaging to open the app
  chrome.runtime.sendMessage({
    type: 'open-app',
  });
}

// Render media list
function renderMediaList() {
  if (detectedMedia.length === 0) {
    mediaList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <p>No media found on this page</p>
      </div>
    `;
    return;
  }

  mediaList.innerHTML = detectedMedia.map((resource, index) => `
    <div class="media-item" data-url="${escapeHtml(resource.url)}">
      <div class="media-icon ${resource.type}">
        ${getMediaIcon(resource.type)}
      </div>
      <div class="media-info">
        <div class="media-title">${escapeHtml(resource.title || `Resource ${index + 1}`)}</div>
        <div class="media-meta">
          <span>${resource.type.toUpperCase()}</span>
          ${resource.format ? `<span>${resource.format.toUpperCase()}</span>` : ''}
          ${resource.size ? `<span>${formatBytes(resource.size)}</span>` : ''}
          ${resource.quality ? `<span>${resource.quality}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers for individual downloads
  mediaList.querySelectorAll('.media-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.dataset.url;
      if (url) {
        chrome.runtime.sendMessage({
          type: 'download',
          payload: { url },
        });
      }
    });
  });
}

// Load stored media from previous sniff
function loadStoredMedia() {
  chrome.storage.local.get(['detectedMedia'], (result) => {
    if (result.detectedMedia) {
      detectedMedia = result.detectedMedia;
      renderMediaList();
      downloadAllBtn.disabled = !isConnected || detectedMedia.length === 0;
    }
  });
}

// Store media for persistence
function storeMedia() {
  chrome.storage.local.set({ detectedMedia });
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getMediaIcon(type) {
  switch (type) {
    case 'video':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`;
    case 'audio':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1"></path><path d="M22 8a4 4 0 0 0-4-4V2a1 1 0 0 0-2 0v2a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4v2a1 1 0 0 0 2 0V8Z"></path><path d="M8 19a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path></svg>`;
    case 'image':
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
    default:
      return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
  }
}

console.log('AllDown popup loaded');