import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
// A-7: vocabulario compartido con el CMS, que antes lo duplicaba a mano.
import {
  CATEGORIA_PROYECTO,
  ICONO_SERVICIO,
  SERVICIO_SLUG,
  TIPO_PROYECTO,
} from './data/content-vocabulary';

const categoriaProyecto = z.enum(CATEGORIA_PROYECTO);

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: () =>
    z.object({
      nombre: z.string(),
      cliente: z.string().optional(),
      mandante: z.string().optional(),
      contratista: z.string().optional(),
      alcance: z.string(),
      categoria: categoriaProyecto,
      // Sin declararlo aquí, Zod hace strip y el campo desaparecería en
      // silencio del frontmatter. Opcional: solo lo llevan las fichas cuya
      // categoría no basta para deducir el servicio.
      servicio: z.enum(SERVICIO_SLUG).optional(),
      tipo: z.enum(TIPO_PROYECTO).default('banco'),
      ubicacion: z.string().optional(),
      anio: z.number().optional(),
      diametro: z.string().optional(),
      longitud: z.string().optional(),
      peso: z.string().optional(),
      acero: z.string().optional(),
      normas: z.array(z.string()).optional(),
      orden: z.number().default(100),
    }),
});

const servicios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/servicios' }),
  schema: () =>
    z.object({
      titulo: z.string(),
      resumen: z.string(),
      // A-7: endurecido de z.string() al enum real, ahora que hay lista.
      icono: z.enum(ICONO_SERVICIO),
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
      orden: z.number().default(100),
    }),
});

const clientes = defineCollection({
  loader: file('src/content/clientes/clientes.json'),
  schema: z.object({
    id: z.string(),
    items: z.array(
      z.object({
        nombre: z.string(),
        sector: z
          .enum(['electrica', 'construccion', 'minera', 'sanitaria', 'publica', 'industrial'])
          .optional(),
        logo: z.string().optional(),
      })
    ),
  }),
});

export const collections = { proyectos, servicios, clientes };
