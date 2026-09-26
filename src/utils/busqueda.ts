/**
 * P2-30 (auditoría 2026-09): el buscador de /proyectos normalizaba el índice
 * y la consulta de forma distinta. «Ø 1.600» daba 3 resultados, pero «1600» y
 * «ø1600» ninguno; «C.H. Ralco» uno y «CH Ralco» ninguno.
 *
 * Una sola función para los dos lados: minúsculas, sin tildes, sin el símbolo
 * de diámetro, sin puntos de miles ni puntuación, y espacios colapsados.
 */
export function normalizarBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[øØ⌀∅]/g, ' ')
    .replace(/(\d)[.,](?=\d{3}(\D|$))/g, '$1')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿Contiene `indice` todas las palabras de la consulta, en cualquier orden? */
export function coincide(indice: string, consulta: string): boolean {
  if (!consulta) return true;
  return consulta.split(' ').every((palabra) => indice.includes(palabra));
}
