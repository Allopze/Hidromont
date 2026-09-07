import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

/**
 * Ninguna capa validaba las imágenes: ni que el archivo existiera, ni que el
 * width/height declarado fuera el del archivo. Así llegaron a producción
 * `compuertas.jpg` declarado 446×621 midiendo 225×319, y `limpiarrejas.jpg`
 * declarado 471×314 midiendo 477×615 — con la relación de aspecto invertida,
 * que deforma la imagen y provoca CLS.
 *
 * Solo se leen metadatos, no se decodifica el bitmap.
 */

const PUBLIC_DIR = path.resolve('public');

const toDiskPath = (src: string) => path.join(PUBLIC_DIR, src.replace(/^\//, ''));

// Solo assets servidos desde public/. Los de /uploads/cms viven fuera y no
// entran en dist/, así que si alguno aparece aquí es un error aparte.
const isLocalAsset = (src: unknown): src is string =>
  typeof src === 'string' && /^\/(fotos|logos-clientes|gallery|og|assets)\//.test(src);

interface ImageRef {
  label: string;
  src: string;
  width?: number;
  height?: number;
}

function collectCmsRefs(): ImageRef[] {
  const cms = JSON.parse(readFileSync('src/data/cms-content.json', 'utf8'));
  const refs: ImageRef[] = [];
  for (const [entryId, entry] of Object.entries<{ fields: Record<string, { value: unknown }> }>(
    cms.entries
  )) {
    for (const [key, field] of Object.entries(entry.fields)) {
      if (!isLocalAsset(field.value)) continue;
      // Las 4 claves de getCmsImage van juntas: image/imageWidth/imageHeight.
      const widthKey = key === 'image' ? 'imageWidth' : `${key}Width`;
      const heightKey = key === 'image' ? 'imageHeight' : `${key}Height`;
      const width = entry.fields[widthKey]?.value;
      const height = entry.fields[heightKey]?.value;
      refs.push({
        label: `${entryId}.${key}`,
        src: field.value,
        width: typeof width === 'number' ? width : undefined,
        height: typeof height === 'number' ? height : undefined,
      });
    }
  }
  return refs;
}

function collectGalleryRefs(): ImageRef[] {
  const gallery = JSON.parse(readFileSync('src/data/gallery.json', 'utf8'));
  return (gallery.items as Array<Record<string, unknown>>)
    .filter((item) => isLocalAsset(item.src))
    .map((item) => ({
      label: `gallery:${String(item.id)}`,
      src: item.src as string,
      width: typeof item.width === 'number' ? item.width : undefined,
      height: typeof item.height === 'number' ? item.height : undefined,
    }));
}

const refs = [...collectCmsRefs(), ...collectGalleryRefs()];

describe('referencias de imagen', () => {
  it('encuentra al menos una referencia que validar', () => {
    expect(refs.length).toBeGreaterThan(0);
  });

  it('todos los archivos referenciados existen en public/', () => {
    const missing = refs.filter((ref) => !existsSync(toDiskPath(ref.src)));
    expect(missing.map((ref) => `${ref.label} -> ${ref.src}`)).toEqual([]);
  });

  it('las dimensiones declaradas coinciden con el archivo', async () => {
    const mismatched: string[] = [];
    for (const ref of refs) {
      if (ref.width === undefined && ref.height === undefined) continue;
      const file = toDiskPath(ref.src);
      if (!existsSync(file)) continue; // lo cubre el test anterior
      const { width, height } = await sharp(file).metadata();
      if (
        (ref.width !== undefined && ref.width !== width) ||
        (ref.height !== undefined && ref.height !== height)
      ) {
        mismatched.push(
          `${ref.label} (${ref.src}) declara ${ref.width}×${ref.height} y mide ${width}×${height}`
        );
      }
    }
    expect(mismatched).toEqual([]);
  });
});
