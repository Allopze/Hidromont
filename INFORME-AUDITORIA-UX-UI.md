# Informe de auditoría UX/UI — Hidromont Chile

- **Fecha de auditoría:** 21 de septiembre de 2026
- **Veredicto de la auditoría base:** **Necesita mejoras**
- **Estado de fixes:** implementados; build y revalidación visual local completados.
- **Alcance:** páginas públicas, navegación, contacto, búsqueda/filtros, accesibilidad y adaptación móvil. Revisión estática de componentes y fuentes más inspección de capturas del repositorio.

## Resumen

La interfaz mantiene una jerarquía visual consistente y presenta bien los servicios y proyectos. El formulario tiene etiquetas y estados de envío, y hay varios controles de 44 px, foco visible y soporte para movimiento reducido. La revisión encontró brechas de recuperación, navegación móvil y estado accesible; los fixes correspondientes están detallados abajo.

No encontré bloqueos P1. Los cinco hallazgos P2 y los cuatro P3 quedaron implementados en el código; la build y la revalidación visual local terminaron correctamente.

## Hallazgos priorizados

Las referencias de línea en este bloque corresponden a la versión auditada inicialmente; algunos números se desplazaron con las correcciones. El estado actual de cada arreglo está resumido en “Seguimiento de correcciones”.

### P2 — El menú móvil no ofrece un enlace a “Todos los servicios”

**Evidencia:** [Header.astro](src/components/layout/Header.astro#L222-L257) representa “Servicios” como un `<summary>` desplegable y solo incluye enlaces a las ocho subcategorías. El destino `/servicios` está definido en [nav.ts](src/data/nav.ts#L48-L52), pero no se enlaza desde ese menú. Las capturas móviles muestran el menú compacto como navegación principal.

**Impacto:** quien busque una vista general de servicios no puede llegar a ella desde la navegación móvil; debe conocer el enlace o usar el CTA de inicio.

**Heurística:** consistencia y reconocimiento; ergonomía móvil.

**Recomendación:** añadir un enlace visible “Todos los servicios” dentro del desplegable, o presentar por separado el enlace a `/servicios` y el control que expande las subcategorías.

### P2 — La búsqueda de proyectos puede terminar en una página aparentemente vacía

**Evidencia:** en [proyectos/index.astro](src/pages/proyectos/index.astro#L173-L190), los grupos y la acción “Ver más” se ocultan cuando no quedan coincidencias. El único contador es `sr-only` ([líneas 230–263](src/pages/proyectos/index.astro#L230-L263)); no hay estado vacío visible ni acción para limpiar la búsqueda.

**Impacto:** tras un término o filtro sin resultados, una persona puede pensar que el banco está roto y no sabrá cómo recuperarse.

**Heurística:** visibilidad del estado del sistema y recuperación de errores.

**Recomendación:** mostrar “No encontramos proyectos con estos criterios” y un botón “Limpiar búsqueda y filtros”. La galería ya tiene un patrón de estado vacío que se puede reutilizar ([galeria/index.astro](src/pages/galeria/index.astro#L268-L277)).

### P2 — Los envíos fallidos consumen el límite local del formulario

**Evidencia:** [ContactForm.astro](src/components/contact/ContactForm.astro#L404-L410) bloquea al llegar a tres intentos por cinco minutos. El contador se guarda antes de `fetch` ([líneas 427–431](src/components/contact/ContactForm.astro#L427-L431)); si falla la red o el proveedor rechaza la solicitud, ese intento no se revierte ([líneas 450–479](src/components/contact/ContactForm.astro#L450-L479)).

**Impacto:** tres errores temporales pueden impedir un envío válido durante varios minutos. El mensaje de error devuelve el control, pero no aporta una vía inmediata para contactar.

**Heurística:** control del usuario y recuperación de errores.

**Recomendación:** dejar el límite de abuso principalmente al servidor; en el contador del cliente registrar solo solicitudes aceptadas o retirar el registro si falla el transporte. Añadir un enlace `mailto:` al aviso y conservar el formulario editable.

### P2 — Un video de servicio se reproduce en bucle sin control de pausa

**Evidencia:** [PageHero.astro](src/components/ui/PageHero.astro#L155-L172) configura el video con `autoplay`, `loop` y `muted`, sin controles ni pausa propia. Se usa en la página Limpiarrejas ([servicios/[slug].astro](src/pages/servicios/%5Bslug%5D.astro#L37)). El video se oculta con `prefers-reduced-motion`, pero el resto de usuarios no dispone de control ([PageHero.astro](src/components/ui/PageHero.astro#L312-L325)).

**Impacto:** el movimiento continuo puede distraer y no se puede detener, lo que afecta lectura, concentración y personas sensibles al movimiento.

**Heurística / criterio:** control y libertad; WCAG 2.2.2 (Pausar, detener, ocultar).

**Recomendación:** ofrecer un control accesible de pausa/reanudación, o reproducir el video solo tras una acción explícita. Mantener el póster como alternativa.

### P2 — El submenú desktop se ve abierto mientras `aria-expanded` anuncia “cerrado”

**Evidencia:** CSS abre el panel al pasar el puntero o enfocar el grupo ([Header.astro](src/components/layout/Header.astro#L286-L297)); el script solo sincroniza `aria-expanded` cuando se activa el botón ([Header.astro](src/components/layout/Header.astro#L314-L343)).

**Impacto:** el estado visual y el anunciado por tecnología de asistencia pueden diferir; esto dificulta entender y operar la navegación con teclado o lector de pantalla.

**Heurística / criterio:** visibilidad del estado; WCAG 4.1.2 (Nombre, función, valor).

**Recomendación:** usar una única lógica de apertura para puntero, teclado y botón, o sincronizar `aria-expanded` con el estado visible del panel en todos los casos.

### P3 — Algunos controles móviles quedan por debajo de 44 px

**Evidencia:** búsqueda y desplegable de categoría de la galería usan texto `xs` y `py-2.5` ([galeria/index.astro](src/pages/galeria/index.astro#L130-L139), [líneas 177–184](src/pages/galeria/index.astro#L177-L184)); las opciones repiten el patrón ([líneas 207–217](src/pages/galeria/index.astro#L207-L217)). Los enlaces de subservicios del menú móvil también usan `py-2` y no declaran altura mínima ([Header.astro](src/components/layout/Header.astro#L245-L254)).

**Impacto:** aumenta los toques fallidos en una tarea frecuente, especialmente en pantallas pequeñas.

**Criterio:** ergonomía táctil móvil; prevención de errores.

**Recomendación:** dar a los controles una altura mínima de 44 px con área de toque completa, manteniendo el tamaño visual del texto.

### P3 — La validación del formulario depende de JavaScript aunque existe envío HTML alternativo

**Evidencia:** el formulario declara `novalidate` ([ContactForm.astro](src/components/contact/ContactForm.astro#L76-L83)); la validación personalizada se instala en el script ([líneas 321–379](src/components/contact/ContactForm.astro#L321-L379)).

**Impacto:** si JavaScript no carga o está deshabilitado, `required` y el tipo de correo no detendrán un envío incompleto antes de enviarlo.

**Heurística:** prevención de errores y recuperación.

**Recomendación:** conservar la validación HTML por defecto y habilitar `novalidate` solo después de inicializar la validación personalizada; validar también en el servidor.

### P3 — El estado de página actual solo se comunica mediante estilo

**Evidencia:** [Header.astro](src/components/layout/Header.astro#L31-L34) calcula qué ruta está activa y aplica clases visuales a los enlaces ([líneas 159–171](src/components/layout/Header.astro#L159-L171)); esos enlaces no reciben `aria-current="page"`.

**Impacto:** lectores de pantalla no reciben la misma señal de ubicación actual que las personas que ven el subrayado o el color.

**Criterio:** orientación y semántica accesible.

**Recomendación:** añadir `aria-current="page"` al enlace de la ruta exacta, distinguiendo la página actual de sus rutas hijas.

### P3 — Las capturas archivadas muestran el mapa en blanco en móvil y en el pie de inicio

**Evidencia visual:** [Contacto móvil](screenshots/mobile/public/contacto.png) muestra un bloque vacío alto donde debería aparecer el mapa. También se ve un bloque vacío en el pie de [Inicio desktop](screenshots/desktop/public/index.png). La tarjeta conserva la dirección y, en contacto, el enlace “Abrir en Google Maps” ([LocationCard.astro](src/components/contact/LocationCard.astro#L34-L40), [líneas 43–75](src/components/contact/LocationCard.astro#L43-L75)).

**Impacto:** se desaprovecha una zona considerable de pantalla y la vista previa no ayuda a identificar la ubicación. La dirección y el enlace reducen la severidad.

**Heurística:** visibilidad del estado y ayuda para completar la tarea.

**Recomendación:** confirmar el comportamiento del iframe en producción móvil. Si no carga, mostrar una imagen estática o un estado alternativo compacto y mantener visible la dirección y la acción de abrir el mapa.

## Seguimiento de correcciones

Los nueve hallazgos de la auditoría base ya tienen cambios asociados:

- **Navegación:** el menú móvil incluye “Todos los servicios” y sus controles tienen área táctil mínima de 44 px; las rutas exactas actuales usan `aria-current="page"`; el dropdown desktop refleja en `aria-expanded` el estado visual al usar puntero, teclado o clic. Sin JavaScript, los subservicios quedan visibles como lista.
- **Proyectos:** se muestra un estado vacío con una acción para limpiar filtros y devolver el foco a búsqueda; el estado se anuncia como `status`.
- **Contacto:** fallos de red o de proveedor ya no consumen el límite local; hay protección contra doble envío, enlace de correo en el aviso y validación nativa si el script no carga.
- **Galería:** campo, desplegable, opciones, botón de limpiar y tarjetas tienen área táctil mínima de 44 px.
- **Video:** Limpiarrejas incorpora control accesible de pausa/reproducción, oculto cuando está activa la preferencia de movimiento reducido.
- **Ubicación:** contacto mantiene el mapa incrustado en desktop y muestra un panel local con ubicación en móvil; el pie usa siempre el panel local y un enlace a Maps para evitar áreas vacías dependientes del iframe. La tarjeta móvil de contacto es más compacta. Los títulos de ambas tarjetas ahora tienen identificadores únicos.

La build local con `npm run build` terminó correctamente: Astro Check reportó 0 errores y 0 advertencias; Astro generó 27 páginas. No ejecuté la suite de tests. La revalidación visual se hizo con Playwright sobre la vista previa del build y cubrió las páginas indicadas abajo y sus estados interactivos; no representa una comprobación del sitio en producción.

### Evidencia de revalidación

Las capturas posteriores a los fixes están en [screenshots/revalidacion-ux-ui-2026-09-21](screenshots/revalidacion-ux-ui-2026-09-21). Las rutas capturadas respondieron HTTP 200.

- [Inicio — desktop](screenshots/revalidacion-ux-ui-2026-09-21/inicio-desktop.png) · [móvil](screenshots/revalidacion-ux-ui-2026-09-21/inicio-mobile.png)
- [Proyectos — desktop](screenshots/revalidacion-ux-ui-2026-09-21/proyectos-desktop.png) · [móvil](screenshots/revalidacion-ux-ui-2026-09-21/proyectos-mobile.png)
- [Sin resultados — proyectos, móvil](screenshots/revalidacion-ux-ui-2026-09-21/proyectos-sin-resultados-mobile.png) · [limpieza de filtros](screenshots/revalidacion-ux-ui-2026-09-21/proyectos-restablecidos-mobile.png)
- [Contacto — desktop, mapa cargado](screenshots/revalidacion-ux-ui-2026-09-21/contacto-desktop.png) · [móvil](screenshots/revalidacion-ux-ui-2026-09-21/contacto-mobile.png)
- [Galería — móvil](screenshots/revalidacion-ux-ui-2026-09-21/galeria-mobile.png) · [estado sin resultados](screenshots/revalidacion-ux-ui-2026-09-21/galeria-sin-resultados-mobile.png)
- [Servicios — desktop](screenshots/revalidacion-ux-ui-2026-09-21/servicio-limpiarrejas-desktop.png) · [móvil](screenshots/revalidacion-ux-ui-2026-09-21/servicio-limpiarrejas-mobile.png) · [video pausado](screenshots/revalidacion-ux-ui-2026-09-21/video-pausado-desktop.png)
- [Menú móvil abierto](screenshots/revalidacion-ux-ui-2026-09-21/menu-movil-servicios-abierto.png) · [menú desktop abierto](screenshots/revalidacion-ux-ui-2026-09-21/menu-desktop-servicios-abierto.png)

También se comprobó que el estado vacío de proyectos queda en pantalla y que el botón restablece búsqueda/filtros en desktop y móvil; el enlace “Todos los servicios” aparece en el menú móvil; el dropdown desktop sincroniza apertura por puntero/clic y cierre con Escape; y el control del video pausa y reanuda actualizando su etiqueta accesible. El iframe de Google Maps carga en la captura desktop al activar su carga diferida antes de capturar.

## Capturas revisadas

- [Inicio — desktop](screenshots/desktop/public/index.png) · [Inicio — móvil](screenshots/mobile/public/index.png)
- [Servicios — desktop](screenshots/desktop/public/servicios.png) · [Servicios — móvil](screenshots/mobile/public/servicios.png)
- [Proyectos — desktop](screenshots/desktop/public/proyectos.png) · [Proyectos — móvil](screenshots/mobile/public/proyectos.png)
- [Contacto — desktop](screenshots/desktop/public/contacto.png) · [Contacto — móvil](screenshots/mobile/public/contacto.png)

Las capturas originales del repositorio tienen fecha de modificación **7 de septiembre de 2026** y se conservan como evidencia archivada. Las nuevas capturas corresponden al build local actual, no al dominio publicado. El detalle de rutas y estados validados está en [resumen.txt](screenshots/revalidacion-ux-ui-2026-09-21/resumen.txt).

## Aspectos que ya funcionan bien

- El formulario tiene etiquetas asociadas, campos obligatorios marcados, mensajes de estado y un flujo de éxito accesible.
- La navegación y los botones muestran estilos de foco; la página incluye skip link y landmarks.
- Los filtros de proyectos y el botón “Ver más” ya tienen objetivos de al menos 44 px.
- La galería cuenta con búsqueda vacía visible, contador accesible y control para limpiar la búsqueda.
- El movimiento reducido está considerado en animaciones y en el video de servicio.
