# AllDown - Modern Cross-Platform Download Manager

A powerful, open-source download manager built with Electron, React, and TypeScript. Inspired by IDM but designed for the modern web.

## Features

### Core Download Engine
- **Multi-threaded downloads** - Up to 64 concurrent threads per download
- **Pause/Resume** - Full support for interrupted downloads
- **Smart chunking** - Automatic chunk calculation with resume capability
- **Progress tracking** - Real-time speed, ETA, and progress updates
- **File verification** - MD5, SHA-1, SHA-256, SHA-512 hash verification

### Queue Management
- **Priority queue** - Critical, High, Normal, Low priority levels
- **Concurrency control** - Global and per-host limits
- **Scheduling** - Schedule downloads for specific times
- **Categories** - Auto-categorize by file extension
- **Persistence** - Queue survives app restarts

### Browser Integration
- **Native messaging** - Secure communication with browsers
- **Context menus** - Right-click to download links, images, videos, audio
- **Media sniffing** - Detect videos, audio, images on any webpage
- **Clipboard monitoring** - Auto-detect URLs copied to clipboard
- **Keyboard shortcuts** - Quick access to sniffing and downloading

### Advanced Features
- **Bandwidth limiting** - Throttle download/upload speeds
- **Proxy support** - HTTP, HTTPS, SOCKS4, SOCKS5 with auth
- **Cross-platform** - Windows, macOS, Linux (AppImage, deb, rpm)
- **Dark/Light theme** - System-aware with manual override
- **System tray** - Minimize to tray, background downloads
- **Statistics** - Download history, speed graphs, category breakdown

## Architecture

```
alldown/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── engine/           # Download engine (multi-threaded)
│   │   ├── queue/            # Queue manager
│   │   ├── settings/         # Settings persistence
│   │   ├── integrations/     # Clipboard, browser, media sniffer
│   │   ├── ipc/              # IPC channels & handlers
│   │   ├── utils/            # Logger, update checker
│   │   └── native-messaging/ # Browser extension bridge
│   ├── preload/              # Preload script (secure bridge)
│   └── renderer/             # React frontend
│       ├── components/       # UI components
│       ├── hooks/            # Custom React hooks
│       └── utils/            # Formatters, helpers
├── extension/                # Browser extension (MV3)
│   ├── manifest.json
│   ├── background.js         # Service worker
│   ├── content.js            # Media sniffing
│   ├── popup.html/js         # Extension popup
├── assets/                   # Icons, installer resources
└── electron-builder.json     # Build configuration
```

## Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup
```bash
# Install dependencies
npm install

# Start development (main + renderer)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Build
```bash
# Build for current platform
npm run build

# Package for distribution
npm run package
```

## Browser Extension

The extension is located in `extension/` and supports:
- Chrome, Edge, Brave, Vivaldi, Opera (Chromium-based)
- Firefox (with minor manifest adjustments)

### Installation (Development)
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension/` folder

### Native Messaging Setup
The extension communicates with the AllDown app via native messaging. On first run, AllDown creates the necessary manifest files in:
- **Windows**: `%APPDATA%\AllDown\NativeMessagingHosts\`
- **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- **Linux**: `~/.config/google-chrome/NativeMessagingHosts/`

## Configuration

Settings are stored in:
- **Windows**: `%APPDATA%\AllDown\settings.json`
- **macOS**: `~/Library/Application Support/AllDown/settings.json`
- **Linux**: `~/.config/AllDown/settings.json`

### Key Settings
```json
{
  "general": { "theme": "system", "minimizeToTray": true },
  "downloads": { "defaultThreadCount": 8, "overwriteBehavior": "rename" },
  "network": { "proxy": { "enabled": false }, "bandwidthLimit": { "enabled": false } },
  "browser": { "enabled": true, "monitorClipboard": true },
  "queue": { "maxConcurrentDownloads": 3, "defaultPriority": "normal" }
}
```

## Supported Protocols
- HTTP/HTTPS (with range requests)
- FTP
- Magnet links (delegates to system handler)

## Roadmap

- [ ] BitTorrent support
- [ ] Metalink support
- [ ] Remote web UI
- [ ] Plugin system
- [ ] Cloud sync (settings/queue)
- [ ] Video preview during download
- [ ] Automatic archive extraction
- [ ] Malware scanning integration

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Acknowledgments

Inspired by Internet Download Manager (IDM), Free Download Manager (FDM), and JDownloader 2.
Built with Electron, React, TypeScript, Tailwind CSS, and many open-source libraries.