import { describe, expect, it } from 'vitest';
import { duracion, haceCuanto, reloj } from '../scripts/cms/overlay/tiempo';

const AHORA = new Date('2026-09-24T12:00:00.000Z').getTime();
const antes = (ms: number) => new Date(AHORA - ms).toISOString();

describe('haceCuanto', () => {
  it('dice el tiempo en palabras', () => {
    expect(haceCuanto(antes(20_000), AHORA)).toBe('hace un momento');
    expect(haceCuanto(antes(60_000), AHORA)).toBe('hace 1 minuto');
    expect(haceCuanto(antes(5 * 60_000), AHORA)).toBe('hace 5 minutos');
    expect(haceCuanto(antes(2 * 3_600_000), AHORA)).toBe('hace 2 horas');
    expect(haceCuanto(antes(30 * 3_600_000), AHORA)).toBe('ayer');
    expect(haceCuanto(antes(15 * 86_400_000), AHORA)).toBe('hace 15 días');
  });

  it('no inventa nada sin fecha', () => {
    expect(haceCuanto(null, AHORA)).toBe('');
    expect(haceCuanto('no es fecha', AHORA)).toBe('');
  });
});

describe('duracion y reloj', () => {
  it('cuentan segundos y minutos', () => {
    expect(duracion(45_000)).toBe('45 s');
    expect(duracion(72_000)).toBe('1 min 12 s');
    expect(duracion(120_000)).toBe('2 min');
    expect(reloj(7_000)).toBe('0:07');
    expect(reloj(72_000)).toBe('1:12');
  });
});
