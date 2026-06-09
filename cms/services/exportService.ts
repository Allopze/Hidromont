import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../config/unifiedConfig';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { CmsEntry } from '../types/cms';

export class ExportService {
  constructor(private readonly contentRepository: ContentRepository) {}

  exportContent(): { files: string[] } {
    const entries = this.contentRepository.listEntries();
    const written = [
      this.exportPageContent(
        entries.filter((entry) => ['page', 'layout', 'component', 'settings'].includes(entry.kind))
      ),
      ...this.exportCollection(
        entries.filter((entry) => ['servicio', 'proyecto'].includes(entry.kind) && entry.version > 1)
      ),
    ];

    return { files: written };
  }

  private exportPageContent(entries: CmsEntry[]): string {
    const target = path.join(config.rootDir, 'src', 'data', 'cms-content.json');
    const payload = {
      updatedAt: new Date().toISOString(),
      entries: Object.fromEntries(
        entries.map((entry) => [
          entry.id,
          {
            title: entry.title,
            slug: entry.slug,
            fields: Object.fromEntries(
              Object.entries(entry.fields).map(([key, field]) => [
                key,
                { type: field.type, value: field.value },
              ])
            ),
          },
        ])
      ),
    };

    fs.writeFileSync(target, JSON.stringify(payload, null, 2) + '\n');
    return path.relative(config.rootDir, target);
  }

  private exportCollection(entries: CmsEntry[]): string[] {
    return entries.map((entry) => {
      const collection = entry.kind === 'servicio' ? 'servicios' : 'proyectos';
      const target = path.join(config.rootDir, 'src', 'content', collection, `${entry.slug}.md`);
      const frontmatter: Record<string, unknown> = {};
      let body = '';

      for (const [key, field] of Object.entries(entry.fields)) {
        if (key === 'body') {
          body = String(field.value ?? '');
        } else {
          frontmatter[key] = field.value;
        }
      }

      fs.writeFileSync(target, matter.stringify(body.trim() + '\n', frontmatter));
      return path.relative(config.rootDir, target);
    });
  }
}
