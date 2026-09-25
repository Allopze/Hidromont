import { describe, expect, it } from 'vitest';
import {
  arrastrar,
  CENTRO,
  conTeclado,
  esCentro,
  posicionCss,
  redondear,
  seRecorta,
  sobrante,
} from '../scripts/cms/overlay/encuadre';

// Una foto vertical de 1000×2000 dentro de una tarjeta de 400×200.
const VERTICAL = { ancho: 400, alto: 200, naturalAncho: 1000, naturalAlto: 2000 };

describe('encuadre', () => {
  it('sabe cuánto sobra y en qué eje', () => {
    // Escalada a 400 de ancho mide 800 de alto: sobran 600 en vertical.
    expect(sobrante(VERTICAL)).toEqual({ x: 0, y: 600 });
    expect(seRecorta(VERTICAL)).toBe(true);
    expect(seRecorta({ ancho: 400, alto: 800, naturalAncho: 1000, naturalAlto: 2000 })).toBe(false);
  });

  it('arrastrar la foto hacia abajo enseña la parte de arriba', () => {
    const e = arrastrar(CENTRO, 0, 150, VERTICAL);
    expect(e.y).toBeCloseTo(0.25);
    // En el eje que no se recorta no pasa nada.
    expect(e.x).toBe(0.5);
  });

  it('no se sale de la foto', () => {
    expect(arrastrar(CENTRO, 0, 5000, VERTICAL).y).toBe(0);
    expect(arrastrar(CENTRO, 0, -5000, VERTICAL).y).toBe(1);
  });

  it('las flechas mueven la foto como el arrastre', () => {
    expect(conTeclado(CENTRO, 'ArrowDown')).toEqual({ x: 0.5, y: 0.45 });
    expect(conTeclado(CENTRO, 'ArrowRight', true)).toEqual({ x: 0.3, y: 0.5 });
    expect(conTeclado(CENTRO, 'Enter')).toBeNull();
  });

  it('se guarda redondeado y se pinta como object-position', () => {
    expect(redondear({ x: 0.33333, y: 1.2 })).toEqual({ x: 0.33, y: 1 });
    expect(posicionCss({ x: 0.25, y: 0.6 })).toBe('25% 60%');
    expect(esCentro({ x: 0.501, y: 0.499 })).toBe(true);
    expect(esCentro({ x: 0.2, y: 0.5 })).toBe(false);
  });
});
