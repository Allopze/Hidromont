/**
 * Normaliza la notación de diámetros al formato del sitio: miles con punto y un
 * solo espacio tras el prefijo. Acepta listas y equipos mezclados:
 *   formatDiameters('Ø 4000 / Ø 2600')       -> 'Ø 4.000 / Ø 2.600'
 *   formatDiameters('Blindaje Ø4000; DN600') -> 'Blindaje Ø 4.000; DN 600'
 * Los menores de 1.000 no llevan separador (DN 800).
 *
 * Los catálogos de Hidromont usan Ø para tubería forzada, blindajes, piezas
 * especiales y estanques, y reservan DN para válvulas. Aquí se tratan igual: la
 * elección del prefijo es del contenido, esta función solo lo normaliza.
 * El signo ∅ (U+2205) que aparece en los catálogos se unifica en Ø (U+00D8).
 *
 * Una coma marca decimal en convención chilena (Ø 2,4), así que esos valores se
 * dejan intactos: reagruparlos los convertiría en otro número.
 */
export function formatDiameters(value: string): string {
  return value.replace(
    // Sin \b tras DN: hay que aceptar "DN1600" pegado, como ya hacía la versión
    // anterior. El \b inicial basta para no capturar el DN de otra palabra.
    /(\bDN|[Øø∅])\s*(\d+(?:[.,]\d+)*)/gi,
    (match, prefix: string, num: string) => {
      if (num.includes(',')) return match;
      const digits = num.replace(/\./g, '');
      if (!/^\d+$/.test(digits)) return match;
      const normalizedPrefix = /dn/i.test(prefix) ? 'DN' : 'Ø';
      const parsed = Number.parseInt(digits, 10);
      const formatted = parsed >= 1000 ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : digits;
      return `${normalizedPrefix} ${formatted}`;
    }
  );
}
