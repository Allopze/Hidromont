/**
 * Los campos de imagen del CMS guardaban una ruta y `EditableImage` la pintaba
 * en un `<img>` sin `srcset`. La biblioteca tiene 213 fotos con algún lado por
 * encima de 1.600 px y 42 que pasan de 500 KB, así que elegir una en el panel
 * podía servir 700 KB y 3.840 px dentro de una tarjeta de 119 px.
 *
 * Ahora el export calcula los derivados por campo. Estos guardas fijan las
 * cuatro condiciones que hacen que el arreglo siga siendo un arreglo:
 * los archivos existen, ningún candidato pasa de 1.600 px, derivar nunca
 * aumenta el peso, y un vector no se rasteriza.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const PUBLIC_DIR = path.resolve('public');
const enDisco = (src: string) => path.join(PUBLIC_DIR, src.replace(/^\//, ''));

interface CampoImagen {
  label: string;
  value: string;
  derived?: { src: string; srcset: string; width: number; height: number };
}

function camposDeImagen(): CampoImagen[] {
  const cms = JSON.parse(readFileSync('src/data/cms-content.json', 'utf8'));
  const campos: CampoImagen[] = [];
  for (const [entryId, entry] of Object.entries<{
    fields: Record<string, { type: string; value: unknown; derived?: CampoImagen['derived'] }>;
  }>(cms.entries)) {
    for (const [key, field] of Object.entries(entry.fields)) {
      if (field.type !== 'image' || typeof field.value !== 'string' || !field.value) continue;
      campos.push({ label: `${entryId}.${key}`, value: field.value, derived: field.derived });
    }
  }
  return campos;
}

/** Los pares [ruta, ancho declarado] de un srcset. */
function candidatos(srcset: string): Array<[string, number]> {
  return srcset.split(',').map((parte) => {
    const [ruta, ancho] = parte.trim().split(/\s+/);
    return [ruta, Number.parseInt(ancho, 10)];
  });
}

const campos = camposDeImagen();
const conDerivados = campos.filter((c) => c.derived);

describe('derivados de los campos de imagen', () => {
  it('hay campos y derivados que validar', () => {
    // Sin esta guarda, un export vacío o un cambio de forma del JSON haría
    // pasar todo lo de abajo por no mirar nada.
    expect(campos.length).toBeGreaterThan(50);
    expect(conDerivados.length).toBeGreaterThan(20);
  });

  it('ningún campo apunta a un derivado del build', () => {
    // El valor editable tiene que ser el original: es lo que hace la foto
    // reelegible desde la biblioteca y lo que la liga a media_usages. 15
    // campos apuntaban a `/gallery/derived/…` y se devolvieron con
    // `cms:restore-image-originals`.
    const apuntanADerivado = campos
      .filter((c) => c.value.startsWith('/gallery/derived/'))
      .map((c) => `${c.label} -> ${c.value}`);
    expect(apuntanADerivado).toEqual([]);
  });

  it('todos los archivos del srcset existen en public/', () => {
    const faltan: string[] = [];
    for (const campo of conDerivados) {
      const derived = campo.derived!;
      if (!existsSync(enDisco(derived.src))) faltan.push(`${campo.label} src -> ${derived.src}`);
      for (const [ruta] of candidatos(derived.srcset)) {
        if (!existsSync(enDisco(ruta))) faltan.push(`${campo.label} srcset -> ${ruta}`);
      }
    }
    expect(faltan).toEqual([]);
  });

  it('ningún candidato supera los 1.600 px de ancho', async () => {
    const excedidos: string[] = [];
    for (const campo of conDerivados) {
      for (const [ruta, anchoDeclarado] of candidatos(campo.derived!.srcset)) {
        if (anchoDeclarado > 1600) {
          excedidos.push(`${campo.label}: ${ruta} declara ${anchoDeclarado}w`);
          continue;
        }
        const { width } = await sharp(enDisco(ruta)).metadata();
        if ((width ?? 0) > 1600) excedidos.push(`${campo.label}: ${ruta} mide ${width} px`);
        // Y el ancho declarado en el srcset es el real, o el navegador elige mal.
        if (width !== anchoDeclarado) {
          excedidos.push(`${campo.label}: ${ruta} declara ${anchoDeclarado}w y mide ${width} px`);
        }
      }
    }
    expect(excedidos).toEqual([]);
  });

  it('derivar nunca deja la imagen más pesada que el original', () => {
    // Un PNG de pocos colores puede comprimir mejor que un WebP con pérdida:
    // `logos-clientes/dragado.png` ocupa 8 KB y su derivado de 640 px, 21 KB.
    // El export lo detecta y no emite derivados para ese campo.
    const peores: string[] = [];
    for (const campo of conDerivados) {
      const original = enDisco(campo.value);
      if (!existsSync(original)) continue;
      const pesoOriginal = statSync(original).size;
      const [menor] = candidatos(campo.derived!.srcset)[0];
      const pesoMenor = statSync(enDisco(menor)).size;
      if (pesoMenor >= pesoOriginal) {
        peores.push(
          `${campo.label}: original ${Math.round(pesoOriginal / 1024)} KB, menor candidato ${Math.round(pesoMenor / 1024)} KB`
        );
      }
    }
    expect(peores).toEqual([]);
  });

  it('los SVG no se rasterizan', () => {
    // Un vector escala solo y suele pesar menos que cualquier rasterización,
    // así que derivarlo lo empeora por los dos lados. Tres logos de cliente
    // acabaron convertidos a WebP en la primera pasada.
    const svg = campos.filter((c) => /\.svg$/i.test(c.value));
    expect(svg.length).toBeGreaterThan(0);
    expect(svg.filter((c) => c.derived).map((c) => c.label)).toEqual([]);
  });
});
