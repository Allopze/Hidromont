import { defineCollection, z } from 'astro:content';

const categoriaProyecto = z.enum([
  'tuberias',
  'compuertas',
  'electromecanicos',
  'limpiarrejas',
  'estructuras',
]);

const proyectos = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      nombre: z.string(),
      cliente: z.string().optional(),
      alcance: z.string(),
      categoria: categoriaProyecto,
      tipo: z.enum(['destacado', 'banco']).default('banco'),
      ubicacion: z.string().optional(),
      anio: z.number().optional(),
      diametro: z.string().optional(),
      longitud: z.string().optional(),
      peso: z.string().optional(),
      acero: z.string().optional(),
      normas: z.array(z.string()).optional(),
      heroImage: image().optional(),
      gallery: z.array(image()).optional(),
      orden: z.number().default(100),
    }),
});

const servicios = defineCollection({
  type: 'content',
  schema: ({ image }) =>
    z.object({
      titulo: z.string(),
      resumen: z.string(),
      icono: z.string(),
      heroImage: image().optional(),
      tipos: z.array(z.string()).optional(),
      aplicaciones: z.array(z.string()).optional(),
      normas: z.array(z.string()).optional(),
      procesos: z
        .array(
          z.object({
            titulo: z.string(),
            descripcion: z.string(),
          })
        )
        .optional(),
      orden: z.number(),
    }),
});

const clientes = defineCollection({
  type: 'data',
  schema: z.object({
    items: z.array(
      z.object({
        nombre: z.string(),
        sector: z
          .enum([
            'electrica',
            'construccion',
            'minera',
            'sanitaria',
            'publica',
            'industrial',
          ])
          .optional(),
        logo: z.string().optional(),
      })
    ),
  }),
});

export const collections = { proyectos, servicios, clientes };
