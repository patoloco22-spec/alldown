/**
 * AllDown Browser Extension - Background Service Worker
 * Handles download interception, context menus, and native messaging
 */

// Native messaging port
let nativePort = null;
let portConnected = false;

// Connect to native messaging host
function connectNativeMessaging() {
  try {
    nativePort = chrome.runtime.connectNative('com.alldown.browser');
    portConnected = true;

    nativePort.onMessage.addListener((message) => {
      console.log('Received from native app:', message);
      handleNativeMessage(message);
    });

    nativePort.onDisconnect.addListener(() => {
      console.log('Native messaging disconnected');
      portConnected = false;
      // Try to reconnect after 5 seconds
      setTimeout(connectNativeMessaging, 5000);
    });

    console.log('Native messaging connected');
  } catch (error) {
    console.error('Failed to connect to native messaging:', error);
    portConnected = false;
    setTimeout(connectNativeMessaging, 5000);
  }
}

// Send message to native app
function sendToNative(message) {
  if (nativePort && portConnected) {
    nativePort.postMessage(message);
  } else {
    console.warn('Native port not connected, queuing message');
    // Could implement a queue here
  }
}

// Handle messages from native app
function handleNativeMessage(message) {
  switch (message.type) {
    case 'download':
      // Native app wants us to start a download
      handleDownloadRequest(message.payload);
      break;
    case 'media':
      // Media sniffing results
      handleMediaResults(message.payload);
      break;
    case 'ping':
      sendToNative({ type: 'pong' });
      break;
  }
}

// Handle download request from context menu or page
async function handleDownloadRequest(info) {
  const { url, filename, referrer, cookies, headers, userAgent, mimeType } = info;

  sendToNative({
    type: 'download',
    payload: {
      url,
      filename,
      referrer: referrer || document.referrer,
      cookies: cookies || document.cookie,
      headers,
      userAgent: userAgent || navigator.userAgent,
      mimeType,
    },
  });
}

// Handle media sniffing results
function handleMediaResults(payload) {
  // Forward to popup or content script
  chrome.runtime.sendMessage({
    type: 'media-results',
    payload,
  });
}

// Intercept downloads
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  // Check if AllDown should handle this download
  if (shouldInterceptDownload(item)) {
    // Cancel the browser's download
    chrome.downloads.cancel(item.id);

    // Send to AllDown
    sendToNative({
      type: 'download',
      payload: {
        url: item.url,
        filename: item.filename,
        referrer: item.referrer,
        cookies: '', // Would need to get from cookie store
        headers: {},
        userAgent: navigator.userAgent,
        mimeType: item.mime,
      },
    });

    suggest({ filename: item.filename, conflictAction: 'cancel' });
  }
});

// Determine if we should intercept this download
function shouldInterceptDownload(item) {
  // Check settings (would be stored in chrome.storage)
  // For now, intercept all downloads
  return true;
}

// Context menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'alldown-download-link',
    title: 'Download with AllDown',
    contexts: ['link'],
  });

  chrome.contextMenus.create({
    id: 'alldown-download-image',
    title: 'Download Image with AllDown',
    contexts: ['image'],
  });

  chrome.contextMenus.create({
    id: 'alldown-download-video',
    title: 'Download Video with AllDown',
    contexts: ['video'],
  });

  chrome.contextMenus.create({
    id: 'alldown-download-audio',
    title: 'Download Audio with AllDown',
    contexts: ['audio'],
  });

  chrome.contextMenus.create({
    id: 'alldown-sniff-media',
    title: 'Sniff Media with AllDown',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'alldown-download-selection',
    title: 'Download Links in Selection',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'alldown-download-link':
      if (info.linkUrl) {
        handleDownloadRequest({
          url: info.linkUrl,
          referrer: tab?.url,
        });
      }
      break;

    case 'alldown-download-image':
      if (info.srcUrl) {
        handleDownloadRequest({
          url: info.srcUrl,
          referrer: tab?.url,
        });
      }
      break;

    case 'alldown-download-video':
      if (info.srcUrl) {
        handleDownloadRequest({
          url: info.srcUrl,
          referrer: tab?.url,
        });
      }
      break;

    case 'alldown-download-audio':
      if (info.srcUrl) {
        handleDownloadRequest({
          url: info.srcUrl,
          referrer: tab?.url,
        });
      }
      break;

    case 'alldown-sniff-media':
      // Trigger media sniffing on current tab
      chrome.tabs.sendMessage(tab.id, { type: 'sniff-media' });
      break;

    case 'alldown-download-selection':
      // Extract URLs from selection
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractUrlsFromSelection,
      });
      break;
  }
});

// Extract URLs from selection
function extractUrlsFromSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const text = selection.toString();
  const urlRegex = /(https?:\/\/[^\s]+|ftp:\/\/[^\s]+|magnet:\?[^\s]+)/gi;
  const urls = text.match(urlRegex) || [];

  if (urls.length > 0) {
    chrome.runtime.sendMessage({
      type: 'download-selection',
      payload: { urls },
    });
  }
}

// Keyboard commands
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'sniff-media':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'sniff-media' });
        }
      });
      break;

    case 'download-all-media':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'download-all-media' });
        }
      });
      break;
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'download':
      handleDownloadRequest(message.payload);
      sendResponse({ success: true });
      break;

    case 'sniff-media':
      // Forward to content script
      chrome.tabs.sendMessage(sender.tab?.id || 0, { type: 'sniff-media' });
      sendResponse({ success: true });
      break;

    case 'media-results':
      // Forward to native app
      sendToNative({ type: 'media', payload: message.payload });
      sendResponse({ success: true });
      break;

    case 'get-status':
      sendResponse({ connected: portConnected });
      break;
  }
  return true; // Keep channel open for async response
});

// Initialize
connectNativeMessaging();

// Periodic ping to keep connection alive
setInterval(() => {
  if (portConnected) {
    sendToNative({ type: 'ping' });
  }
}, 30000);

console.log('AllDown Browser Extension background script loaded');