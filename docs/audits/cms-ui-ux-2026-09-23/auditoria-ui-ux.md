# Auditoría UI/UX — Hidromont CMS

**Fecha:** 23 de septiembre de 2026
**Resultado:** **HOLD** para uso editorial diario hasta resolver los hallazgos P1.
**Alcance:** CMS local, escritorio a 1440 × 1000 y móvil a 390 × 844; contenido, colecciones, galería, selector de medios, historial y administración.

## Lente de producto y contrato de diseño

La persona editora mantiene el sitio Hidromont: ajusta textos e imágenes en contexto, ordena páginas, servicios y proyectos, administra la galería y decide cuándo publicar. El primer elemento que debe entender es el contenido que está editando y su estado. Guardar una edición y publicar el sitio son decisiones distintas. La interfaz funciona como un editor visual sobre el sitio más paneles de gestión; conviene conservar esa relación directa con la marca y evitar convertirla en un dashboard genérico.

| Decisión             | Contrato                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Usuario y tarea      | Editora o administrador del sitio; modificar contenido y llevarlo a publicación.                      |
| Primer objeto        | Campo o activo seleccionado, con su estado actual.                                                    |
| Acción principal     | Guardar el cambio. Publicar queda como acción global explícita.                                       |
| Densidad             | Balanceada en formularios; compacta y buscable en listas grandes de contenido y medios.               |
| Jerarquía            | Contexto y nombre legible → campo/activo → guardar → herramientas auxiliares → estado de publicación. |
| Interacción          | Edición visual en contexto, formularios de colección y biblioteca visual.                             |
| Prioridad responsive | Panel de pantalla completa en móvil, controles alcanzables y sin scroll horizontal.                   |
| Defaults a evitar    | Dashboard con métricas decorativas, tarjetas genéricas o más datos técnicos en primera lectura.       |

## Hallazgos prioritarios

### P1 — La biblioteca local contiene registros que parecen datos de prueba

En la base local visible durante la revisión aparecen categorías con nombres como “Prueba…” y “Accesible…”. El selector de medios también muestra miniaturas verdes con nombres e2e-synthetic-test. Esos registros compiten con contenido editorial real y hacen más fácil escoger o mantener un activo accidental.

**Evidencia:** [categorías](capturas/10-categorias.png), [selector de medios](capturas/16-selector-medios.png). Esto describe la base local observada; no confirma que los mismos registros estén en producción.

**Cambio requerido:** aislar las pruebas E2E en una base y carpeta de uploads desechables; retirar los registros de prueba de la base destinada a edición.

**Verificar:** volver a ejecutar las pruebas y confirmar que no agregan categorías ni archivos a la biblioteca editorial; comprobar que las filas visibles corresponden a contenido real.

### P1 — Categorías y álbumes no se pueden buscar

La galería muestra 81 categorías y 23 álbumes. La lista de imágenes sí tiene buscador y filtros, pero las pantallas de categorías y álbumes obligan a recorrer filas para encontrar una entrada.

**Evidencia:** [categorías](capturas/10-categorias.png), [álbumes](capturas/12-albumes.png), [imágenes](capturas/14-imagenes.png).

**Cambio requerido:** añadir búsqueda por nombre y slug a categorías y álbumes, con el total visible y resultados filtrados. Mantener acciones de edición asociadas a la fila correspondiente.

**Verificar:** localizar una categoría y un álbum por nombre y slug, usando teclado, en listas de tamaño real a 1440 px y 390 px; confirmar que los resultados no dependen de desplazarse por toda la lista.

### P2 — Las acciones del editor de campo quedan partidas sin jerarquía clara

En el editor de texto, Guardar, Vaciar este texto y Exportar comparten una fila; Revisiones queda sola en la siguiente. En un panel de 420 px, esta segunda fila parece un quiebre accidental y la acción destructiva comparte el grupo visual con tareas reversibles.

**Evidencia:** [editor de campo](capturas/16-editor-campo-texto.png).

**Cambio requerido:** mantener Guardar como acción principal; agrupar Revisiones y Exportar como acciones secundarias en una posición estable. Separar Vaciar del resto y darle un estilo destructivo visible.

**Verificar:** revisar el editor a 420 px de ancho de panel y a 390 px de viewport. Las acciones deben conservar una agrupación intencional, y Vaciar debe diferenciarse claramente de Guardar, Exportar y Revisiones.

### P2 — Falta un mensaje de estado inequívoco al abrir un campo

El texto “Sin cambios guardados” aparece al cargar un campo aunque su valor ya esté guardado en el CMS. Es una contradicción aparente con el valor existente y puede generar dudas sobre si hace falta guardar antes de salir.

**Evidencia:** [editor de campo](capturas/16-editor-campo-texto.png).

**Cambio requerido:** expresar el estado sin ambigüedad y actualizarlo según el ciclo del formulario: guardado al abrir, pendiente tras editar, guardado al confirmar y error si falla.

**Verificar:** comprobar los cuatro estados sin cambiar la redacción de botones ni el flujo de publicación.

### P3 — Las guías de edición móvil destacan demasiados elementos a la vez

En móvil, el modo CMS marca con borde discontinuo varios elementos editables del sitio simultáneamente. Ayuda a descubrir qué se puede tocar, pero la acumulación compite con el contenido y hace más difícil leer la vista previa como visitante.

**Evidencia:** [sitio en modo edición móvil](capturas/20-movil-lanzador.png).

**Mejora sugerida:** conservar la señal táctil, pero mostrarla con menor intensidad o priorizar el elemento enfocado/seleccionado. La referencia de Sanity Presentation usa un control para activar o desactivar los contornos de edición, además de mostrar la relación entre el elemento y su documento.

**Verificar:** a 390 px se debe poder distinguir la vista del sitio y, a la vez, descubrir los elementos editables al recorrerlos.

### P3 — Los botones de borrar categorías y álbumes solo se identifican con “×”

En las filas de categorías y álbumes, la acción de borrar se representa solo con una ×. Visualmente se entiende junto a “Editar”, pero el nombre leído por tecnologías de asistencia no describe la acción ni el objeto.

**Evidencia:** [categorías](capturas/10-categorias.png), [álbumes](capturas/12-albumes.png).

**Mejora sugerida:** añadir un nombre accesible contextual, como “Eliminar categoría: Compuertas”, y conservar la confirmación existente.

**Verificar:** con lector de pantalla, recorrer una fila y comprobar que editar y eliminar se distinguen sin depender de la posición o del glifo.

## Lo que ya funciona

- La edición ocurre sobre el sitio real, y la paleta azul oscura conecta el CMS con Hidromont.
- “Publicar cambios” destaca en la barra; el historial explica que una compilación local aún necesita despliegue.
- Colecciones e imágenes ya tienen búsqueda; las entradas muestran título, slug y estado de publicación.
- El selector de imágenes tiene búsqueda, álbum y categoría; el formulario separa alt, estado y pertenencia a galería.
- Administración separa registro de actividad, respaldos y cambio de contraseña.
- El panel se adapta a móvil como pantalla completa y mantiene el acceso a las acciones principales.
- axe no reportó violaciones en las 18 escenas CMS revisadas. Esta comprobación automatizada no sustituye una prueba con lector de pantalla.

## Referencias comparables

Se usan como patrones para comparar tareas, no como diseños para copiar:

- [WordPress Media Library](https://wordpress.org/documentation/article/media-library-screen/): combina búsqueda y filtros con vista de cuadrícula y lista; útil para encontrar medios en bibliotecas grandes.
- [Directus Content Module](https://docs.directus.io/user-guide/content-module/content): pone búsqueda, filtros y creación en la cabecera de una colección; aplicable a las listas de categorías y álbumes.
- [Sanity Presentation](https://www.sanity.io/docs/user-guides/preview-and-page-building): permite activar contornos de edición en una vista del sitio; patrón útil para moderar la densidad de guías táctiles.
- [Ghost preview and publishing](https://ghost.org/help/publishing-content/): separa vista previa y publicación, con comprobación en escritorio y móvil.

## Evidencia y límites de la revisión

El [índice de capturas](capturas/README.md) reúne 47 imágenes de escritorio y móvil, incluyendo desplazamientos de listas y formularios largos. La revisión automatizada de axe cubrió acceso, barra, colecciones, formulario de entrada, revisiones, galería, formularios de categoría/álbum/imagen, selector de medios, historial, administración y vistas móviles. La falta de un nombre descriptivo para las × de eliminación requiere una comprobación manual con lector de pantalla, aunque axe no reportó violaciones.

No se guardó contenido, no se borraron activos y no se ejecutó la publicación. Los inicios de sesión de auditoría sí dejan eventos en el registro local de actividad.

## Criterios para cerrar el HOLD

1. La base editorial no contiene archivos ni filas de prueba; las pruebas E2E usan datos aislados.
2. Categorías y álbumes se pueden encontrar por búsqueda sin recorrer manualmente todas las filas.
3. El editor comunica con claridad el estado del campo y presenta las acciones sin saltos accidentales entre filas.
4. En móvil las guías editables no dominan la lectura del sitio y los controles siguen siendo fáciles de localizar.

## Seguimiento de implementación — 23 de septiembre de 2026

Se implementaron la búsqueda local por nombre y slug para categorías y álbumes, el conteo y estado vacío, los estados del editor, la agrupación de acciones y el control para mostrar las guías táctiles. Los botones de eliminación anuncian la acción y el elemento. Las pruebas E2E corren con una copia temporal de la base y recursos, sin reutilizar el servidor editorial.

La verificación pasó: `npm run check` (219 archivos, sin errores ni avisos), `npm test` (330 pruebas) y `npm run test:e2e` (105 aprobadas, 4 omitidas). Las [capturas nuevas](implementacion/README.md) muestran las escenas afectadas en escritorio y móvil.

El HOLD **permanece** por el primer criterio: 32 categorías y 24 medios sintéticos siguen en la biblioteca original a la espera de una revisión humana. Se prepararon respaldos y un [inventario con cada candidato](inventario-datos-prueba.md); ningún registro ni archivo fue eliminado. Al aprobar cada candidato, se podrá hacer la limpieza editorial y reevaluar el cierre del HOLD.
