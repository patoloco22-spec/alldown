/**
 * AllDown Browser Extension - Content Script
 * Sniffs media resources from web pages
 */

// Media resource interface
interface MediaResource {
  url: string;
  type: 'video' | 'audio' | 'image' | 'document' | 'archive' | 'other';
  format?: string;
  quality?: string;
  size?: number;
  duration?: number;
  title?: string;
  thumbnail?: string;
  pageUrl: string;
  isEmbed?: boolean;
  isManifest?: boolean;
  metaTag?: string;
  mimeType?: string;
}

// Listen for messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'sniff-media':
      const resources = sniffMedia();
      sendResponse({ success: true, resources });
      break;

    case 'download-all-media':
      const allResources = sniffMedia();
      const mediaUrls = allResources.filter(r => ['video', 'audio'].includes(r.type)).map(r => r.url);
      if (mediaUrls.length > 0) {
        chrome.runtime.sendMessage({
          type: 'download-selection',
          payload: { urls: mediaUrls },
        });
      }
      sendResponse({ success: true, count: mediaUrls.length });
      break;
  }
  return true;
});

// Main media sniffing function
function sniffMedia(): MediaResource[] {
  const resources: MediaResource[] = [];
  const pageUrl = window.location.href;

  // 1. Video elements
  document.querySelectorAll('video').forEach(video => {
    if (video.src) {
      resources.push(createResource(video.src, 'video', pageUrl, {
        title: video.title || document.title,
        poster: video.poster,
        duration: video.duration,
        mimeType: video.currentSrc ? getMimeType(video.currentSrc) : undefined,
      }));
    }

    video.querySelectorAll('source').forEach(source => {
      if (source.src) {
        resources.push(createResource(source.src, 'video', pageUrl, {
          mimeType: source.type,
        }));
      }
    });
  });

  // 2. Audio elements
  document.querySelectorAll('audio').forEach(audio => {
    if (audio.src) {
      resources.push(createResource(audio.src, 'audio', pageUrl, {
        title: audio.title || document.title,
        duration: audio.duration,
        mimeType: audio.currentSrc ? getMimeType(audio.currentSrc) : undefined,
      }));
    }

    audio.querySelectorAll('source').forEach(source => {
      if (source.src) {
        resources.push(createResource(source.src, 'audio', pageUrl, {
          mimeType: source.type,
        }));
      }
    });
  });

  // 3. Source tags
  document.querySelectorAll('source[src]').forEach(source => {
    const src = source.src;
    const type = source.type;
    const parent = source.parentElement;
    const parentTag = parent?.tagName.toLowerCase() || 'unknown';

    let mediaType: MediaResource['type'] = 'other';
    if (parentTag === 'video') mediaType = 'video';
    else if (parentTag === 'audio') mediaType = 'audio';
    else if (parentTag === 'picture') mediaType = 'image';

    resources.push(createResource(src, mediaType, pageUrl, { mimeType: type }));
  });

  // 4. Direct media links
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.href;
    if (isMediaUrl(href)) {
      resources.push(createResource(href, getMediaType(href), pageUrl));
    }
  });

  // 5. Iframe embeds
  document.querySelectorAll('iframe[src]').forEach(iframe => {
    const src = iframe.src;
    if (isEmbedUrl(src)) {
      resources.push(createResource(src, 'video', pageUrl, {
        isEmbed: true,
        title: iframe.title,
      }));
    }
  });

  // 6. Meta tags (Open Graph, Twitter Cards)
  document.querySelectorAll('meta[property^="og:video"], meta[property^="og:audio"], meta[name^="twitter:player"]').forEach(meta => {
    const content = meta.getAttribute('content');
    const property = meta.getAttribute('property') || meta.getAttribute('name');

    if (content) {
      let mediaType: MediaResource['type'] = 'other';
      if (property?.includes('video') || property?.includes('player')) mediaType = 'video';
      else if (property?.includes('audio')) mediaType = 'audio';
      else if (property?.includes('image')) mediaType = 'image';

      resources.push(createResource(content, mediaType, pageUrl, { metaTag: property }));
    }
  });

  // 7. JSON-LD structured data
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      const extracted = extractFromJsonLd(data, pageUrl);
      resources.push(...extracted);
    } catch {
      // Ignore invalid JSON
    }
  });

  // 8. HLS/DASH manifests in scripts
  document.querySelectorAll('script').forEach(script => {
    const content = script.textContent || '';
    const hlsMatches = content.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
    const dashMatches = content.match(/https?:\/\/[^"'\s]+\.mpd[^"'\s]*/gi);

    [...(hlsMatches || []), ...(dashMatches || [])].forEach(url => {
      resources.push(createResource(url, 'video', pageUrl, { isManifest: true }));
    });
  });

  // 9. Images
  document.querySelectorAll('img[src]').forEach(img => {
    const src = img.src;
    if (isImageUrl(src)) {
      resources.push(createResource(src, 'image', pageUrl, {
        title: img.alt || img.title,
      }));
    }
  });

  // Deduplicate
  return deduplicateResources(resources);
}

// Create resource object
function createResource(
  url: string,
  type: MediaResource['type'],
  pageUrl: string,
  extras: Partial<MediaResource> = {}
): MediaResource {
  try {
    const urlObj = new URL(url, pageUrl);
    const absoluteUrl = urlObj.href;
    const extension = getExtension(absoluteUrl);

    return {
      url: absoluteUrl,
      type,
      format: extension,
      pageUrl,
      ...extras,
    };
  } catch {
    return {
      url,
      type,
      pageUrl,
      ...extras,
    };
  }
}

// Check if URL is a media URL
function isMediaUrl(url: string): boolean {
  const mediaExtensions = [
    'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus',
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg',
    'pdf', 'zip', 'rar', '7z',
    'm3u8', 'mpd', 'ts',
  ];

  const ext = getExtension(url).toLowerCase();
  return mediaExtensions.includes(ext);
}

// Check if URL is an image
function isImageUrl(url: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico', 'heic', 'heif'];
  const ext = getExtension(url).toLowerCase();
  return imageExtensions.includes(ext);
}

// Check if URL is an embed
function isEmbedUrl(url: string): boolean {
  const embedDomains = [
    'youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com',
    'twitch.tv', 'soundcloud.com', 'bandcamp.com',
    'player.vimeo.com', 'www.youtube.com/embed',
  ];

  try {
    const hostname = new URL(url).hostname;
    return embedDomains.some(d => hostname.includes(d));
  } catch {
    return false;
  }
}

// Get media type from URL
function getMediaType(url: string): MediaResource['type'] {
  const ext = getExtension(url).toLowerCase();

  const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'm3u8', 'mpd', 'ts'];
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'];
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico', 'heic', 'heif'];

  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (imageExts.includes(ext)) return 'image';
  if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';

  return 'other';
}

// Get file extension
function getExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    return ext || 'unknown';
  } catch {
    return 'unknown';
  }
}

// Get MIME type from URL
function getMimeType(url: string): string {
  const ext = getExtension(url).toLowerCase();
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    flac: 'audio/flac',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
    m3u8: 'application/vnd.apple.mpegurl',
    mpd: 'application/dash+xml',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Extract from JSON-LD
function extractFromJsonLd(data: any, pageUrl: string): MediaResource[] {
  const resources: MediaResource[] = [];

  const processItem = (item: any) => {
    if (!item || typeof item !== 'object') return;

    const type = item['@type'];
    if (Array.isArray(type)) {
      for (const t of type) {
        processItem({ ...item, '@type': t });
      }
      return;
    }

    if (type === 'VideoObject' && item.contentUrl) {
      resources.push(createResource(item.contentUrl, 'video', pageUrl, {
        title: item.name,
        thumbnail: item.thumbnailUrl,
        duration: parseDuration(item.duration),
      }));
    } else if (type === 'AudioObject' && item.contentUrl) {
      resources.push(createResource(item.contentUrl, 'audio', pageUrl, {
        title: item.name,
        duration: parseDuration(item.duration),
      }));
    } else if (type === 'ImageObject' && item.contentUrl) {
      resources.push(createResource(item.contentUrl, 'image', pageUrl));
    }

    for (const key of Object.keys(item)) {
      if (typeof item[key] === 'object') {
        processItem(item[key]);
      }
    }
  };

  if (Array.isArray(data)) {
    data.forEach(processItem);
  } else {
    processItem(data);
  }

  return resources;
}

// Parse ISO 8601 duration
function parseDuration(duration: string): number | undefined {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

// Deduplicate resources
function deduplicateResources(resources: MediaResource[]): MediaResource[] {
  const seen = new Set<string>();
  const unique: MediaResource[] = [];

  for (const resource of resources) {
    const key = `${resource.url}|${resource.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(resource);
    }
  }

  return unique;
}

// Expose sniffMedia globally for debugging
(window as any).alldownSniffMedia = sniffMedia;

console.log('AllDown content script loaded');