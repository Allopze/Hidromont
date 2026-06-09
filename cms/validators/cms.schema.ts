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
});

export const manifestQuerySchema = z.object({
  path: z.string().optional(),
});

export const updateMediaSchema = z.object({
  alt: z.string().max(240).optional(),
  focalX: z.number().min(0).max(1).optional(),
  focalY: z.number().min(0).max(1).optional(),
});
