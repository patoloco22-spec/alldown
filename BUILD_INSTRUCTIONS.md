# GitHub Actions Build Setup for AllDown

This guide explains how to set up automated builds using GitHub Actions.

---

## Quick Start (5 minutes)

### 1. Create GitHub Repository

```bash
# In your project folder (C:\Users\H25_8\OneDrive\Documentos\AllDown\alldown)
git init
git add .
git commit -m "Initial commit: AllDown download manager"

# Create repo on GitHub.com (public or private)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/alldown.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Actions

1. Go to your repo on GitHub.com
2. Click **Actions** tab
3. Click **"I understand my workflows, go ahead and enable them"**
4. The workflow file (`.github/workflows/build.yml`) will be detected automatically

### 3. Create First Release

```bash
# Update version in package.json first
# Then tag and push:
git tag v1.0.0
git push origin v1.0.0
```

### 4. Watch the Build

1. Go to **Actions** tab on GitHub
2. Click the running workflow
3. Wait 5-10 minutes for all platforms
4. Check **Releases** page for downloads

---

## What Gets Built Automatically

| Platform | Artifacts |
|----------|-----------|
| **Windows x64** | `AllDown-Setup-v1.0.0-x64.exe`, `AllDown-Portable-v1.0.0-x64.exe` |
| **Windows ARM64** | `AllDown-Setup-v1.0.0-arm64.exe`, `AllDown-Portable-v1.0.0-arm64.exe` |
| **macOS Universal** | `AllDown-v1.0.0-universal.dmg`, `AllDown-v1.0.0-universal.zip` |
| **Linux x64** | `AllDown-v1.0.0-x86_64.AppImage`, `AllDown-v1.0.0-x86_64.deb`, `AllDown-v1.0.0-x86_64.rpm` |
| **Linux ARM64** | `AllDown-v1.0.0-arm64.AppImage`, `AllDown-v1.0.0-arm64.deb`, `AllDown-v1.0.0-arm64.rpm` |

---

## Manual Trigger (Without Tag)

1. Go to **Actions** → **Build AllDown**
2. Click **Run workflow**
3. Optionally enter version (e.g., `v1.0.1-beta`)
4. Click **Run workflow**

---

## Code Signing (Optional but Recommended)

For production releases, you'll want code signing to avoid "Unknown Publisher" warnings.

### Windows (Code Signing Certificate)

Add these secrets in **Settings → Secrets and variables → Actions**:

| Secret Name | Value |
|-------------|-------|
| `WINDOWS_CERT_BASE64` | Base64-encoded `.pfx` certificate |
| `WINDOWS_CERT_PASSWORD` | Certificate password |

Update workflow to use:
```yaml
- name: Import Windows certificate
  uses: actions/upload-artifact@v4
  # ... import cert and use with electron-builder
```

### macOS (Apple Developer ID)

| Secret Name | Value |
|-------------|-------|
| `APPLE_CERT_BASE64` | Base64-encoded `.p12` certificate |
| `APPLE_CERT_PASSWORD` | Certificate password |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_TEAM_ID` | Team ID from Apple Developer |
| `APPLE_ID_PASSWORD` | App-specific password |

---

## Customization

### Change Build Matrix

Edit `.github/workflows/build.yml` to add/remove platforms:

```yaml
strategy:
  matrix:
    os: [windows-latest, macos-latest, ubuntu-latest]
    # Add: windows-arm64, macos-arm64, etc.
```

### Version Bumping

Create a script for version bumping:

```bash
# bump-version.sh
npm version patch  # or minor, major
git push && git push --tags
```

### Pre-releases

For beta/alpha releases:

```bash
git tag v1.1.0-beta.1
git push origin v1.1.0-beta.1
```

The workflow will create a **pre-release** on GitHub.

---

## Troubleshooting

### Build Fails on Windows
- Check Node version (use 20.x)
- Ensure `electron-builder` has all deps
- Look at Actions logs for specific error

### macOS Build Fails
- Usually certificate issues
- Set `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` if no cert

### Linux Build Fails
- Missing system dependencies (see workflow for apt packages)
- FUSE required for AppImage

### Large Artifacts
- GitHub Actions has 2GB limit per artifact
- Electron apps typically 80-150MB — well within limits

---

## Cost

**Free for public repositories** (unlimited minutes).
**Private repos**: 2,000 minutes/month free (plenty for this project).

---

## Next Steps After First Release

1. **Test installers** on clean VMs
2. **Add auto-updater** in app (electron-updater)
3. **Configure update server** (GitHub Releases works)
4. **Add analytics** (optional)
5. **Create homepage** with download links

---

## Support

- Check Actions logs for build errors
- Electron-builder docs: https://www.electron.build/
- GitHub Actions docs: https://docs.github.com/en/actions