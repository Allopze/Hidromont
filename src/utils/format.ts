/**
 * Normaliza valores "DN" al formato del sitio: miles con punto y un solo
 * espacio tras "DN". Acepta listas y equipos mezclados:
 *   formatDN('DN 4000 / DN 2600')      -> 'DN 4.000 / DN 2.600'
 *   formatDN('Blindaje DN 4000; DN600') -> 'Blindaje DN 4.000; DN 600'
 * Los menores de 1.000 no llevan separador (DN 800).
 */
export function formatDN(value: string): string {
  return value.replace(/\b(DN)\s*(\d+(?:[.,]\d+)*)\b/gi, (_match, dn: string, num: string) => {
    const digits = num.replace(/[.,]/g, '');
    if (!/^\d+$/.test(digits)) return _match;
    const parsed = Number.parseInt(digits, 10);
    const formatted = parsed >= 1000 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;
    return `${dn.toUpperCase()} ${formatted}`;
  });
}
