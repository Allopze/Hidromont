/**
 * La forma de un campo no puede cambiar por accidente al guardarlo.
 *
 * `procesos` de los servicios es una lista de grupos —`{ titulo, descripcion }`—
 * y el formulario de colección la pintaba con `String(item)`: cada grupo se veía
 * como «[object Object]» y, si el editor tocaba uno, el panel mandaba esa cadena
 * de vuelta y los cuatro procesos quedaban reemplazados por texto basura. El
 * servidor lo aceptaba porque solo comprobaba que llegara un array.
 *
 * El panel ya pinta esas listas como grupos, pero la garantía tiene que vivir
 * aquí: cualquier otro camino (un overlay viejo en caché, un script, un fallo
 * futuro) chocaría con la misma puerta abierta.
 */

const OBJETO_SERIALIZADO = '[object Object]';

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/**
 * «[object Object]» es lo que produce `String()` sobre un objeto. En el
 * contenido de este sitio no aparece nunca por voluntad del editor: si llega,
 * es que un cliente convirtió un objeto en texto por el camino.
 */
function contieneObjetoSerializado(valor: unknown): boolean {
  if (typeof valor === 'string') return valor.includes(OBJETO_SERIALIZADO);
  if (Array.isArray(valor)) return valor.some(contieneObjetoSerializado);
  if (esObjetoPlano(valor)) return Object.values(valor).some(contieneObjetoSerializado);
  return false;
}

/**
 * Devuelve el motivo para rechazar el guardado, o `null` si la forma es válida.
 *
 * @param nombre El nombre legible del campo: el mensaje lo lee el editor.
 * @param actual El valor guardado ahora.
 * @param nuevo El valor que se quiere guardar.
 */
export function problemaDeForma(nombre: string, actual: unknown, nuevo: unknown): string | null {
  const dañado = `No se guardó «${nombre}»: llegó un valor dañado. Recarga la página e inténtalo de nuevo; si se repite, avisa a quien administra el CMS.`;

  if (contieneObjetoSerializado(nuevo)) return dañado;

  // Una lista de grupos solo admite grupos. Vaciarla sigue permitido.
  if (
    Array.isArray(actual) &&
    actual.length > 0 &&
    actual.every(esObjetoPlano) &&
    Array.isArray(nuevo) &&
    !nuevo.every(esObjetoPlano)
  ) {
    return dañado;
  }

  return null;
}
