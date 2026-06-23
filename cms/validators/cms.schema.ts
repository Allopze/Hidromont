import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const entryParamsSchema = z.object({
  id: z.string().min(1).max(160),
});

export const fieldParamsSchema = z.object({
  id: z.string().min(1).max(160),
  key: z.string().min(1).max(120),
});

export const updateFieldSchema = z.object({
  value: z.unknown(),
  mediaId: z.string().optional(),
});

export const manifestQuerySchema = z.object({
  path: z.string().optional(),
});

export const updateMediaSchema = z.object({
  alt: z.string().max(240).optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});

export const createEntrySchema = z.object({
  id: z.string().min(1).max(160).regex(/^[a-z0-9._-]+$/, 'ID debe contener solo letras minúsculas, números, puntos, guiones y guiones bajos'),
  kind: z.enum(['page', 'layout', 'component', 'settings', 'servicio', 'proyecto']),
  slug: z.string().min(1).max(240).regex(/^[a-z0-9/._-]+$/, 'Slug debe contener solo letras minúsculas, números, puntos, guiones, guiones bajos y barras diagonales').refine(val => !val.includes('..'), 'Slug no puede contener retrocesos de directorio (..)'),
  locale: z.string().optional(),
  title: z.string().min(1).max(240),
  status: z.enum(['draft', 'published']).optional(),
  fields: z.record(z.string(), z.object({ type: z.string(), value: z.unknown() })).optional(),
});

export const updateEntryMetaSchema = z.object({
  title: z.string().min(1).max(240).optional(),
  slug: z.string().min(1).max(240).regex(/^[a-z0-9/._-]+$/, 'Slug debe contener solo letras minúsculas, números, puntos, guiones, guiones bajos y barras diagonales').refine(val => !val.includes('..'), 'Slug no puede contener retrocesos de directorio (..)').optional(),
  status: z.enum(['draft', 'published']).optional(),
});

export const listEntriesQuerySchema = z.object({
  kind: z.string().optional(),
});
