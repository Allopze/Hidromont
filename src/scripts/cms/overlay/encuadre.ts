/**
 * El encuadre de una foto recortada, sin DOM.
 *
 * El sitio muestra muchas fotos con `object-fit: cover`: la foto se escala
 * hasta llenar su recuadro y lo que sobra se corta. `object-position` decide
 * qué parte sobra, y es lo que guarda el «punto de enfoque» (focalX/focalY,
 * de 0 a 1). Aquí se traduce un arrastre en píxeles a ese punto: quien edita
 * mueve la foto dentro del recuadro, como al acomodar una foto de portada, y
 * nunca ve un número.
 */

export interface Enfoque {
  x: number;
  y: number;
}

export interface Medidas {
  /** El recuadro donde se ve la foto, en píxeles de pantalla. */
  ancho: number;
  alto: number;
  /** El tamaño real de la foto. */
  naturalAncho: number;
  naturalAlto: number;
}

export const CENTRO: Enfoque = { x: 0.5, y: 0.5 };

const limitar = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Cuánto sobra de la foto en cada eje una vez escalada para cubrir el
 * recuadro. En el eje que encaja justo sobra 0: ahí no hay nada que mover.
 */
export function sobrante(m: Medidas): { x: number; y: number } {
  if (!m.ancho || !m.alto || !m.naturalAncho || !m.naturalAlto) return { x: 0, y: 0 };
  const escala = Math.max(m.ancho / m.naturalAncho, m.alto / m.naturalAlto);
  return {
    x: Math.max(0, m.naturalAncho * escala - m.ancho),
    y: Math.max(0, m.naturalAlto * escala - m.alto),
  };
}

/** ¿Se recorta la foto? Con menos de 2 px sobrantes no merece ofrecerlo. */
export function seRecorta(m: Medidas): boolean {
  const s = sobrante(m);
  return s.x >= 2 || s.y >= 2;
}

/**
 * Mueve el encuadre según un arrastre. Arrastrar la foto hacia la derecha
 * enseña lo que había a su izquierda, así que el punto va en sentido
 * contrario al dedo.
 */
export function arrastrar(actual: Enfoque, dx: number, dy: number, m: Medidas): Enfoque {
  const s = sobrante(m);
  return {
    x: s.x ? limitar(actual.x - dx / s.x) : actual.x,
    y: s.y ? limitar(actual.y - dy / s.y) : actual.y,
  };
}

/** Flechas del teclado: un 5 % por pulsación, un 20 % con Mayúsculas. */
export function conTeclado(actual: Enfoque, tecla: string, grande = false): Enfoque | null {
  const paso = grande ? 0.2 : 0.05;
  // Como al arrastrar: la flecha mueve la foto, no el punto.
  const mov: Record<string, [number, number]> = {
    ArrowLeft: [paso, 0],
    ArrowRight: [-paso, 0],
    ArrowUp: [0, paso],
    ArrowDown: [0, -paso],
  };
  const d = mov[tecla];
  if (!d) return null;
  return { x: limitar(actual.x + d[0]), y: limitar(actual.y + d[1]) };
}

/** Redondeado a centésimas: lo que se guarda y lo que se compara. */
export function redondear(e: Enfoque): Enfoque {
  return { x: Math.round(limitar(e.x) * 100) / 100, y: Math.round(limitar(e.y) * 100) / 100 };
}

export function esCentro(e: Enfoque | null | undefined): boolean {
  if (!e) return true;
  const r = redondear(e);
  return r.x === 0.5 && r.y === 0.5;
}

/** El valor CSS de `object-position`. */
export function posicionCss(e: Enfoque): string {
  const r = redondear(e);
  return `${Math.round(r.x * 100)}% ${Math.round(r.y * 100)}%`;
}
