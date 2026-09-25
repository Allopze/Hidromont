/**
 * Qué forma tiene una lista y cómo se edita, sin DOM.
 *
 * Hasta sep-2026 el panel solo sabía editar listas de textos: `procesos` de los
 * servicios —una lista de grupos `{ titulo, descripcion }`— se pintaba con
 * `String(item)` y salía como «[object Object]». Tocar un elemento y guardar
 * reemplazaba los procesos por esa cadena. Aquí se decide la forma antes de
 * pintar nada, y lo que no se sabe editar sin riesgo queda fijo en vez de
 * degradarse.
 */

export type FormaDeLista = 'textos' | 'grupos' | 'fija';
export type TipoDeClave = 'text' | 'number' | 'boolean';

type Primitivo = string | number | boolean | null;

/**
 * Listas de grupos que el sitio declara aunque la entrada aún no tenga
 * ninguno: sin esto, agregar el primer proceso a un servicio vacío crearía un
 * texto donde el schema de Astro espera un grupo, y la publicación fallaría.
 */
const GRUPOS_CONOCIDOS: Record<string, string[]> = {
  procesos: ['titulo', 'descripcion'],
};

const ETIQUETAS: Record<string, string> = {
  titulo: 'Título',
  descripcion: 'Descripción',
  nombre: 'Nombre',
  texto: 'Texto',
  resumen: 'Resumen',
  detalle: 'Detalle',
  label: 'Texto',
  href: 'Enlace',
  src: 'Imagen',
  alt: 'Texto alternativo',
  valor: 'Valor',
};

const CLAVES_LARGAS = new Set(['descripcion', 'texto', 'resumen', 'detalle']);

function esPrimitivo(valor: unknown): valor is Primitivo {
  return (
    valor === null ||
    typeof valor === 'string' ||
    typeof valor === 'number' ||
    typeof valor === 'boolean'
  );
}

function esGrupoEditable(valor: unknown): valor is Record<string, Primitivo> {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    !Array.isArray(valor) &&
    Object.values(valor).every(esPrimitivo)
  );
}

export function formaDeLista(items: unknown[], clave = ''): FormaDeLista {
  if (items.length === 0) return GRUPOS_CONOCIDOS[clave] ? 'grupos' : 'textos';
  if (items.every((item) => typeof item === 'string' || typeof item === 'number')) {
    return 'textos';
  }
  if (items.every(esGrupoEditable)) return 'grupos';
  // Mezclas de textos y grupos, o grupos con listas dentro: no hay una forma de
  // editarlas que no pueda perder datos, así que se muestran y se conservan.
  return 'fija';
}

/** Las claves de los grupos, en el orden en que aparecen por primera vez. */
export function clavesDeGrupos(items: unknown[], clave = ''): string[] {
  const claves: string[] = [];
  for (const item of items) {
    if (!esGrupoEditable(item)) continue;
    for (const k of Object.keys(item)) if (!claves.includes(k)) claves.push(k);
  }
  if (claves.length) return claves;
  return GRUPOS_CONOCIDOS[clave] ?? ['texto'];
}

/** El tipo de cada clave, para devolver un número como número al guardar. */
export function tiposDeClaves(items: unknown[], claves: string[]): Record<string, TipoDeClave> {
  const tipos: Record<string, TipoDeClave> = {};
  for (const k of claves) {
    const valores = items
      .filter(esGrupoEditable)
      .map((item) => item[k])
      .filter((v) => v !== null && v !== undefined);
    if (valores.length && valores.every((v) => typeof v === 'number')) tipos[k] = 'number';
    else if (valores.length && valores.every((v) => typeof v === 'boolean')) tipos[k] = 'boolean';
    else tipos[k] = 'text';
  }
  return tipos;
}

export function etiquetaDeClave(clave: string): string {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave];
  const legible = clave.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return legible.charAt(0).toUpperCase() + legible.slice(1).toLowerCase();
}

/** ¿Se escribe en varias líneas? Por nombre o porque ya trae texto largo. */
export function esClaveLarga(items: unknown[], clave: string): boolean {
  if (CLAVES_LARGAS.has(clave)) return true;
  return items.some(
    (item) =>
      esGrupoEditable(item) && typeof item[clave] === 'string' && String(item[clave]).length > 60
  );
}

/** Convierte lo que devuelve un control al tipo original de la clave. */
export function convertirValor(tipo: TipoDeClave, bruto: string | boolean): Primitivo {
  if (tipo === 'boolean') return Boolean(bruto);
  if (tipo === 'number') {
    if (bruto === '' || typeof bruto === 'boolean') return null;
    const numero = Number(bruto);
    return Number.isFinite(numero) ? numero : null;
  }
  return String(bruto);
}

/** Un grupo vacío con las mismas claves que el resto. */
export function grupoVacio(
  claves: string[],
  tipos: Record<string, TipoDeClave>
): Record<string, Primitivo> {
  return Object.fromEntries(
    claves.map((k) => [k, tipos[k] === 'boolean' ? false : tipos[k] === 'number' ? null : ''])
  );
}
