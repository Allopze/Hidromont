/**
 * Tiempos en palabras: «hace 5 minutos», «tardó 1 min 12 s». Sin DOM.
 *
 * El historial y la barra mostraban fechas como «09-09-26, 8:40 p. m. -
 * 09-09-26, 8:40 p. m.»: exactas, pero hay que hacer la cuenta para saber si
 * el sitio se publicó hoy o hace dos semanas.
 */

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export function haceCuanto(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '';
  const ms = ahora - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  if (ms < MINUTO) return 'hace un momento';
  if (ms < HORA) {
    const n = Math.floor(ms / MINUTO);
    return `hace ${n} ${n === 1 ? 'minuto' : 'minutos'}`;
  }
  if (ms < DIA) {
    const n = Math.floor(ms / HORA);
    return `hace ${n} ${n === 1 ? 'hora' : 'horas'}`;
  }
  const n = Math.floor(ms / DIA);
  if (n === 1) return 'ayer';
  return `hace ${n} días`;
}

export function duracion(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const segundos = Math.round(ms / 1000);
  if (segundos < 60) return `${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return resto ? `${minutos} min ${resto} s` : `${minutos} min`;
}

/** Reloj de un proceso en marcha: «0:07», «1:12». */
export function reloj(ms: number): string {
  const segundos = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}
