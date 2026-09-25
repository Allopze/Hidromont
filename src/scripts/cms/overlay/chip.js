/**
 * La etiqueta que aparece al pasar el puntero sobre algo editable.
 *
 * Antes la única pista era un contorno y el cursor en cruz, y había que
 * adivinar qué pasaría al pulsar. La etiqueta lo dice: «Editar texto» o
 * «Cambiar imagen». Solo con puntero fino —en pantallas táctiles están las
 * guías editables— y solo con sesión iniciada, porque se engancha a
 * `[data-cms-editable-ready]`, que no existe sin sesión.
 */

import { icon } from './icons';
import { shell } from './shell';

const EDITABLE = '[data-cms-editable-ready]';

let chip = null;
let objetivo = null;

function ocultar() {
  objetivo = null;
  if (chip) chip.hidden = true;
}

function mostrar(anfitrion) {
  const entrada = anfitrion.matches('[data-cms-entry]')
    ? anfitrion
    : anfitrion.querySelector('[data-cms-entry]');
  if (!entrada) return;
  const tipo = entrada.dataset.cmsType;
  const esMedio = tipo === 'image' || tipo === 'video' || tipo === 'icono';
  const accion = { image: 'Cambiar imagen', video: 'Cambiar video', icono: 'Cambiar icono' };
  const texto = entrada.classList.contains('hm-cms-editing')
    ? 'Editando'
    : (accion[tipo] ?? 'Editar texto');
  chip.innerHTML = `${icon(esMedio ? 'image' : 'pencil', { size: 12 })}<span>${texto}</span>`;

  const caja = anfitrion.getBoundingClientRect();
  chip.hidden = false;
  const ancho = chip.offsetWidth;
  const alto = chip.offsetHeight;
  // Encima del elemento; si no cabe arriba, debajo. Nunca fuera de la ventana.
  const y = caja.top >= alto + 8 ? caja.top - alto - 6 : caja.bottom + 6;
  const x = Math.max(4, Math.min(caja.left, window.innerWidth - ancho - 4));
  chip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
}

export function registrarChip() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  chip = document.createElement('div');
  chip.className = 'hm-cms-chip';
  chip.setAttribute('aria-hidden', 'true');
  chip.hidden = true;
  shell.append(chip);

  document.addEventListener('mouseover', (event) => {
    const anfitrion = event.target instanceof Element ? event.target.closest(EDITABLE) : null;
    if (!anfitrion || anfitrion.closest('.hm-cms-shell')) {
      ocultar();
      return;
    }
    if (anfitrion === objetivo) return;
    objetivo = anfitrion;
    mostrar(anfitrion);
  });
  document.addEventListener('mouseout', (event) => {
    if (!event.relatedTarget) ocultar();
  });
  // La posición es fija en la ventana: al desplazar quedaría flotando fuera
  // de su elemento, así que se esconde hasta el próximo movimiento.
  window.addEventListener('scroll', ocultar, { passive: true, capture: true });
  window.addEventListener('resize', ocultar);
  document.addEventListener('click', ocultar, true);
}
