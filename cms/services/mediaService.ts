import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import sharp from 'sharp';
import { config } from '../config/unifiedConfig';
import type { MediaRepository } from '../repositories/MediaRepository';

const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);
const publicMediaRoots = ['fotos', 'logos-clientes', path.join('uploads', 'cms')];

function mimeFromExt(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  return undefined;
}

function safeFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const base = path
    .basename(name, ext)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${base || 'imagen'}-${nanoid(8)}${ext}`;
}

export class MediaService {
  constructor(private readonly mediaRepository: MediaRepository) {}

  listMedia() {
    return this.mediaRepository.list();
  }

  async syncPublicMedia(): Promise<{ imported: number }> {
    let imported = 0;
    for (const root of publicMediaRoots) {
      const directory = path.join(config.rootDir, 'public', root);
      if (!fs.existsSync(directory)) continue;
      const files = this.walkFiles(directory);
      for (const filePath of files) {
        const mime = mimeFromExt(filePath);
        if (!mime || !allowedMime.has(mime)) continue;

        const publicPath = `/${path.relative(path.join(config.rootDir, 'public'), filePath).split(path.sep).join('/')}`;
        const existing = this.mediaRepository.findByPath(publicPath);
        if (existing) continue;

        const buffer = fs.readFileSync(filePath);
        const metadata = mime === 'image/svg+xml' ? undefined : await sharp(buffer).metadata();
        const now = new Date().toISOString();
        this.mediaRepository.upsertByPath({
          id: nanoid(),
          name: path.basename(filePath),
          path: publicPath,
          mime,
          width: metadata?.width,
          height: metadata?.height,
          size: buffer.byteLength,
          alt: path.basename(filePath, path.extname(filePath)).replace(/[-_]+/g, ' '),
          focalX: 0.5,
          focalY: 0.5,
          checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
          createdAt: now,
          updatedAt: now,
        });
        imported += 1;
      }
    }

    return { imported };
  }

  async createMedia(input: { filename: string; mime: string; buffer: Buffer; alt?: string }) {
    if (!allowedMime.has(input.mime)) throw new Error('Tipo de archivo no permitido');
    if (input.buffer.byteLength > config.cms.uploadMaxBytes) throw new Error('Archivo demasiado grande');

    fs.mkdirSync(config.cms.uploadDir, { recursive: true });

    const name = safeFilename(input.filename);
    const fullPath = path.join(config.cms.uploadDir, name);
    const publicPath = `${config.cms.publicUploadBase}/${name}`;

    if (!fullPath.startsWith(config.cms.uploadDir)) throw new Error('Ruta de archivo inválida');

    fs.writeFileSync(fullPath, input.buffer);

    const checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const metadata = input.mime === 'image/svg+xml' ? undefined : await sharp(input.buffer).metadata();
    const now = new Date().toISOString();

    return this.mediaRepository.create({
      id: nanoid(),
      name,
      path: publicPath,
      mime: input.mime,
      width: metadata?.width,
      height: metadata?.height,
      size: input.buffer.byteLength,
      alt: input.alt,
      focalX: 0.5,
      focalY: 0.5,
      checksum,
      createdAt: now,
      updatedAt: now,
    });
  }

  updateMedia(input: { id: string; alt?: string; focalX?: number; focalY?: number }) {
    return this.mediaRepository.update({
      ...input,
      now: new Date().toISOString(),
    });
  }

  private walkFiles(directory: string): string[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return this.walkFiles(fullPath);
      if (entry.isFile()) return [fullPath];
      return [];
    });
  }
}
