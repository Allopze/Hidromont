/**
 * El marco de encuadre del editor de imagen: arrastrar la foto para elegir
 * qué parte se ve.
 *
 * La vista previa toma la forma del hueco que ocupa la foto en la página
 * —una tarjeta apaisada, una portada casi cuadrada— y recorta igual que el
 * sitio. Arrastrar la foto dentro del marco (o moverla con las flechas)
 * cambia el encuadre, y la página lo muestra al momento. No hay números: lo
 * que se ve en el marco es lo que verá el visitante.
 *
 * Solo se ofrece cuando la foto de verdad se recorta ahí (`object-fit:
 * cover` y proporciones distintas). Un logo, que se ve entero, no tiene nada
 * que encuadrar.
 */

import {
  arrastrar,
  CENTRO,
  conTeclado,
  esCentro,
  posicionCss,
  redondear,
  seRecorta,
} from './encuadre';
import { previsualizarEnfoque } from './edicion';

const ALTO_MAXIMO = 320;

function leerPosicion(css) {
  const [a, b] = String(css || '').split(/\s+/);
  const valor = (v) => (v && v.endsWith('%') ? parseFloat(v) / 100 : 0.5);
  return { x: valor(a), y: valor(b ?? a) };
}

/**
 * Prepara el marco del formulario para la foto de `elemento`. Devuelve un
 * control con `habilitar(bool)` y `fijar(enfoque, { inicial })`, o null si
 * en ese lugar la foto no se recorta.
 */
export function prepararEncuadre(form, elemento) {
  const marco = form.querySelector('[data-encuadre-marco]');
  const img = marco?.querySelector('img');
  const ayuda = form.querySelector('[data-encuadre-ayuda]');
  if (!marco || !img || !ayuda) return null;

  const estilo = getComputedStyle(elemento);
  const caja = elemento.getBoundingClientRect();
  if (estilo.objectFit !== 'cover' || caja.width < 40 || caja.height < 40) return null;

  // El marco copia la proporción del hueco de la página, con un alto máximo
  // para que una portada alta no ocupe todo el panel.
  const proporcion = caja.width / caja.height;
  marco.classList.add('is-encuadre');
  marco.style.aspectRatio = `${caja.width} / ${caja.height}`;
  marco.style.width = `min(100%, ${Math.round(ALTO_MAXIMO * proporcion)}px)`;

  let enfoque = leerPosicion(estilo.objectPosition);
  let habilitado = false;

  const medidas = () => ({
    ancho: marco.clientWidth,
    alto: marco.clientHeight,
    naturalAncho: img.naturalWidth,
    naturalAlto: img.naturalHeight,
  });

  const campos = () => [form.elements.focalX, form.elements.focalY];

  function pintar() {
    img.style.objectPosition = posicionCss(enfoque);
  }

  function aplicar(nuevo, { inicial = false, avisar = true } = {}) {
    enfoque = redondear(nuevo);
    pintar();
    const [x, y] = campos();
    if (x && y) {
      x.value = String(enfoque.x);
      y.value = String(enfoque.y);
      if (inicial) {
        x.dataset.inicial = x.value;
        y.dataset.inicial = y.value;
      }
    }
    if (!inicial) previsualizarEnfoque(posicionCss(enfoque));
    // El estado sucio y la copia local los gestiona el `input` delegado.
    if (avisar && !inicial) x?.dispatchEvent(new Event('input', { bubbles: true }));
    const centrar = form.querySelector('[data-action="encuadre-centrar"]');
    if (centrar) centrar.disabled = esCentro(enfoque);
  }

  function evaluar() {
    const recorta = seRecorta(medidas());
    marco.classList.toggle('is-movible', recorta && habilitado);
    ayuda.hidden = !recorta;
    marco.tabIndex = recorta && habilitado ? 0 : -1;
    const bloqueado = form.querySelector('[data-encuadre-bloqueado]');
    if (bloqueado) bloqueado.hidden = !recorta || habilitado;
  }

  // Arrastre con puntero: ratón, dedo o lápiz, con el mismo código.
  let ultimo = null;
  marco.addEventListener('pointerdown', (event) => {
    if (!marco.classList.contains('is-movible')) return;
    event.preventDefault();
    marco.setPointerCapture(event.pointerId);
    marco.classList.add('is-arrastrando');
    ultimo = { x: event.clientX, y: event.clientY };
  });
  marco.addEventListener('pointermove', (event) => {
    if (!ultimo) return;
    const dx = event.clientX - ultimo.x;
    const dy = event.clientY - ultimo.y;
    ultimo = { x: event.clientX, y: event.clientY };
    enfoque = arrastrar(enfoque, dx, dy, medidas());
    pintar();
    previsualizarEnfoque(posicionCss(enfoque));
  });
  const soltar = () => {
    if (!ultimo) return;
    ultimo = null;
    marco.classList.remove('is-arrastrando');
    aplicar(enfoque);
  };
  marco.addEventListener('pointerup', soltar);
  marco.addEventListener('pointercancel', soltar);

  marco.addEventListener('keydown', (event) => {
    if (!marco.classList.contains('is-movible')) return;
    const nuevo = conTeclado(enfoque, event.key, event.shiftKey);
    if (!nuevo) return;
    event.preventDefault();
    aplicar(nuevo);
  });

  img.addEventListener('load', evaluar);
  aplicar(enfoque, { inicial: true });
  evaluar();

  return {
    habilitar(valor) {
      habilitado = valor;
      evaluar();
    },
    fijar(nuevo, opciones = {}) {
      aplicar(nuevo ?? CENTRO, opciones);
      evaluar();
    },
    centrar() {
      aplicar(CENTRO);
    },
    actual: () => enfoque,
  };
}
