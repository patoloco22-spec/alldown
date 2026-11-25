import React, { useState, useRef } from 'react';
import { X, Save, Download, Globe, Shield, Cpu, Palette, Bell, FolderOpen, Upload, Download as DownloadIcon, Trash2, Plus, MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { createPortal } from 'react-dom';
import type { AllSettings, DownloadCategory, GeneralSettings, DownloadSettings, NetworkSettings, BrowserIntegrationSettings, AdvancedSettings, QueueSettings } from '@shared/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AllSettings;
  onUpdate: (section: keyof AllSettings, updates: Partial<AllSettings[keyof AllSettings]>) => Promise<{ success: boolean }>;
  categories: DownloadCategory[];
  onCategoriesChange: () => void;
}

const TABS = [
  { id: 'general', label: 'General', icon: Palette },
  { id: 'downloads', label: 'Downloads', icon: Download },
  { id: 'network', label: 'Network', icon: Globe },
  { id: 'browser', label: 'Browser', icon: Shield },
  { id: 'queue', label: 'Queue', icon: Cpu },
  { id: 'advanced', label: 'Advanced', icon: Bell },
] as const;

export function SettingsModal({
  open,
  onClose,
  settings,
  onUpdate,
  categories,
  onCategoriesChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'downloads' | 'network' | 'browser' | 'queue' | 'advanced'>('general');
  const [saving, setSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleUpdate = async (section: keyof AllSettings, updates: Partial<AllSettings[keyof AllSettings]>) => {
    setSaving(true);
    try {
      await onUpdate(section, updates);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in" onClick={onClose}>
      <div
        ref={modalRef}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-xl animate-slide-in flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm z-10 rounded-t-xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
          <button onClick={onClose} className="btn-icon p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Tab Sidebar */}
          <nav className="w-48 border-r border-slate-200 dark:border-slate-700 p-3 overflow-y-auto flex-shrink-0" role="tablist" aria-label="Settings categories">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm font-medium',
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Tab Panels */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && <GeneralSettingsPanel settings={settings.general} onUpdate={updates => handleUpdate('general', updates)} />}
            {activeTab === 'downloads' && <DownloadSettingsPanel settings={settings.downloads} onUpdate={updates => handleUpdate('downloads', updates)} />}
            {activeTab === 'network' && <NetworkSettingsPanel settings={settings.network} onUpdate={updates => handleUpdate('network', updates)} />}
            {activeTab === 'browser' && <BrowserSettingsPanel settings={settings.browser} onUpdate={updates => handleUpdate('browser', updates)} />}
            {activeTab === 'queue' && <QueueSettingsPanel settings={settings.queue} onUpdate={updates => handleUpdate('queue', updates)} />}
            {activeTab === 'advanced' && <AdvancedSettingsPanel settings={settings.advanced} onUpdate={updates => handleUpdate('advanced', updates)} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 sticky bottom-0 rounded-b-xl">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-secondary">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================
// General Settings Panel
// ============================================

function GeneralSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: GeneralSettings;
  onUpdate: (updates: Partial<GeneralSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Theme</label>
            <select
              value={settings.theme}
              onChange={e => onUpdate({ theme: e.target.value as any })}
              className="input"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="label">Language</label>
            <select
              value={settings.language}
              onChange={e => onUpdate({ language: e.target.value })}
              className="input"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ru">Russian</option>
              <option value="pt">Portuguese</option>
              <option value="it">Italian</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Window Behavior</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Minimize to tray"
            description="Hide window to system tray when minimized"
            checked={settings.minimizeToTray}
            onChange={checked => onUpdate({ minimizeToTray: checked })}
          />
          <SettingToggle
            label="Close to tray"
            description="Hide window to system tray when closed"
            checked={settings.closeToTray}
            onChange={checked => onUpdate({ closeToTray: checked })}
          />
          <SettingToggle
            label="Start minimized"
            description="Start application minimized to tray"
            checked={settings.startMinimized}
            onChange={checked => onUpdate({ startMinimized: checked })}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Updates</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Check for updates automatically"
            description="Automatically check for new versions"
            checked={settings.checkUpdates}
            onChange={checked => onUpdate({ checkUpdates: checked })}
          />
          <SettingToggle
            label="Include beta versions"
            description="Receive beta/pre-release updates"
            checked={settings.betaUpdates}
            onChange={checked => onUpdate({ betaUpdates: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Download Settings Panel
// ============================================

function DownloadSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: DownloadSettings;
  onUpdate: (updates: Partial<DownloadSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Save Location</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Default Save Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.defaultSavePath}
                onChange={e => onUpdate({ defaultSavePath: e.target.value })}
                className="input flex-1"
              />
              <button type="button" className="btn-secondary">Browse</button>
            </div>
          </div>

          <SettingToggle
            label="Ask where to save each file"
            description="Show save dialog for every download"
            checked={settings.askSavePath}
            onChange={checked => onUpdate({ askSavePath: checked })}
          />

          <SettingToggle
            label="Create category subfolders"
            description="Automatically create folders for each category"
            checked={settings.createSubfolders}
            onChange={checked => onUpdate({ createSubfolders: checked })}
          />

          <div>
            <label className="label">When file already exists</label>
            <select
              value={settings.overwriteBehavior}
              onChange={e => onUpdate({ overwriteBehavior: e.target.value as any })}
              className="input"
            >
              <option value="ask">Ask what to do</option>
              <option value="overwrite">Overwrite</option>
              <option value="rename">Rename new file</option>
              <option value="skip">Skip download</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Connection</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Default Threads</label>
            <input
              type="number"
              value={settings.defaultThreadCount}
              onChange={e => onUpdate({ defaultThreadCount: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)) })}
              min={1}
              max={64}
              className="input"
            />
          </div>

          <div>
            <label className="label">Buffer Size (KB)</label>
            <input
              type="number"
              value={settings.bufferSize}
              onChange={e => onUpdate({ bufferSize: Math.max(1, Math.min(1024, parseInt(e.target.value) || 1)) })}
              min={1}
              max={1024}
              className="input"
            />
          </div>

          <div>
            <label className="label">Connect Timeout (s)</label>
            <input
              type="number"
              value={settings.connectTimeout}
              onChange={e => onUpdate({ connectTimeout: Math.max(1, Math.min(300, parseInt(e.target.value) || 1)) })}
              min={1}
              max={300}
              className="input"
            />
          </div>

          <div>
            <label className="label">Read Timeout (s)</label>
            <input
              type="number"
              value={settings.readTimeout}
              onChange={e => onUpdate({ readTimeout: Math.max(1, Math.min(600, parseInt(e.target.value) || 1)) })}
              min={1}
              max={600}
              className="input"
            />
          </div>

          <div>
            <label className="label">Max Redirects</label>
            <input
              type="number"
              value={settings.maxRedirects}
              onChange={e => onUpdate({ maxRedirects: Math.max(0, Math.min(50, parseInt(e.target.value) || 0)) })}
              min={0}
              max={50}
              className="input"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">User Agent</label>
            <input
              type="text"
              value={settings.userAgent}
              onChange={e => onUpdate({ userAgent: e.target.value })}
              className="input font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Retries</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Retry Count</label>
            <input
              type="number"
              value={settings.retryCount}
              onChange={e => onUpdate({ retryCount: Math.max(0, Math.min(10, parseInt(e.target.value) || 0)) })}
              min={0}
              max={10}
              className="input"
            />
          </div>
          <div>
            <label className="label">Retry Delay (s)</label>
            <input
              type="number"
              value={settings.retryDelay}
              onChange={e => onUpdate({ retryDelay: Math.max(0, Math.min(60, parseInt(e.target.value) || 0)) })}
              min={0}
              max={60}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Temporary Files</h3>
        <div>
          <label className="label">Temp Folder</label>
          <input
            type="text"
            value={settings.tempFolder}
            onChange={e => onUpdate({ tempFolder: e.target.value })}
            className="input"
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Network Settings Panel
// ============================================

function NetworkSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: NetworkSettings;
  onUpdate: (updates: Partial<NetworkSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Proxy</h3>
        <div className="space-y-4">
          <SettingToggle
            label="Use proxy"
            description="Route downloads through a proxy server"
            checked={settings.proxy.enabled}
            onChange={checked => onUpdate({ proxy: { ...settings.proxy, enabled: checked } })}
          />

          {settings.proxy.enabled && (
            <div className="grid gap-4 sm:grid-cols-4 pl-6 border-l-2 border-slate-200 dark:border-slate-700">
              <div>
                <label className="label">Type</label>
                <select
                  value={settings.proxy.type}
                  onChange={e => onUpdate({ proxy: { ...settings.proxy, type: e.target.value as any } })}
                  className="input"
                >
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="socks4">SOCKS4</option>
                  <option value="socks5">SOCKS5</option>
                </select>
              </div>
              <div>
                <label className="label">Host</label>
                <input
                  type="text"
                  value={settings.proxy.host}
                  onChange={e => onUpdate({ proxy: { ...settings.proxy, host: e.target.value } })}
                  className="input"
                  placeholder="proxy.example.com"
                />
              </div>
              <div>
                <label className="label">Port</label>
                <input
                  type="number"
                  value={settings.proxy.port}
                  onChange={e => onUpdate({ proxy: { ...settings.proxy, port: Math.max(1, Math.min(65535, parseInt(e.target.value) || 1)) } })}
                  min={1}
                  max={65535}
                  className="input"
                />
              </div>
              <div className="flex items-end">
                <label className="label">Auth</label>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Username</label>
                <input
                  type="text"
                  value={settings.proxy.username || ''}
                  onChange={e => onUpdate({ proxy: { ...settings.proxy, username: e.target.value } })}
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Password</label>
                <input
                  type="password"
                  value={settings.proxy.password || ''}
                  onChange={e => onUpdate({ proxy: { ...settings.proxy, password: e.target.value } })}
                  className="input"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Bandwidth Limiting</h3>
        <div className="space-y-4">
          <SettingToggle
            label="Enable bandwidth limit"
            description="Limit maximum download speed"
            checked={settings.bandwidthLimit.enabled}
            onChange={checked => onUpdate({ bandwidthLimit: { ...settings.bandwidthLimit, enabled: checked } })}
          />

          {settings.bandwidthLimit.enabled && (
            <div className="grid gap-4 sm:grid-cols-2 pl-6 border-l-2 border-slate-200 dark:border-slate-700">
              <div>
                <label className="label">Download Limit (KB/s, 0 = unlimited)</label>
                <input
                  type="number"
                  value={Math.round(settings.bandwidthLimit.download / 1024)}
                  onChange={e => onUpdate({ bandwidthLimit: { ...settings.bandwidthLimit, download: Math.max(0, parseInt(e.target.value) || 0) * 1024 } })}
                  min={0}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Upload Limit (KB/s, 0 = unlimited)</label>
                <input
                  type="number"
                  value={Math.round(settings.bandwidthLimit.upload / 1024)}
                  onChange={e => onUpdate({ bandwidthLimit: { ...settings.bandwidthLimit, upload: Math.max(0, parseInt(e.target.value) || 0) * 1024 } })}
                  min={0}
                  className="input"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Network Options</h3>
        <div className="space-y-3">
          <SettingToggle
            label="DNS over HTTPS"
            description="Use encrypted DNS queries"
            checked={settings.dnsOverHttps}
            onChange={checked => onUpdate({ dnsOverHttps: checked })}
          />
          <SettingToggle
            label="Enable IPv6"
            description="Prefer IPv6 connections when available"
            checked={settings.ipv6}
            onChange={checked => onUpdate({ ipv6: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Browser Settings Panel
// ============================================

function BrowserSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: BrowserIntegrationSettings;
  onUpdate: (updates: Partial<BrowserIntegrationSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Integration</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Enable browser integration"
            description="Intercept downloads from web browsers"
            checked={settings.enabled}
            onChange={checked => onUpdate({ enabled: checked })}
          />

          <SettingToggle
            label="Monitor clipboard for URLs"
            description="Automatically detect URLs copied to clipboard"
            checked={settings.monitorClipboard}
            onChange={checked => onUpdate({ monitorClipboard: checked })}
          />

          <SettingToggle
            label="Intercept downloads"
            description="Capture downloads initiated from browser"
            checked={settings.interceptDownloads}
            onChange={checked => onUpdate({ interceptDownloads: checked })}
          />

          <SettingToggle
            label="Show download panel"
            description="Show panel when download starts"
            checked={settings.showDownloadPanel}
            onChange={checked => onUpdate({ showDownloadPanel: checked })}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Supported Browsers</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {['chrome', 'edge', 'firefox', 'brave', 'vivaldi', 'opera'].map(browser => (
            <label key={browser} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.browsers.includes(browser)}
                onChange={e => onUpdate({
                  browsers: e.target.checked
                    ? [...settings.browsers, browser]
                    : settings.browsers.filter(b => b !== browser)
                })}
                className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{browser}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Clipboard Patterns</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Regular expressions to match URLs in clipboard. One per line.
        </p>
        <textarea
          value={settings.clipboardPatterns.join('\n')}
          onChange={e => onUpdate({ clipboardPatterns: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })}
          className="input font-mono text-sm min-h-[100px] resize-y"
          rows={5}
        />
      </div>
    </div>
  );
}

// ============================================
// Queue Settings Panel
// ============================================

function QueueSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: QueueSettings;
  onUpdate: (updates: Partial<QueueSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Concurrency</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Max Concurrent Downloads</label>
            <input
              type="number"
              value={settings.maxConcurrentDownloads}
              onChange={e => onUpdate({ maxConcurrentDownloads: Math.max(1, Math.min(16, parseInt(e.target.value) || 1)) })}
              min={1}
              max={16}
              className="input"
            />
          </div>

          <div>
            <label className="label">Max Concurrent Per Host</label>
            <input
              type="number"
              value={settings.maxConcurrentPerHost}
              onChange={e => onUpdate({ maxConcurrentPerHost: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)) })}
              min={1}
              max={8}
              className="input"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Defaults</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Default Thread Count</label>
            <input
              type="number"
              value={settings.defaultThreadCount}
              onChange={e => onUpdate({ defaultThreadCount: Math.max(1, Math.min(64, parseInt(e.target.value) || 1)) })}
              min={1}
              max={64}
              className="input"
            />
          </div>

          <div>
            <label className="label">Default Priority</label>
            <select
              value={settings.defaultPriority}
              onChange={e => onUpdate({ defaultPriority: e.target.value as any })}
              className="input"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Behavior</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Auto-start queue"
            description="Automatically start queued downloads when slots available"
            checked={settings.autoStartQueue}
            onChange={checked => onUpdate({ autoStartQueue: checked })}
          />

          <SettingToggle
            label="Pause on battery"
            description="Pause downloads when running on battery power"
            checked={settings.pauseOnBattery}
            onChange={checked => onUpdate({ pauseOnBattery: checked })}
          />

          <SettingToggle
            label="Pause on metered connection"
            description="Pause downloads on metered networks"
            checked={settings.pauseOnMeteredConnection}
            onChange={checked => onUpdate({ pauseOnMeteredConnection: checked })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Advanced Settings Panel
// ============================================

function AdvancedSettingsPanel({
  settings,
  onUpdate,
}: {
  settings: AdvancedSettings;
  onUpdate: (updates: Partial<AdvancedSettings>) => void;
}) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Logging</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Log Level</label>
            <select
              value={settings.logLevel}
              onChange={e => onUpdate({ logLevel: e.target.value as any })}
              className="input"
            >
              <option value="debug">Debug</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Max Log Files</label>
              <input
                type="number"
                value={settings.maxLogFiles}
                onChange={e => onUpdate({ maxLogFiles: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                min={1}
                max={50}
                className="input"
              />
            </div>
            <div>
              <label className="label">Max Log Size (MB)</label>
              <input
                type="number"
                value={settings.maxLogSize}
                onChange={e => onUpdate({ maxLogSize: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
                min={1}
                max={100}
                className="input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Features</h3>
        <div className="space-y-3">
          <SettingToggle
            label="Crash reporting"
            description="Automatically send crash reports"
            checked={settings.crashReporting}
            onChange={checked => onUpdate({ crashReporting: checked })}
          />

          <SettingToggle
            label="Hardware acceleration"
            description="Use GPU for UI rendering"
            checked={settings.hardwareAcceleration}
            onChange={checked => onUpdate({ hardwareAcceleration: checked })}
          />

          <SettingToggle
            label="Experimental features"
            description="Enable features under development"
            checked={settings.experimentalFeatures}
            onChange={checked => onUpdate({ experimentalFeatures: checked })}
          />

          <SettingToggle
            label="Developer tools"
            description="Enable developer tools in development"
            checked={settings.developerTools}
            onChange={checked => onUpdate({ developerTools: checked })}
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Data Management</h3>
        <div className="space-y-3">
          <button className="btn-secondary w-full justify-start">
            <Upload className="w-4 h-4" />
            <span>Export Settings</span>
          </button>
          <button className="btn-secondary w-full justify-start">
            <DownloadIcon className="w-4 h-4" />
            <span>Import Settings</span>
          </button>
          <button className="btn-danger w-full justify-start">
            <Trash2 className="w-4 h-4" />
            <span>Reset All Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Setting Toggle Component
// ============================================

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
      />
      <div className="flex-1">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}