# Auditoría editorial y de escritura natural — Hidromont Chile

Fecha: 1 de agosto de 2026  
Estado: auditoría y primera ronda de correcciones implementada.

## Alcance y criterio

Se revisó el texto que llega al sitio público desde `src/data/cms-content.json`, las plantillas que contienen textos de respaldo, las 8 fichas de servicio, las 40 fichas del banco de proyectos y los metadatos textuales de la galería. El CMS contiene 66 entradas y 332 campos de texto (aprox. 1.727 palabras); la galería contiene 74 ítems, todos con título, alt y leyenda. Se excluyeron comentarios de código y documentación técnica interna porque no son contenido del sitio.

El contrato editorial detectado es B2B técnico: mandantes, constructoras, áreas de ingeniería y compras de Chile y de otros mercados. Conviene usar español chileno formal, preciso y sobrio. Se deben conservar nombres de clientes, proyectos, normas, medidas, fechas, alcances y capacidades que estén validados internamente.

Esta es una evaluación de precisión, voz y naturalidad contextual. No determina quién escribió los textos ni asigna una probabilidad de autoría.

## Diagnóstico

La base es buena: las fichas de proyectos y varias páginas de servicio aportan nombres propios, procesos, diámetros, materiales y alcances concretos. Ahí está la voz más creíble del sitio. El problema se concentra en los textos corporativos y algunos cierres comerciales: repiten la misma promesa de “ingeniería, fabricación y montaje”, suman adjetivos sin evidencia y, en ciertos casos, hacen afirmaciones absolutas que requieren respaldo.

Antes de reescribir, hay dos datos que no deben seguir visibles sin confirmación. Después, la mayor ganancia vendrá de condensar los mensajes repetidos, elegir un solo tratamiento al visitante y transformar promesas genéricas en capacidades observables ya presentes en el sitio.

## Correcciones implementadas

- Se eliminó el marcador `[Por definir]` de Los Cóndores. La ficha ahora usa los antecedentes del catálogo y del procedimiento de montaje entregados en `archivos_hidromont`: blindaje DN 2.200, ramales DN 1.600, 1.200 m de blindaje, 132 m de ramales y 2.448 t para el conjunto de blindaje, bifurcación y ramales.
- Se retiraron de Puerto Williams las dimensiones, espesores, accesorios, ensayos y certificaciones duplicados del caso Coyhaique. Los archivos entregados no incluyen un dossier técnico de ese proyecto; se mantuvo solo el alcance que ya estaba declarado: tres tanques aéreos de GLP de 18.000 galones.
- Se reescribieron home, empresa, footer, CTA y contacto para usar español chileno formal, evitar promesas absolutas y eliminar la repetición de la misma propuesta de valor.
- Se revisaron las ocho fichas de servicio y los siete proyectos destacados. Se conservaron listas y tablas cuando facilitan la consulta técnica, y se retiraron afirmaciones promocionales o absolutas que no agregaban información.
- Los proyectos del banco mantuvieron su terminología repetida cuando esta identifica con precisión el alcance técnico; no se aplicaron sinónimos mecánicos.

## Evaluación global

| Dimensión                 | Nivel 0–3 | Observación                                                                                                                 |
| ------------------------- | --------: | --------------------------------------------------------------------------------------------------------------------------- |
| Especificidad y sustancia |         2 | Las fichas técnicas son concretas; home, empresa y CTA recurren a formulaciones intercambiables.                            |
| Voz, sintaxis y ritmo     |         2 | Hay secuencias repetidas y cierta acumulación de sustantivos abstractos; el contacto alterna `usted` y `tú`.                |
| Estructura y formato      |         1 | Las listas y tablas técnicas ayudan a consultar. Hay algunos encabezados redundantes, pero no dominan la lectura.           |
| Atribución y evidencia    |         2 | Cifras, certificaciones, capacidades y promesas absolutas se publican sin una fuente o responsable editorial identificable. |
| Coherencia contextual     |         2 | El tono técnico es correcto, pero conviven voz institucional, primera persona y trato informal.                             |

**Resultado orientativo: 9/15 — revisión sustantiva.** La puntuación sirve para priorizar edición; no es una medición de autoría.

## Hallazgos prioritarios

| Prioridad  | Ubicación y fragmento                                                                                                                             | Patrón / efecto                                                                                                                                                                                                                        | Corrección recomendada                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crítica    | `src/content/proyectos/ch-los-condores.md:11,37` — `[Por definir]`                                                                                | Marcador de trabajo interno visible tanto en la ficha como en la tabla técnica. Debilita la credibilidad del caso principal.                                                                                                           | Confirmar el peso y publicarlo; si no existe un dato validado, eliminar el campo `peso` de la ficha y de la tabla.                                                                                                          |
| Crítica    | `src/content/proyectos/tanques-glp-puerto-williams.md:16-48`                                                                                      | Las dimensiones, espesor, peso, válvulas y presión coinciden con el caso de Coyhaique, mientras que la capacidad declarada cambia de 30.000 a 18.000 galones. Es un indicio fuerte de contenido copiado o de una discrepancia técnica. | Detener la publicación de esa ficha hasta contrastarla con dossier, planos y certificado. Corregir todas las cifras afectadas de una vez, incluido el resumen del servicio.                                                 |
| Importante | `servicios.index.metodologia.subtitle` — “garantiza calidad, trazabilidad y seguridad en cada etapa”                                              | Promesa absoluta sin describir controles, responsable ni límite. Suena a fórmula corporativa y puede convertirse en un compromiso no demostrable.                                                                                      | Nombrar prácticas verificables: “Aplicamos procedimientos de desmontaje, fabricación, reparación, montaje y obturación según el alcance de cada obra.” Añadir controles concretos solo si están acreditados.                |
| Importante | `empresa.maquinaria.subtitle` — “equipos hidromecánicos de cualquier dimensión”; `servicios/valvulas.md:49` — “para cualquier diámetro y presión” | Absolutos que las propias fichas no delimitan. Amplifican el riesgo comercial y restan precisión a una empresa que sí muestra capacidades medibles.                                                                                    | Sustituir por límites publicados: dimensiones de cilindradora, tornos, puentes grúa, rangos ya validados o “según evaluación técnica del proyecto”.                                                                         |
| Importante | `proyectos.index.cta.subtitle` — “nos permite anticipar los desafíos técnicos de cada obra”                                                       | Beneficio genérico y causalidad no demostrada. Podría aplicarse a cualquier competidor.                                                                                                                                                | Usar una invitación directa: “Cuéntenos el alcance de su obra y revisaremos las alternativas de fabricación y montaje.”                                                                                                     |
| Importante | `empresa.historia.p2-p3`, `site.company.descripcionLarga`, home y footer                                                                          | La fórmula “ingeniería, fabricación y montaje” se repite en casi todas las superficies, junto con “soluciones seguras, robustas y adaptadas”. La repetición quita peso a la propuesta en vez de reforzarla.                            | Asignar una función a cada página: home = oferta y prueba; empresa = historia, taller y equipo; servicios = alcance; footer = una frase descriptiva breve. Mantener la fórmula solo donde identifica realmente el servicio. |
| Importante | `contact.form.requiredNote`, `contacto.gracias.*`, `contact.info.note`                                                                            | El mismo flujo combina “Su / le / envíe” con “Tu / te”. En un sitio industrial B2B se percibe como falta de criterio editorial.                                                                                                        | Adoptar trato formal en todo el sitio: “Le contactaremos tras recibir su consulta” y “Su mensaje fue enviado correctamente”.                                                                                                |
| Importante | `home.hero.subtitle`, `home.capabilities.*`, `home.installations.title`, `layout.footer.description`                                              | Acumulación de frases de presentación: “alta complejidad”, “capacidad técnica y experiencia comprobada”, “empresa consolidada”, “precisión industrial”. Declaran valor sin añadir hechos nuevos.                                       | Dejar una única promesa principal y acompañarla con tres pruebas ya publicadas: desde 1983, taller de 2.000 m², proyectos/países solo después de validar los conteos.                                                       |
| Importante | `src/content/servicios/tanques-especiales.md:29-37`                                                                                               | Los párrafos “Fabricamos recipientes…” y “Capacidad técnica” dicen casi lo mismo. Además, “todos los ensayos… al 100 %” exige evidencia y puede no aplicar a cada contrato.                                                            | Unir en un párrafo que describa materiales, procesos y condición contractual. Condicionar el alcance de ensayos a la especificación o eliminar el “todos”.                                                                  |
| Importante | `src/content/servicios/infraestructuras.md:34,38`; `ruta-nahuelbuta-pasarelas.md:12`                                                              | La misma obra se explica tres veces y la frase “garantizando la seguridad, durabilidad y protección climática” interpreta el resultado sin respaldo en la ficha.                                                                       | Conservar la especificación física y eliminar la conclusión. Diferenciar servicio (capacidad general) de caso de proyecto (alcance ejecutado).                                                                              |
| Menor      | `ch-los-condores.md:15` — “múltiples contratos… Para la central…”                                                                                 | Mayúscula después de punto que corta la oración y apertura grandilocuente (“uno de los más complejos y de mayor envergadura”).                                                                                                         | Corregir a una oración directa que comience por alcance, ubicación y contratos, siempre que esos datos estén verificados.                                                                                                   |
| Menor      | Fichas de banco de proyectos                                                                                                                      | Muchas descripciones siguen la estructura “Ingeniería, suministro, fabricación y montaje…” y encadenan oraciones cortas. Es preciso, pero monótono en el listado.                                                                      | Aplicar una plantilla breve: objeto + medida + alcance distintivo. Repetir la terminología técnica cuando corresponda; no forzar sinónimos.                                                                                 |
| Menor      | CMS: 21 campos de alt vacíos en galerías de proyectos/servicios                                                                                   | No son un problema de naturalidad por sí mismos: varias imágenes no parecen llegar al build actual. Si se activan, quedarían sin descripción.                                                                                          | Al publicar cada imagen, completar el alt con objeto, acción y contexto. No describir imágenes decorativas.                                                                                                                 |

## Observaciones por superficie

### Inicio, empresa y pie de página

El sitio abre con experiencia y amplitud de servicio, pero repite la misma idea en título, bajada, capacidades, instalaciones, CTA y footer. La evidencia ya existe y es mejor material editorial: año de fundación, sede, tamaño del taller, medios de izaje, países y casos. La página Empresa debe explicar qué permite hacer la infraestructura; no necesita volver a prometer “soluciones robustas”.

La frase `Más de 40 años…` está alineada con la fundación de 1983, pero las cifras `80+ proyectos`, `más de 40 tuberías`, `más de 25 proyectos` y `más de 20 adicionales` deben tener una fuente interna única. No se recomienda suavizarlas ni incrementarlas: basta con indicar el registro que las respalda y actualizarlo de forma periódica.

### Servicios

Las ocho fichas de servicio son el bloque más sólido del sitio por sus listas de tipos, aplicaciones, procesos y casos. Las listas son pertinentes para un lector técnico y no conviene convertirlas por sistema en prosa. Las mejoras son de precisión:

- evitar absolutos como “cualquier diámetro”, “todos los ensayos” y “aseguran la entrada continua de agua”;
- reducir la duplicación entre resumen, introducción y la sección “Capacidad técnica”;
- reservar “destacado”, “comprobada” e “integral” para casos que aporten la prueba enseguida;
- normalizar unidades: `DN 2.200`, `m`, `t` y decimales con coma, según el estándar técnico que defina Hidromont.

### Proyectos

Los siete casos detallados tienen una estructura útil: introducción, alcance, datos técnicos y cliente. Las tablas están justificadas y deben mantenerse. La edición debe concentrarse en arrancar por el hecho, no por una valoración (“uno de los más complejos”, “proyecto integral”, “larga longitud”), y en revisar cada dato que se repite entre frontmatter, cuerpo, tarjetas de servicio y galería.

El banco de 40 proyectos cumple bien como inventario. Para evitar el ritmo de catálogo generado, cada alcance debe mantener únicamente lo que distingue la obra: equipo, diámetro/medida, tramo y trabajo especial. No hace falta reescribir nombres de procesos ni usar variación elegante.

### Clientes, galería y contacto

Clientes y galería son claros y sobrios. La galería tiene cobertura completa de título, alt y leyenda en sus 74 ítems. En cambio, los campos de alt de galerías secundarias deben completarse antes de asociar una imagen nueva.

El contacto requiere unificar registro. La opción recomendada es formal: `Envíe`, `su`, `le`. También conviene evitar “a la brevedad” si no hay una expectativa de respuesta definida; una alternativa segura es “Le responderemos tras revisar su consulta y los antecedentes adjuntos”.

## Plan de acción

| Fase                          | Prioridad | Acción                                                                                                                                                                         | Responsable sugerido              | Resultado verificable                                                                                      |
| ----------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0. Verificar                  | P0        | Resolver el marcador de peso de Los Condores. Contrastar Puerto Williams con dossier, planos, certificado SEC y alcance contratado.                                            | Jefatura de proyectos + calidad   | No quedan marcadores públicos; cada cifra crítica coincide con una fuente interna.                         |
| 1. Consolidar hechos          | P0        | Crear una ficha fuente para estadísticas, clientes autorizados, certificaciones, capacidades de taller y normas aplicables.                                                    | Comercial + operaciones + calidad | Una fuente interna con fecha, responsable y evidencia para cada afirmación corporativa.                    |
| 2. Fijar la voz               | P1        | Definir una guía editorial de una página: español chileno formal, tratamiento `usted`, uso de primera persona plural, formato de unidades y palabras a evitar salvo evidencia. | Marketing/comercial               | La guía queda disponible junto al CMS y se aplica a plantillas y nuevas fichas.                            |
| 3. Reescribir páginas marco   | P1        | Editar home, empresa, footer y CTA. Eliminar promesas abstractas y dejar pruebas concretas no repetidas.                                                                       | Marketing + revisor técnico       | Cada página cumple una función distinta; ninguna afirmación comercial queda sin dato, ejemplo o condición. |
| 4. Normalizar servicios       | P1        | Unificar resumen, introducción y capacidad técnica de las 8 fichas; conservar listas y tablas útiles; retirar duplicaciones y absolutos.                                       | Responsable técnico de cada línea | Una ficha por servicio con una propuesta clara, alcance, límites y casos validados.                        |
| 5. Corregir proyectos         | P1        | Revisar frontmatter, cuerpo, tarjetas y menciones cruzadas de los 40 proyectos. Empezar por 7 destacados y los dos casos de GLP.                                               | Jefes de proyecto                 | Datos consistentes en todas las superficies y sin aperturas valorativas vacías.                            |
| 6. Microcopia y accesibilidad | P2        | Unificar todo el contacto en trato formal; completar alt al subir imágenes; revisar mensajes de éxito, vacíos y CTA.                                                           | Marketing + desarrollo            | Ningún flujo mezcla `tú` y `usted`; toda imagen informativa nueva tiene alt descriptivo.                   |
| 7. Control de publicación     | P2        | Añadir una revisión editorial antes de publicar: hecho fuente, unidad, cliente autorizado, tono y alt.                                                                         | Administrador del CMS             | Checklist firmado o registrado por cada actualización relevante.                                           |

## Criterios de salida

- Los datos de Los Condores y Puerto Williams están resueltos y verificados.
- Las cifras y certificaciones públicas tienen fuente, responsable y fecha de revisión.
- El contacto usa un solo tratamiento; se recomienda `usted`.
- Las páginas marco ya no repiten la misma promesa ni usan absolutos sin límite técnico.
- Las fichas de servicio y proyecto preservan sus datos y mantienen listas/tablas cuando facilitan la consulta.
- No quedan campos de texto de publicación con marcadores de trabajo, y toda imagen informativa añadida tiene texto alternativo.

## Verificación pendiente

No se verificaron externamente las certificaciones ISO 9001, AWS D1.1, ASME/ASTM, SEC, cifras de proyectos, clientes, capacidades de equipo ni especificaciones de cada obra. La auditoría no los contradice salvo la inconsistencia descrita en Puerto Williams; deben validarse con documentación de Hidromont antes de publicarlos o de reescribirlos con mayor contundencia.

La compilación estática se ejecutó al cierre de la auditoría y generó 24 páginas sin errores de contenido.
