import cmsContent from './cms-content.json';

type CmsField = {
  type: string;
  value: unknown;
  /**
   * Derivados responsivos que calcula el export para los campos de imagen. No
   * es contenido editable: el editor sigue viendo y eligiendo `value`, la ruta
   * original. Falta cuando la imagen es más pequeña que el ancho más bajo del
   * srcset, cuando la ruta no es un asset local o cuando sharp no pudo leerla.
   */
  derived?: {
    src: string;
    srcset: string;
    width: number;
    height: number;
  };
  /**
   * El punto de enfoque de la foto (0 a 1 en cada eje), que la persona elige
   * arrastrándola en el editor. Solo viene cuando no es el centro.
   */
  focal?: { x: number; y: number };
};

type CmsContent = {
  entries: Record<
    string,
    {
      fields: Record<string, CmsField>;
    }
  >;
};

const content = cmsContent as CmsContent;

// A3-002: en desarrollo, advierte una vez por (entryId,key) cuando una clave CMS no
// existe, para que el operador detecte claves stale/huerfanas sin logging en
// produccion. Deduplica para no spamear la consola. Una clave que existe pero esta
// vacia NO se advierte: es un borrado deliberado desde el panel, no un error.
const warnedMissing = new Set<string>();
function warnIfMissing(entryId: string, key: string, value: unknown): void {
  if (!import.meta.env.DEV) return;
  if (value !== undefined) return;
  const sig = `${entryId}.${key}`;
  if (warnedMissing.has(sig)) return;
  warnedMissing.add(sig);
  console.warn(`[cms] clave faltante: ${sig}. Usando fallback. Revisa el CMS export.`);
}

function getFieldEntry(entryId: string, key: string): CmsField | undefined {
  const field = content.entries[entryId]?.fields?.[key];
  warnIfMissing(entryId, key, field?.value);
  return field;
}

function getField(entryId: string, key: string): unknown {
  return getFieldEntry(entryId, key)?.value;
}

/**
 * Texto editable desde el CMS.
 *
 * Distingue "la clave no existe" de "la clave existe y está vacía":
 * - clave ausente (o de un tipo que no es string) → usa `fallback`, que es el
 *   texto por defecto que vive en el código.
 * - clave presente pero vacía → devuelve la cadena vacía, es decir, NO renderiza
 *   nada. Es la única forma de que vaciar un campo en el panel del CMS borre de
 *   verdad el texto del sitio; antes reaparecía el fallback y el operador no
 *   tenía manera de eliminar un rótulo sin editar el código.
 *
 * Única excepción: los campos declarados como `image`. Ahí una cadena vacía no
 * significa "sin texto" sino un `<img src="">` roto (el navegador vuelve a pedir
 * la página actual), así que siguen cayendo al fallback. La regla va por el tipo
 * declarado del campo y no por la llamada, para que también proteja a los call
 * sites que se escriban después.
 */
export function getCmsText(entryId: string, key: string, fallback: string): string {
  const field = getFieldEntry(entryId, key);
  const value = field?.value;
  if (typeof value !== 'string') return fallback;
  if (value.length === 0 && field?.type === 'image') return fallback;
  return value;
}

export function getCmsNumber(entryId: string, key: string, fallback: number): number {
  const value = getField(entryId, key);
  return typeof value === 'number' ? value : fallback;
}

export function getCmsValue<T>(entryId: string, key: string, fallback: T): T {
  const value = getField(entryId, key);
  return value === undefined ? fallback : (value as T);
}

export interface CmsImageData {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * Los derivados de un campo de imagen, si el export los calculó.
 *
 * `EditableImage` los resuelve por su cuenta a partir de `entry`/`field`, de
 * modo que cada `<img>` del sitio que salga del CMS emite `srcset` sin que el
 * llamador tenga que enterarse. Antes se pintaba la ruta tal cual: una foto de
 * 3.840 px elegida en la biblioteca viajaba entera a una tarjeta de 400 px.
 */
export function getCmsImageDerived(
  entryId: string | undefined,
  key: string
): { src: string; srcset: string; width: number; height: number } | undefined {
  if (!entryId) return undefined;
  // Sin warnIfMissing: la ausencia de derivados es normal y esperada, no un
  // aviso que el operador deba atender.
  return content.entries[entryId]?.fields?.[key]?.derived;
}

/**
 * El `object-position` que respeta el enfoque elegido para la foto de un
 * campo, o undefined si no hay (el navegador recorta al centro).
 */
export function getCmsImageObjectPosition(
  entryId: string | undefined,
  key: string
): string | undefined {
  if (!entryId) return undefined;
  return objectPositionDeEnfoque(content.entries[entryId]?.fields?.[key]?.focal);
}

/** `{ x: 0.5, y: 0.2 }` → `"50% 20%"`. Sin enfoque válido, undefined. */
export function objectPositionDeEnfoque(focal: unknown): string | undefined {
  if (!focal || typeof focal !== 'object') return undefined;
  const { x, y } = focal as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  const pct = (v: number) => `${Math.round(Math.min(1, Math.max(0, v)) * 100)}%`;
  return `${pct(x)} ${pct(y)}`;
}

export function getCmsImage(entryId: string, fallback: CmsImageData): CmsImageData {
  return {
    src: getCmsText(entryId, 'image', fallback.src),
    alt: getCmsText(entryId, 'imageAlt', fallback.alt),
    width: getCmsNumber(entryId, 'imageWidth', fallback.width),
    height: getCmsNumber(entryId, 'imageHeight', fallback.height),
  };
}
