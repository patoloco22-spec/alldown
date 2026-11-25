/**
 * AllDown - IPC Channel Definitions
 * Centralized channel names for main/renderer communication
 */

export const IPC_CHANNELS = {
  // Download management
  DOWNLOAD_ADD: 'download:add',
  DOWNLOAD_BATCH_ADD: 'download:batch-add',
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_RETRY: 'download:retry',
  DOWNLOAD_REMOVE: 'download:remove',
  DOWNLOAD_GET: 'download:get',
  DOWNLOAD_GET_ALL: 'download:get-all',
  DOWNLOAD_CLEAR_COMPLETED: 'download:clear-completed',
  DOWNLOAD_CLEAR_FAILED: 'download:clear-failed',
  DOWNLOAD_PAUSE_ALL: 'download:pause-all',
  DOWNLOAD_RESUME_ALL: 'download:resume-all',
  DOWNLOAD_MOVE: 'download:move',
  DOWNLOAD_SET_PRIORITY: 'download:set-priority',
  DOWNLOAD_SET_CATEGORY: 'download:set-category',
  DOWNLOAD_OPEN_FILE: 'download:open-file',
  DOWNLOAD_OPEN_FOLDER: 'download:open-folder',
  DOWNLOAD_COPY_LINK: 'download:copy-link',

  // Progress & events (main -> renderer)
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_STATE_CHANGE: 'download:state-change',
  QUEUE_UPDATE: 'queue:update',

  // Categories
  CATEGORY_GET_ALL: 'category:get-all',
  CATEGORY_GET: 'category:get',
  CATEGORY_ADD: 'category:add',
  CATEGORY_UPDATE: 'category:update',
  CATEGORY_REMOVE: 'category:remove',
  CATEGORY_UPDATE_EVENT: 'category:update-event',

  // Settings
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_EXPORT: 'settings:export',
  SETTINGS_IMPORT: 'settings:import',

  // Clipboard
  CLIPBOARD_URL_DETECTED: 'clipboard:url-detected',
  CLIPBOARD_START: 'clipboard:start',
  CLIPBOARD_STOP: 'clipboard:stop',

  // Browser integration
  BROWSER_START: 'browser:start',
  BROWSER_STOP: 'browser:stop',
  BROWSER_GET_STATUS: 'browser:get-status',

  // Media sniffing
  MEDIA_SNIFF: 'media:sniff',
  MEDIA_SNIFF_RESULT: 'media:sniff-result',

  // Updates
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_STATUS: 'update:status',

  // System
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',
  SYSTEM_SHOW_ITEM_IN_FOLDER: 'system:show-item-in-folder',
  SYSTEM_GET_APP_VERSION: 'system:get-app-version',
  SYSTEM_GET_APP_PATH: 'system:get-app-path',
  SYSTEM_MINIMIZE: 'system:minimize',
  SYSTEM_MAXIMIZE: 'system:maximize',
  SYSTEM_CLOSE: 'system:close',
  SYSTEM_QUIT: 'system:quit',

  // UI
  SHOW_ADD_DOWNLOAD: 'ui:show-add-download',
  SHOW_SETTINGS: 'ui:show-settings',
  SHOW_MEDIA_SNIFFER: 'ui:show-media-sniffer',
  WINDOW_READY: 'ui:window-ready',

  // Statistics
  STATS_GET: 'stats:get',
  STATS_RESET: 'stats:reset',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];