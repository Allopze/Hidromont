import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
// A-7: vocabulario compartido con el CMS, que antes lo duplicaba a mano.
import { CATEGORIA_PROYECTO, ICONO_SERVICIO, TIPO_PROYECTO } from './data/content-vocabulary';

const categoriaProyecto = z.enum(CATEGORIA_PROYECTO);

/*
 * P3-12 (auditoría 2026-09): un valor de solo espacios contaba como relleno:
 * `mandante: "   "` pintaba «Mandante» vacío y ocultaba el cliente, y una norma
 * en blanco, una insignia vacía. Se recortan y los vacíos desaparecen.
 */
const textoOpcional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined);
const listaDeTextos = z
  .array(z.string())
  .optional()
  .transform((lista) => lista?.map((t) => t.trim()).filter(Boolean));

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: () =>
    z.object({
      nombre: z.string(),
      cliente: textoOpcional,
      mandante: textoOpcional,
      contratista: textoOpcional,
      alcance: z.string(),
      categoria: categoriaProyecto,
      // Sin declararlo aquí, Zod hace strip y el campo desaparecería en
      // silencio del frontmatter. Opcional: solo lo llevan las fichas cuya
      // categoría no basta para deducir el servicio.
      //
      // P1-02 (auditoría 2026-09): era un enum fijo de 8 slugs, así que un
      // servicio creado desde el panel no se podía asignar. El CMS valida el
      // valor contra los servicios que existen y el export omite uno que no
      // esté publicado; la ficha solo enlaza si el servicio existe.
      servicio: z.string().optional(),
      tipo: z.enum(TIPO_PROYECTO).default('banco'),
      ubicacion: textoOpcional,
      anio: z.number().optional(),
      diametro: textoOpcional,
      longitud: textoOpcional,
      peso: textoOpcional,
      acero: textoOpcional,
      normas: listaDeTextos,
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
      // Un icono subido desde el CMS (ruta de la biblioteca). Si está, se usa en
      // lugar del de la lista; vacío o ausente, el de `icono`.
      iconoPropio: z.string().optional(),
      tipos: listaDeTextos,
      aplicaciones: listaDeTextos,
      normas: listaDeTextos,
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

/**
 * El loader `file()` interpreta el JSON raíz como una colección de entradas:
 * un array cuyos elementos llevan su propio `id`, o un objeto cuyas claves son
 * los ids. El archivo era un único objeto `{id, items}`, así que `file()` leía
 * dos entradas —«id» e «items»— y la primera tenía una cadena por datos.
 *
 * No se notaba porque este config nunca se cargaba: estaba en la ruta de Astro
 * 5 mientras el proyecto corría Astro 4, que infería las colecciones del
 * directorio y trataba cada `.json` como una entrada. Al activar el config, el
 * desajuste salió a la primera compilación.
 *
 * El archivo pasa a ser `[{id: 'clientes', items: [...]}]`, que produce una
 * sola entrada con id `clientes` — justo lo que piden los dos consumidores,
 * `getEntry('clientes', 'clientes')` en `clientes.astro` e `index.astro`.
 *
 * `id` va opcional porque el loader lo consume como identificador de la
 * entrada y no está garantizado que lo deje también dentro de `data`.
 */
const clientes = defineCollection({
  loader: file('src/content/clientes/clientes.json'),
  schema: z.object({
    id: z.string().optional(),
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
