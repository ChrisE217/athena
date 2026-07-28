import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import type { TestResult } from '@playwright/test/reporter';
import type { AthenaAttachment } from '../types.js';

function classifyAttachment(name: string, contentType: string, path?: string): AthenaAttachment['kind'] {
  const lower = `${name} ${path || ''}`.toLowerCase();
  if (contentType.startsWith('image/') || /screenshot/.test(lower)) return 'screenshot';
  if (contentType.startsWith('video/') || /\.(webm|mp4)$/.test(lower)) return 'video';
  if (/trace/.test(lower) || lower.endsWith('.zip')) return 'trace';
  if (/snapshot|error-context|\.md$/.test(lower) || contentType === 'text/html') return 'snapshot';
  return 'other';
}

function safeName(name: string, index: number, path?: string): string {
  const base = (path ? basename(path) : name)
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
  if (base) return `${index}-${base}`;
  return `${index}-attachment`;
}

export function copyAttachments(
  result: TestResult,
  destDir: string,
  relativeBase: string,
): AthenaAttachment[] {
  mkdirSync(destDir, { recursive: true });
  const out: AthenaAttachment[] = [];

  result.attachments.forEach((att, index) => {
    if (!att.path || !existsSync(att.path)) {
      if (att.body && att.contentType.startsWith('text/')) {
        // skip inline bodies without path for v1 file report
      }
      return;
    }

    const fileName = safeName(att.name, index, att.path);
    const withExt =
      extname(fileName) || !extname(att.path) ? fileName : `${fileName}${extname(att.path)}`;
    const destPath = join(destDir, withExt);
    copyFileSync(att.path, destPath);

    const kind = classifyAttachment(att.name, att.contentType || '', att.path);
    out.push({
      name: att.name,
      contentType: att.contentType || 'application/octet-stream',
      path: `${relativeBase}/${withExt}`.replace(/\\/g, '/'),
      kind,
    });
  });

  return out;
}
