# AllDown Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of AllDown download manager
- Multi-threaded download engine (up to 64 threads)
- Pause/resume support with persistent chunks
- Download queue with priority levels (Critical/High/Normal/Low)
- Category-based organization with auto-detection
- Browser extension (Manifest V3) with native messaging
- Media sniffer for videos, audio, images
- Clipboard monitoring for auto URL detection
- Bandwidth limiting (token bucket algorithm)
- Proxy support (HTTP, HTTPS, SOCKS4, SOCKS5)
- File verification (MD5, SHA-1, SHA-256, SHA-512)
- Download scheduling (one-time, daily, weekly, monthly)
- Dark/light theme with system detection
- System tray integration
- Cross-platform: Windows, macOS, Linux

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.0.0] - 2024-XX-XX

### Added
- First stable release

---

## Release Checklist

When releasing a new version:

1. Update version in `package.json`
2. Update `CHANGELOG.md` with changes
3. Commit: `git commit -am "chore: release vX.Y.Z"`
4. Tag: `git tag vX.Y.Z`
5. Push: `git push && git push --tags`
6. GitHub Actions will build and create release automatically
7. Verify release artifacts on GitHub Releases page