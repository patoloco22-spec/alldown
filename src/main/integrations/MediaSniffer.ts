/**
 * AllDown - Media Sniffer
 * Detects video, audio, and other media resources on web pages
 */

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import type { MediaResource, MediaSniffResult } from '@shared/types';
import { Logger } from '../utils/Logger';

// ============================================
// Media Sniffer Class
// ============================================

export class MediaSniffer {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async sniff(pageUrl: string): Promise<MediaSniffResult> {
    try {
      this.logger.info('Starting media sniff', { url: pageUrl });

      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const resources: MediaResource[] = [];
      const pageTitle = $('title').text() || 'Unknown';

      // 1. Video elements
      $('video').each((_, el) => {
        const src = $(el).attr('src');
        const poster = $(el).attr('poster');
        if (src) {
          resources.push(this.createResource(src, 'video', pageUrl, { poster }));
        }

        // Check source children
        $(el).find('source').each((_, source) => {
          const src = $(source).attr('src');
          const type = $(source).attr('type');
          if (src) {
            resources.push(this.createResource(src, 'video', pageUrl, { mimeType: type }));
          }
        });
      });

      // 2. Audio elements
      $('audio').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          resources.push(this.createResource(src, 'audio', pageUrl));
        }

        $(el).find('source').each((_, source) => {
          const src = $(source).attr('src');
          const type = $(source).attr('type');
          if (src) {
            resources.push(this.createResource(src, 'audio', pageUrl, { mimeType: type }));
          }
        });
      });

      // 3. Source tags (picture, video, audio)
      $('source[src]').each((_, el) => {
        const src = $(el).attr('src');
        const type = $(el).attr('type');
        const parent = $(el).parent().get(0);
        const parentTag = parent ? parent.tagName.toLowerCase() : 'unknown';

        let mediaType: MediaResource['type'] = 'other';
        if (parentTag === 'video') mediaType = 'video';
        else if (parentTag === 'audio') mediaType = 'audio';
        else if (parentTag === 'picture') mediaType = 'image';

        if (src) {
          resources.push(this.createResource(src, mediaType, pageUrl, { mimeType: type }));
        }
      });

      // 4. Direct media links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (href && this.isMediaUrl(href)) {
          resources.push(this.createResource(href, this.getMediaType(href), pageUrl));
        }
      });

      // 5. Iframe embeds (YouTube, Vimeo, etc.)
      $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && this.isEmbedUrl(src)) {
          resources.push(this.createResource(src, 'video', pageUrl, { isEmbed: true }));
        }
      });

      // 6. Meta tags (Open Graph, Twitter Cards)
      $('meta[property^="og:video"], meta[property^="og:audio"], meta[name^="twitter:player"]').each((_, el) => {
        const content = $(el).attr('content');
        const property = $(el).attr('property') || $(el).attr('name');

        if (content) {
          let mediaType: MediaResource['type'] = 'other';
          if (property?.includes('video') || property?.includes('player')) mediaType = 'video';
          else if (property?.includes('audio')) mediaType = 'audio';
          else if (property?.includes('image')) mediaType = 'image';

          resources.push(this.createResource(content, mediaType, pageUrl, { metaTag: property }));
        }
      });

      // 7. JSON-LD structured data
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() || '{}');
          const extracted = this.extractFromJsonLd(data, pageUrl);
          resources.push(...extracted);
        } catch {
          // Ignore invalid JSON
        }
      });

      // 8. m3u8 / mpd (HLS/DASH) manifests
      $('script').each((_, el) => {
        const content = $(el).html() || '';
        const hlsMatches = content.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/gi);
        const dashMatches = content.match(/https?:\/\/[^"'\s]+\.mpd[^"'\s]*/gi);

        [...(hlsMatches || []), ...(dashMatches || [])].forEach(url => {
          resources.push(this.createResource(url, 'video', pageUrl, { isManifest: true }));
        });
      });

      // Deduplicate
      const uniqueResources = this.deduplicateResources(resources);

      this.logger.info('Media sniff completed', {
        url: pageUrl,
        found: uniqueResources.length,
      });

      return {
        resources: uniqueResources,
        pageTitle,
        pageUrl,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error('Media sniff failed', { url: pageUrl, error: String(error) });
      return {
        resources: [],
        pageTitle: 'Error',
        pageUrl,
        timestamp: Date.now(),
      };
    }
  }

  private createResource(
    url: string,
    type: MediaResource['type'],
    pageUrl: string,
    extras: Partial<MediaResource> = {}
  ): MediaResource {
    try {
      const urlObj = new URL(url, pageUrl);
      const absoluteUrl = urlObj.href;
      const extension = this.getExtension(absoluteUrl);

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

  private isMediaUrl(url: string): boolean {
    const mediaExtensions = [
      'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v',
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus',
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg',
      'pdf', 'zip', 'rar', '7z',
    ];

    const ext = this.getExtension(url).toLowerCase();
    return mediaExtensions.includes(ext);
  }

  private isEmbedUrl(url: string): boolean {
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

  private getMediaType(url: string): MediaResource['type'] {
    const ext = this.getExtension(url).toLowerCase();

    const videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'm3u8', 'mpd', 'ts'];
    const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'svg', 'ico', 'heic'];

    if (videoExts.includes(ext)) return 'video';
    if (audioExts.includes(ext)) return 'audio';
    if (imageExts.includes(ext)) return 'image';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';

    return 'other';
  }

  private getExtension(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();
      return ext || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private extractFromJsonLd(data: any, pageUrl: string): MediaResource[] {
    const resources: MediaResource[] = [];

    const processItem = (item: any) => {
      if (!item || typeof item !== 'object') return;

      // Check for VideoObject, AudioObject, ImageObject
      const type = item['@type'];
      if (Array.isArray(type)) {
        for (const t of type) {
          processItem({ ...item, '@type': t });
        }
        return;
      }

      if (type === 'VideoObject' && item.contentUrl) {
        resources.push(this.createResource(item.contentUrl, 'video', pageUrl, {
          title: item.name,
          thumbnail: item.thumbnailUrl,
          duration: this.parseDuration(item.duration),
        }));
      } else if (type === 'AudioObject' && item.contentUrl) {
        resources.push(this.createResource(item.contentUrl, 'audio', pageUrl, {
          title: item.name,
          duration: this.parseDuration(item.duration),
        }));
      } else if (type === 'ImageObject' && item.contentUrl) {
        resources.push(this.createResource(item.contentUrl, 'image', pageUrl));
      }

      // Recurse into nested objects
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

  private parseDuration(duration: string): number | undefined {
    // ISO 8601 duration format: PT1H30M45S
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    return hours * 3600 + minutes * 60 + seconds;
  }

  private deduplicateResources(resources: MediaResource[]): MediaResource[] {
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
}