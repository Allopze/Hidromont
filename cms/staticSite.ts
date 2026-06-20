import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config/unifiedConfig';

const distDir = path.join(config.rootDir, 'dist');

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

export function registerStaticSite(app: FastifyInstance): void {
  app.get('/*', serveStaticSite);
  app.head('/*', serveStaticSite);
}

async function serveStaticSite(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const pathname = getPathname(request.url);
  const filePath = await resolvePublicFile(pathname);

  if (!filePath) {
    reply.status(404).send({ error: 'Not found' });
    return;
  }

  const stat = await fs.promises.stat(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = contentTypes[extension] ?? 'application/octet-stream';

  reply
    .type(contentType)
    .header('Content-Length', stat.size)
    .header('Cache-Control', cacheControlFor(pathname, extension));

  if (request.method === 'HEAD') {
    reply.send();
    return;
  }

  await pipeline(fs.createReadStream(filePath), reply.raw);
}

async function resolvePublicFile(pathname: string): Promise<string | null> {
  if (pathname.startsWith(`${config.cms.publicUploadBase}/`)) {
    const uploadPath = pathname.slice(config.cms.publicUploadBase.length + 1);
    return findContainedFile(config.cms.uploadDir, uploadPath);
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const candidates = [
    relativePath,
    path.join(relativePath, 'index.html'),
  ];

  for (const candidate of candidates) {
    const filePath = await findContainedFile(distDir, candidate);
    if (filePath) return filePath;
  }

  return findContainedFile(distDir, '404.html');
}

async function findContainedFile(root: string, relativePath: string): Promise<string | null> {
  const normalizedRoot = path.resolve(root);
  const target = path.resolve(normalizedRoot, relativePath);

  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${path.sep}`)) {
    return null;
  }

  try {
    const stat = await fs.promises.stat(target);
    return stat.isFile() ? target : null;
  } catch {
    return null;
  }
}

function getPathname(url: string): string {
  try {
    return decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return '/';
  }
}

function cacheControlFor(pathname: string, extension: string): string {
  if (pathname.startsWith('/_assets/') || ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'].includes(extension)) {
    return 'public, max-age=31536000, immutable';
  }

  if (extension === '.html') {
    return 'no-cache';
  }

  return 'public, max-age=600, must-revalidate';
}
