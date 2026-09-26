/**
 * P3-06 (auditoría 2026-09): recorta una description a lo que muestran los
 * buscadores (≈155 caracteres). Corta por la última frase completa que quepa;
 * si la primera frase ya es demasiado larga, por la última palabra, con «…».
 */
export function resumirDescripcion(texto: string, maximo = 155): string {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (limpio.length <= maximo) return limpio;
  const trozo = limpio.slice(0, maximo);
  const finDeFrase = Math.max(trozo.lastIndexOf('. '), trozo.lastIndexOf('; '));
  if (finDeFrase >= 80) return trozo.slice(0, finDeFrase + 1).trim();
  const espacio = trozo.slice(0, maximo - 1).lastIndexOf(' ');
  return `${trozo.slice(0, espacio > 0 ? espacio : maximo - 1).replace(/[,;:.\s]+$/, '')}…`;
}
