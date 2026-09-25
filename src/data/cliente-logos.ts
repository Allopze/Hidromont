import { getCmsText, getCmsValue } from './cms';

/**
 * A3-003: fuente única de verdad para los logos de clientes.
 *
 * Antes, los 18 paths de logos estaban duplicados entre
 * `src/content/clientes/clientes.json` (content collection, campo `logo`) y un
 * `logoMap` hardcoded aquí. Ahora el path canónico vive en `clientes.json` y esta
 * función es un helper fino que aplica la capa de override del CMS:
 *
 *   getClienteLogoByNombre(c.nombre, c.logo)
 *     → devuelve el valor CMS si existe y no está vacío, si no el path de la
 *       colección (`c.logo`), si no '' .
 *
 * La clave CMS se derive del nombre del cliente con el mismo slugify que usa la UI
 * (lowercase, sin acentos, separadores `-`). Esto preserva la editabilidad via el
 * overlay (`EditableImage field={`logo-${logoKey}`}`) sin duplicar datos.
 */
export function logoKeyFor(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Devuelve el path del logo para un cliente, permitiendo override via CMS.
 *
 * @param nombre   Nombre del cliente (igual a `clientes.json` `nombre`).
 * @param fallback Path del logo desde la content collection (`c.logo`). Requerido
 *                 para que no haya duplicación: la fuente canónica es la colección.
 */
export function getClienteLogoByNombre(nombre: string, fallback = ''): string {
  return getCmsText('clientes.logos', `logo-${logoKeyFor(nombre)}`, fallback);
}

export interface ClienteItem {
  nombre: string;
  sector?: string;
  logo?: string;
}

/**
 * Los clientes que pinta el sitio, en el orden de la lista del CMS
 * (`clientes.lista.nombres`, editable desde /clientes).
 *
 * Antes la lista solo vivía en `src/content/clientes/clientes.json`: añadir o
 * quitar un cliente exigía tocar el código. El archivo queda como respaldo
 * —si el CMS no tiene la lista, se usa tal cual— y como fuente del logo por
 * defecto de cada nombre que ya estaba en él.
 */
export function listaDeClientes(coleccion: ClienteItem[]): ClienteItem[] {
  const nombres = getCmsValue<unknown>('clientes.lista', 'nombres', undefined);
  if (!Array.isArray(nombres)) return coleccion;
  const porNombre = new Map(coleccion.map((c) => [c.nombre, c]));
  return nombres
    .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
    .map((n) => porNombre.get(n.trim()) ?? { nombre: n.trim() });
}
