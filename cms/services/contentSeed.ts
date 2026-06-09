import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { config } from '../config/unifiedConfig';
import { defaultContentEntries } from '../content/defaultContent';
import type { CmsEntry, CmsField, FieldType } from '../types/cms';

function fieldFromValue(key: string, value: unknown, sourceRef?: Record<string, unknown>): CmsField {
  let type: FieldType = 'text';
  if (typeof value === 'number') type = 'number';
  else if (Array.isArray(value)) type = 'list';
  else if (typeof value === 'object' && value !== null) type = 'object';
  else if (key.toLowerCase().includes('image')) type = 'image';
  else if (typeof value === 'string' && value.length > 120) type = 'textarea';

  return { key, type, value, sourceRef };
}

function readContentCollection(collection: 'servicios' | 'proyectos'): Omit<CmsEntry, 'version'>[] {
  const directory = path.join(config.rootDir, 'src', 'content', collection);
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '');
      const filePath = path.join(directory, file);
      const parsed = matter.read(filePath);
      const title =
        collection === 'servicios'
          ? String(parsed.data.titulo ?? slug)
          : String(parsed.data.nombre ?? slug);

      const fields = Object.fromEntries(
        [
          ...Object.entries(parsed.data).map(([key, value]) => [
            key,
            fieldFromValue(key, value, { type: 'frontmatter', collection, file }),
          ]),
          ['body', { key: 'body', type: 'richtext', value: parsed.content.trim(), sourceRef: { type: 'body', collection, file } }],
        ].map(([key, field]) => [key, field])
      ) as Record<string, CmsField>;

      return {
        id: `${collection}.${slug}`,
        kind: collection.slice(0, -1),
        slug,
        locale: 'es-CL',
        title,
        status: 'published',
        fields,
      };
    });
}

export function getInitialEntries(): Omit<CmsEntry, 'version'>[] {
  const pageEntries = defaultContentEntries.map((entry) => ({
    ...entry,
    fields: Object.fromEntries(
      Object.entries(entry.fields).map(([key, field]) => [
        key,
        {
          key,
          type: field.type,
          value: field.value,
          sourceRef: { type: 'cms-content', entryId: entry.id, key },
        },
      ])
    ),
  }));

  return [...pageEntries, ...readContentCollection('servicios'), ...readContentCollection('proyectos')];
}
