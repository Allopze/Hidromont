# Auditoría de preparación para producción — Hidromont Chile (sitio + CMS)

- **Fecha:** 28-09-2026
- **Commit auditado:** `4a51c74` (`main`), con el sitio en producción comprobado por GET de solo lectura.
- **Alcance:** sitio público Astro, CMS (overlay + API Fastify + SQLite), flujo de publicación, despliegue (Caddy, systemd, scripts), pruebas, seguridad, respaldos y operación.
- **Regla seguida:** no se modificó código del repositorio. Todas las pruebas destructivas se hicieron en dos clones desechables (`git clone` + `npm ci`) con una **copia** de la base local y de `uploads/cms`. Contra producción solo se hicieron peticiones GET.
- **Antecedente:** la auditoría del 25-09 (`AUDITORIA-HIDROMONT.md`) y sus correcciones (fases A–D, merge `d618f1b`). Esta auditoría no repite esos hallazgos: comprueba si siguen abiertos y busca los nuevos.

---

## 1. Resumen ejecutivo

El sitio público funciona y está bien hecho: las 27 páginas compilan y responden, el SEO técnico está completo, el JavaScript público es mínimo (~15 KB) y la suite E2E pasa entera (229 pruebas, 0 fallos). El CMS también funciona de punta a punta. Se probó en un servidor de producción simulado: editar, guardar, recargar, publicar desde la interfaz y ver el cambio en el sitio público.

La publicación es **atómica y resistente**, y se comprobó a propósito:

- un build fallido deja el sitio intacto y devuelve un mensaje claro (422);
- dos publicaciones a la vez se rechazan con 409;
- matar el proceso a mitad de publicación no deja nada roto: al reiniciar, el trabajo queda como fallido, el cerrojo huérfano se retoma y la siguiente publicación sale bien.

La separación entre `hidromontchile.cl` (sin editor, API 404) y `editor.*` está bien hecha y verificada también en producción. La seguridad de la API es sólida: sesión `__Host-`, CSRF, validación por contenido de las subidas, Markdown sin HTML crudo y guardas de arranque.

Lo que separa al proyecto de estar listo para producción es sobre todo **operación**:

- no hay respaldo fuera del servidor ni respaldo de los medios originales, y la restauración nunca se ha probado;
- no hay alertas si algo falla;
- queda una serie de problemas medios de UX y robustez: rechazos de subida mostrados como error 500, un estado de publicación engañoso si se corta la conexión, spam posible en el formulario y un despliegue que no se coordina con el panel.

Publicar hoy es confiable; recuperar el contenido si se pierde el VPS, no.

## 2. Production Readiness

**Production Readiness:** 75/100
**Nota:** 5,0 / 7,0
**Estado:** Casi preparado para producción

| Área                                  |      Puntaje | Explicación                                                                                                                                                                                                                                             |
| ------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Funcionalidad sitio público           |       9 / 10 | Las 27 páginas compilan y responden 200; la 404 y las redirecciones canónicas funcionan; E2E pública en verde. Pierde un punto por el formulario de contacto (M-03).                                                                                    |
| CMS y flujo editorial                 |      12 / 15 | Ciclo editar → guardar → recargar → publicar verificado en el navegador, con estados claros. Restan los rechazos de subida como 500 (M-01), el estado engañoso si se corta la publicación (M-02) y el guardado de fichas sin control de versión (M-05). |
| Publicación e integridad de contenido |      12 / 15 | Build atómico, cerrojo entre procesos, recuperación tras caída y fallo de build verificados. Restan el despliegue sin coordinar con el panel (M-04), un `.md` ajeno que bloquea todo (B-02) y el export no atómico entre archivos.                      |
| Seguridad                             |      12 / 15 | Autenticación, CSRF, cookies, subidas, XSS y aislamiento de dominios correctos. Restan el límite de intentos débil (M-06), el formulario expuesto (M-03) y el proceso como root, que es una decisión aceptada.                                          |
| Persistencia, SQLite y recuperación   |       5 / 10 | Base sana (WAL, FK, transacciones, `integrity_check` ok), pero sin copia externa, sin respaldo de `uploads/cms` y sin restauración probada (A-01).                                                                                                      |
| Deploy e infraestructura              |       7 / 10 | Caddy con TLS, www → apex, límites de cuerpo, systemd endurecido y script de despliegue con muchas comprobaciones. Restan el cron de respaldo solo documentado y el despliegue sin coordinar con el panel.                                              |
| Calidad y mantenibilidad              |        4 / 5 | Lint y `astro check` limpios, código comentado con el porqué. Restan módulos grandes del overlay (`events.js` 1.453 líneas) y 15 archivos sin Prettier.                                                                                                 |
| Testing                               |        4 / 5 | 499/501 unitarias y 229/233 E2E (4 omitidas). Pero ninguna prueba automática compila de verdad al publicar (`CMS_PUBLISH_CHECK_COMMAND=false` en E2E), y 2 unitarias dependen de un `dist/` previo.                                                     |
| UI/UX y accesibilidad                 |        4 / 5 | Panel claro para una persona no técnica (confirmaciones, borradores locales, resumen antes de publicar). Detalles: ids técnicos en el resumen y mensajes genéricos en errores de subida.                                                                |
| Rendimiento y SEO                     |        4 / 5 | Title, description, canonical, OG, un H1 y `alt` en todas las páginas; sitemap y robots correctos; JS público mínimo. HTML de portada de ~100 KB.                                                                                                       |
| Observabilidad y operación            |        2 / 5 | Hay registro de auditoría y logs JSON en el journal, pero sin Sentry por defecto, sin alertas ni monitor externo, y con registros de publicación de hasta 112 KB sin poda (M-07).                                                                       |
| **Total**                             | **75 / 100** |                                                                                                                                                                                                                                                         |

No se aplica ninguna regla de penalización: no hay hallazgos críticos demostrados, el build de producción se completa y publicar funciona de forma consistente.

## 3. Veredicto operativo

**Lanzamiento viable después de corregir bloqueadores.** (El sitio ya está en línea: en la práctica, «mantener en producción corrigiendo primero el bloqueador».)

Condiciones que llevan a esta conclusión:

- **A favor:**
  - el build de dos perfiles se completa (12,9 s en local);
  - publicar desde el panel actualiza el sitio servido sin pasos manuales (5 publicaciones reales, todas `succeeded`, ~13 s cada una);
  - los fallos probados (build roto, caída del proceso, doble publicación) nunca dejaron el sitio vacío ni a medias;
  - el editor no aparece en el dominio público, y la API responde 404 allí (verificado en local y en producción).
- **En contra:**
  - toda la edición vive en un único disco del VPS;
  - los originales de las fotos (~2,5 GB) no están en ningún respaldo del sistema;
  - la restauración no está documentada ni ensayada;
  - si el sitio o una publicación fallan, nadie se entera hasta que alguien mire.

## 4. Bloqueadores de producción

1. **A-01 — Respaldo externo y restaurable de la base y de `uploads/cms`.** Hoy el respaldo es manual o un cron que el repositorio solo documenta comentado, se queda en el mismo disco y no incluye los medios. Hace falta, como mínimo, una copia diaria automática fuera del VPS de la base (con `npm run cms:backup`) y de `uploads/cms`, más una restauración ensayada una vez y escrita paso a paso.

No se identificaron otros bloqueadores.

## 5. Hallazgos críticos

No se demostró ningún hallazgo crítico. Los vectores más probables se probaron y están mitigados:

- acceso sin sesión (401 en todas las rutas protegidas);
- CSRF (403 sin token);
- path traversal por URL y por campo de imagen;
- XSS por texto, cuerpo Markdown o SVG;
- API del CMS en el dominio público (404);
- editor servido en el dominio público.

## 6. Hallazgos altos

### [ALTO] A-01 — No hay respaldo fuera del servidor, los medios no se respaldan y la restauración no está probada

**Área:** Persistencia / Operación / Deploy

**Ubicación:** `cms/services/backupService.ts:21-39` (solo copia la SQLite); `docs/DESPLIEGUE-VPS.md:353-361` (el cron está comentado y la copia externa es manual: «Bájalos periódicamente»); `docs/CMS-GUIDE.md:360` («Restaurar es manual (reemplazar el .sqlite)»); `scripts/deploy-vps.sh` y `scripts/publicar-vps.sh` (ninguno instala el cron).

**Evidencia:**

- `BackupService.createBackup()` hace `db.backup()` de la base y nada más.
- `uploads/cms` (1.815 archivos, ~2,5 GB en local) no aparece en ningún respaldo.
- La rotación conserva 20 copias en `cms/data/backups/`, en el mismo disco.
- El repositorio no contiene ningún mecanismo que saque copias del VPS.
- No se pudo comprobar el crontab del VPS (sin SSH en esta sesión). Si existe, el hallazgo baja a MEDIO, pero sigue faltando el respaldo de medios y la prueba de restauración.

**Cómo reproducir:** revisar `crontab -l` en el VPS y buscar dónde se copia `uploads/cms` fuera del servidor.

**Comportamiento actual:** una pérdida del disco o del VPS, un borrado accidental masivo o un `rm` equivocado pierden todas las ediciones desde la última copia manual y todos los originales subidos desde el panel. El repositorio solo tiene los derivados versionados y el contenido del último commit.

**Comportamiento esperado:** copia diaria automática, fuera del VPS, de la base y de `uploads/cms`, con retención razonable y un procedimiento de restauración escrito y ensayado.

**Impacto:** pérdida importante de datos. Es el riesgo más grave del proyecto, porque la persona que edita no puede rehacer lo perdido sin volver a buscar las fotos.

**Recomendación (proporcional):**

1. Un timer de systemd (o cron) diario con `npm run cms:backup`.
2. `rclone`/`restic` hacia un almacenamiento externo, por ejemplo un bucket S3 compatible o Google Drive de la empresa, de `cms/data/backups/` (la copia más reciente) y de `uploads/cms` (incremental).
3. Una sección «Restaurar» en `DESPLIEGUE-VPS.md`: parar el servicio, poner la base y `uploads/cms`, `npm run cms:export`, `npm run build:log` y arrancar.
4. Ensayarla una vez en un clon.
5. Opcional: que la barra del panel avise si el último respaldo tiene más de 48 h.

**Bloquea producción:** Sí.

## 7. Hallazgos medios

### [MEDIO] M-01 — Una subida rechazada por seguridad o por estar dañada se muestra como error del servidor: «Inténtalo de nuevo»

**Área:** CMS / API / UX

**Ubicación:** `cms/services/mediaService.ts` (`createMedia`: rechazos de SVG de `problemaDeSvg`, «El archivo no es un video válido», re-codificación de sharp); `cms/controllers/BaseController.ts:10-60` (patrones) y `:107-115` (el resto va a 500).

**Evidencia (curl contra el servidor de producción simulado):**

| Archivo subido                        | Respuesta | Mensaje                                         |
| ------------------------------------- | --------- | ----------------------------------------------- |
| SVG con `<script>` y `onload`         | 500       | «No se pudo completar la operación. Inténtalo…» |
| SVG con `<image href="https://…">`    | 500       | ídem                                            |
| `.mp4` con bytes aleatorios           | 500       | ídem                                            |
| JPEG truncado (cabecera válida)       | 500       | ídem                                            |
| PNG renombrado a `.jpg` (comparación) | 400       | «dice ser JPEG pero es PNG…» (correcto)         |

El log del servidor muestra el mensaje bueno («El SVG contiene scripts: no se admite.»), pero como `level: error`. Si `SENTRY_DSN` está definido, cada uno llega a Sentry como excepción.

**Cómo reproducir:** subir desde «Biblioteca» un SVG con `<script>` o un `.mp4` que no sea video.

**Comportamiento actual:** la persona editora lee «inténtalo de nuevo», lo intenta y falla igual. No sabe que el problema es el archivo.

**Comportamiento esperado:** un 400 con el motivo en palabras («Este SVG trae código y no se admite; expórtalo sin scripts o súbelo como PNG», «El archivo está dañado o incompleto»).

**Impacto:** confusión y soporte innecesario. Contradice el objetivo de un CMS «sin cosas raras».

**Recomendación:** lanzar esos rechazos como `ErrorDeUsuario(400, …)` (SVG y video) y envolver la re-codificación de sharp en `try/catch` con un `ErrorDeUsuario(400, 'La foto está dañada o incompleta…')`. Añadir un caso por tipo en `cms/test/media-video-svg.test.ts` que compruebe el **estado HTTP** vía `app.inject`.

**Bloquea producción:** No.

### [MEDIO] M-02 — Si se corta la conexión durante «Publicar», el panel dice que falló aunque la publicación siga y termine bien

**Área:** CMS / UX / Publicación

**Ubicación:** `src/scripts/cms/overlay/publish.js` (función `publicar`: una sola `await api('/api/cms/publish')` y, ante cualquier error, «No se pudo publicar. El sitio sigue mostrando la versión anterior…»); `src/scripts/cms/overlay/shell.js:194-198` (`beforeunload` solo si hay un formulario sucio); `cms/controllers/PublishController.ts` (el servidor no cancela al perder el cliente).

**Evidencia:**

- La publicación completa (export + `astro check` + dos builds) ocurre dentro de la petición HTTP: 13 s en local y «unos minutos» según el propio panel en el VPS. Caddy tiene `read_timeout 660s`.
- El handler no escucha la desconexión del cliente, así que la compilación continúa. **Verificado:** con `curl -m 3` (el cliente corta a los 3 s, `exit=28`), el servidor terminó igual. El trabajo quedó en `succeeded` y `dist/index.html` se sustituyó 20 s después.
- La pantalla de error se decide solo por la respuesta de esa petición. El mensaje de `api.js` para un corte es «No se pudo conectar con el servidor», y el título dice «No se pudo publicar».
- Tras recargar, nada consulta `/api/cms/publish/jobs`: si la persona pulsa «Publicar» otra vez, recibe un 409 «Ya hay una publicación en curso» sin entender por qué.
- Durante la publicación no hay aviso al cerrar la pestaña.

**Cómo reproducir:** en `editor.*`, pulsar «Publicar ahora» y cerrar la tapa del portátil o cortar el wifi a los pocos segundos. Al volver, el panel muestra «No se pudo publicar»; el historial y el sitio muestran que sí se publicó.

**Comportamiento actual:** el estado mostrado puede ser falso en los dos sentidos. Dice «falló» cuando terminó bien, y no dice nada de que hay una publicación en curso tras recargar.

**Comportamiento esperado:** ante un corte, «Se perdió la conexión; comprobando si la publicación terminó…». Consultar el último trabajo hasta que termine y mostrar su resultado real. Al montar el editor, si hay un trabajo `running`, enseñar «Publicando…» con su reloj.

**Impacto:** estado editorial ambiguo, que es justo uno de los que la persona debe distinguir. Puede llevar a republicar o a pedir ayuda sin motivo.

**Recomendación (sin cambiar la arquitectura):** en el cliente, si `api()` falla con `status 0` o 502/504, consultar `GET /api/cms/publish/jobs` cada 3 s hasta ver el trabajo reciente en `succeeded`/`failed`. Al arrancar el overlay, hacer lo mismo si hay uno `running`. Activar `beforeunload` mientras `publicando === true`. No hace falta una cola.

**Bloquea producción:** No.

### [MEDIO] M-03 — Formulario de contacto: captcha desactivado y direcciones de correo expuestas en el HTML

**Área:** Frontend / Seguridad / Contacto

**Ubicación:** `src/components/contact/ContactForm.astro:18-19` (endpoint con el correo en claro), `:90` (`_captcha=false`), el `_cc` con las copias, y `:417-446` (límite solo en `sessionStorage`).

**Evidencia (HTML compilado):**

```html
<form
  action="https://formsubmit.co/hidromont@hidromont.cl"
  …
  data-ajax-action="https://formsubmit.co/ajax/hidromont@hidromont.cl"
>
  <input type="hidden" name="_captcha" value="false" />
  <input type="hidden" name="_cc" value="clopezd@hidromont.cl,jicoterillo@hidromont.cl" />
</form>
```

**Cómo reproducir:** ver el código fuente de `/contacto/`. Un `curl -X POST https://formsubmit.co/ajax/hidromont@hidromont.cl -d …` envía correos sin pasar por el sitio.

**Comportamiento actual:**

- Tres buzones reales quedan publicados para cualquier recolector de correos.
- Cualquiera puede enviar al endpoint directamente, así que el honeypot `_honey` y el límite de 3 envíos cada 5 minutos por pestaña no sirven contra un bot.
- El respaldo sin JavaScript lleva el captcha de FormSubmit desactivado.

**Comportamiento esperado:** que el endpoint no revele el correo y que haya una barrera de servidor contra el envío masivo.

**Impacto:** spam al buzón comercial y a dos personas. El riesgo es moderado y reversible.

**Recomendación:**

1. Usar el alias aleatorio que FormSubmit da tras activar el buzón (`https://formsubmit.co/<cadena>`), en lugar de la dirección.
2. Dejar `_captcha` activado en el envío nativo sin JS.
3. Si el spam aparece, mover el envío a una ruta propia de Fastify (`POST /api/contacto`), con límite por IP en SQLite (la tabla `login_attempts` es el patrón) y reenvío por SMTP. Solo si hace falta.

**Bloquea producción:** No.

### [MEDIO] M-04 — El despliegue no se coordina con el panel y compila un contenido distinto del que el servidor dará por bueno al arrancar

**Área:** Deploy / Integridad

**Ubicación:** `scripts/deploy-vps.sh` (bloques «Trayendo el código» → `git checkout` de las rutas de export + `git pull`; «Instalando dependencias» → `npm ci`; «Regenerando el contenido» → `npm run cms:export`; «Compilando»; y solo al final «Reiniciando el servicio»); `cms/scripts/export.ts` (exporta sin la siembra ni la retirada que hace `registerCmsRoutes` al arrancar); `cms/routes/cmsRoutes.ts:790-854` (al arrancar: siembra, retira y vuelve a exportar **sin compilar**).

**Evidencia (clon con la base local, que es anterior al código actual):**

1. `npm run cms:export`, como hace el deploy, cambia `src/data/cms-content.json` respecto de git: **134 claves quitadas y 88 añadidas** (vuelven las fichas `calidad.*`, `galeria.items`…, que el servidor retira al arrancar, y faltan `plantilla.*`, `page.404.*`, `site.accesibilidad.*`, `layout.footer.*`…).
2. El build del despliegue se hace con ese JSON.
3. Al reiniciar, el servidor siembra 76 campos y 10 fichas, retira 9 fichas y 51 campos, y reexporta. El JSON queda igual que git (0 valores distintos), pero `dist/` ya compilado no cambia hasta la siguiente publicación.

En este caso el texto visible resultó idéntico (las claves faltantes caen al texto del código, que coincide). Pero cualquier clave nueva cuyo valor sembrado difiera del texto por defecto del código saldrá mal en el sitio hasta la siguiente publicación.

Además:

- El script no comprueba si hay una publicación del panel en marcha antes de hacer `git checkout` + `npm ci`, que sustituye `node_modules` mientras un build lo está usando.
- `cms:export` no toma `.build.lock`, así que puede escribir `src/` a la vez que el export del panel.
- Si el build del deploy encuentra el cerrojo, el script sale con error **sin reiniciar**: queda código nuevo en disco con el proceso antiguo en memoria.

**Cómo reproducir:** en un clon con una base anterior al commit, `npm run cms:export && git diff --stat src/data/cms-content.json`. Para la carrera: pulsar «Publicar» y lanzar `npm run deploy` a la vez.

**Comportamiento actual:** el primer build tras un despliegue puede no reflejar la base reconciliada. Un despliegue durante una publicación puede fallar a mitad y dejar el servidor en un estado mixto.

**Comportamiento esperado:** el despliegue compila con el mismo contenido que el servidor sirve, y no arranca mientras haya una publicación en curso.

**Impacto:** textos o fichas incorrectos tras un despliegue hasta la siguiente publicación. En el caso de carrera, un despliegue fallido que exige intervención por SSH.

**Recomendación:**

1. Antes del `git checkout`, abortar si existe `.build.lock` con un PID vivo o si `publish_jobs` tiene uno `running`.
2. Hacer que `cms:export` ejecute la misma reconciliación de arranque, extrayendo a una función compartida `importMissingEntries` + `ensureCompanions` + `retireObsolete*`. Alternativa más simple: reiniciar el servicio **antes** de compilar y dejar que el arranque exporte, y después `npm run build:log`.
3. Si el build falla por cerrojo, decirlo y no dejar el código nuevo a medio aplicar.

**Bloquea producción:** No (el despliegue lo hace una persona técnica y es poco frecuente).

### [MEDIO] M-05 — Guardar una ficha (servicio, proyecto, página) sobrescribe sin control de versión

**Área:** CMS / Integridad

**Ubicación:** `src/scripts/cms/overlay/collections.js:569-600` (comentario A-3: «secuencial y SIN `expectedVersion`»).

**Evidencia:**

- El editor de un campo suelto sí envía `expectedVersion`. Probado: una segunda edición con la versión vieja recibe **409** «Conflicto de edición…».
- El formulario de ficha envía un `PATCH` por campo sin versión, así que la API acepta cualquier escritura. Probado: el `PATCH` sin `expectedVersion` respondió 200.

**Cómo reproducir:** abrir la misma ficha en dos pestañas (o como dos usuarios; la base tiene dos cuentas reales), cambiar el alcance en una y guardar, y luego cambiar otro campo en la otra y guardar. La primera edición del campo compartido se pierde sin aviso.

**Comportamiento actual:** la última escritura gana, campo a campo y en silencio.

**Comportamiento esperado:** detectar que la ficha cambió desde que se abrió y ofrecer recargar o comparar, como ya hace el editor de campo.

**Impacto:** pérdida silenciosa de una edición. Es poco probable con una sola persona, pero posible con dos pestañas.

**Recomendación:** enviar en el primer `PATCH` la `version` con la que se abrió la ficha y, en los siguientes, la que devuelve cada respuesta. O bien añadir un `PATCH /entries/:id/fields` que guarde todos los campos en una transacción con un solo `expectedVersion`. Esto último también resuelve el guardado parcial si falla un campo intermedio.

**Bloquea producción:** No.

### [MEDIO] M-06 — El límite de intentos de acceso es débil para un panel expuesto a internet

**Área:** Seguridad

**Ubicación:** `cms/repositories/RateLimitRepository.ts:9-10` (`WINDOW_MS = 60_000`, `MAX_ATTEMPTS = 10`); `cms/server.ts` (el `.env` solo se compara con la contraseña por defecto).

**Evidencia:** la ventana es de 60 s por IP, sin bloqueo por cuenta ni escalado. Eso permite ~14.400 intentos al día por IP y más con varias IP. `README.md` lo describe como «bloqueo temporal persistente… después de 10 intentos», que no es exacto. El cambio de contraseña desde el panel exige 12 caracteres, pero la del `.env` de producción no se valida más allá de no ser la de ejemplo.

**Cómo reproducir:** 11 intentos fallidos en menos de un minuto → 429 con `Retry-After` ≤ 60; esperar un minuto y repetir.

**Comportamiento actual:** la protección depende de que la contraseña sea fuerte.

**Comportamiento esperado:** que el coste de adivinar crezca rápido aunque la contraseña no sea perfecta.

**Impacto:** acceso administrativo si la contraseña es débil. No se pudo evaluar la del VPS.

**Recomendación (respetando la decisión de no poner `basic_auth` ni filtro por IP):**

1. Bloqueo progresivo por IP (tras 10 fallos, 15 min; tras 30, 24 h) y un tope diario **por cuenta** (p. ej. 50) que avise en el registro de actividad.
2. Rechazar en el arranque en producción un `CMS_ADMIN_PASSWORD` de menos de 12 caracteres, y aplicar el mismo mínimo en `cms:reset-password`.
3. Corregir la frase del README.

**Bloquea producción:** No.

### [MEDIO] M-07 — Sin alertas: si el sitio cae o una publicación falla, nadie se entera

**Área:** Observabilidad / Operación

**Ubicación:** `.env.production.example` (`SENTRY_DSN=` vacío); `cms/utils/errorTracking.ts` (sin DSN, solo stderr → journal); `cms/repositories/PublishJobRepository.ts:105-109` (se listan 30 trabajos y nunca se borra ninguno); `tsconfig.json` (sin `exclude`).

**Evidencia:**

- No hay monitor externo ni aviso por correo.
- Los errores quedan en `journalctl -u hidromont`, como JSON con `context.action` y la pila (bien, sin secretos).
- Cada trabajo de publicación guarda la salida del build: hasta **112 KB por trabajo** (6 trabajos = 336 KB en la copia).
- Buena parte son «hints» de `astro check` sobre `dist-editor/_assets/*.js`, porque `tsconfig.json` no excluye `dist-editor` (en el `_build.log` aparecen 13 avisos sobre `mount.BYfabMV-.js`).

**Cómo reproducir:** publicar dos veces y mirar `length(logs)` en `publish_jobs`, o `grep dist-editor/_assets _build.log`.

**Comportamiento actual:** la caída del proceso (bucle de reinicios), un certificado que no renueva o una publicación fallida solo se detectan si alguien entra a mirar.

**Comportamiento esperado:** aviso automático ante una caída o un fallo repetido de publicación.

**Impacto:** tiempo de detección largo. En un sitio corporativo eso significa días con una página rota o un formulario sin enviar.

**Recomendación:**

1. Un monitor externo gratuito (UptimeRobot, Better Stack o healthchecks.io) sobre `https://hidromontchile.cl/` y `https://editor.hidromontchile.cl/api/cms/health`.
2. Configurar `SENTRY_DSN` (ya está integrado) o, más simple, que un fallo de publicación envíe un correo al administrador.
3. Añadir `"exclude": ["dist", "dist-editor", "dist*.nuevo"]` a `tsconfig.json`.
4. Recortar los logs guardados de cada trabajo a las últimas ~200 líneas y borrar los trabajos de más de 90 días.

**Bloquea producción:** No, pero es lo siguiente en prioridad después de A-01.

## 8. Hallazgos bajos

### [BAJO] B-01 — La API acepta en campos de imagen valores que no son una foto del sitio, y los textos no tienen longitud máxima

**Área:** API / Validación

**Ubicación:** `cms/controllers/ContentController.ts` (`updateField`: la existencia del archivo solo se comprueba si el valor empieza por `/`); `cms/controllers/ContentController.ts` (`createEntry`: los `fields` no pasan por la validación de enumeraciones); `cms/validators/cms.schema.ts` (`updateFieldSchema.value: z.unknown()`).

**Evidencia (API con sesión):**

- `image = "https://evil.example/x.png"` → 200.
- `image = "javascript:alert(1)"` → 200, publicado como `<img src="javascript:alert(1)">`. Inofensivo en navegadores actuales, pero es una imagen rota en la portada.
- Crear un proyecto con `fields.categoria = "inventada"` → 201. El export lo omite con aviso y la publicación sale «con avisos».
- Un rótulo de botón de **100.000 caracteres** → 200 y publicado.

**Comportamiento esperado:** en campos de imagen o video, solo rutas locales existentes (o vacío); en la creación, las mismas enumeraciones que en la edición; una longitud máxima razonable por tipo (p. ej. 300 en `text`, 5.000 en `textarea`, 50.000 en `richtext`).

**Impacto:** bajo. Requiere sesión, y la interfaz no ofrece estos valores, pero un error de pegado puede publicar una cabecera rota o un botón gigante.

**Recomendación:** exigir `^/` y existencia para `image`/`video`; reutilizar el bloque de enumeraciones de `updateField` en `createEntry`; añadir `max` por tipo.

**Bloquea producción:** No.

### [BAJO] B-02 — Un `.md` ajeno en `src/content/` bloquea todas las publicaciones y el mensaje no dice cuál es

**Área:** Publicación / UX

**Ubicación:** `cms/services/publishService.ts` (`explicarFalloDePublicacion`: el detalle no incluye el archivo); `cms/services/exportService.ts` (por diseño no poda archivos que el CMS no conoce).

**Evidencia:** con `src/content/proyectos/zz-roto.md` (`categoria: nope`), la publicación da **422** «Una ficha tiene un dato que el sitio no acepta (categoria: Invalid option…)». `dist/` queda intacto (bien), pero no se nombra el archivo, y la persona editora no puede arreglarlo desde el panel.

**Comportamiento esperado:** nombrar el archivo o la ficha («proyectos/zz-roto.md no pertenece al CMS; avisa a quien administra el sitio»).

**Impacto:** bajo. Solo ocurre con una intervención manual en el servidor.

**Recomendación:** extraer de la salida de Astro la ruta del archivo (la línea `src/content/…` que acompaña al error) y añadirla al mensaje; si es un archivo sin ficha, decirlo.

**Bloquea producción:** No.

### [BAJO] B-03 — Dos archivos de pruebas unitarias fallan en un clon limpio

**Área:** Testing

**Ubicación:** `src/test/csp-headers.test.ts:25-30` (lee `dist/_headers` dentro del `describe` antes de que `skipIf` lo salte); `cms/test/urlsCanonicas.test.ts` («P3-03: caché y HEAD», sirve el `dist/` real).

**Evidencia:** `npx vitest run` en un clon recién hecho da **499/501**, con `ENOENT: … 'dist/_headers'` y un 404 en `/robots.txt`. En CI pasan porque el job compila antes.

**Recomendación:** mover la lectura dentro de un `beforeAll` o del `it`, y montar un `dist` mínimo temporal en `urlsCanonicas` (como ya hace el resto del archivo).

**Bloquea producción:** No.

### [BAJO] B-04 — El resumen de publicación muestra ids técnicos de las fichas borradas

**Área:** CMS / UX

**Ubicación:** `cms/services/pendingService.ts` (`resumirCambios`: si la entrada ya no existe, el título cae al id).

**Evidencia:** tras borrar dos fichas, el panel «Publicar cambios» lista «pagina.y — Entrada eliminada» y «proyectos.auditoria-prueba — Entrada eliminada».

**Recomendación:** tomar el título del snapshot de deshacer que ya guarda el evento `entry.delete` (`data.undo.snapshot.entry.title`).

**Bloquea producción:** No.

### [BAJO] B-05 — El build público lleva 47 atributos `data-cms-*`, y la documentación dice que ninguno

**Área:** Frontend / Seguridad (informativo)

**Ubicación:** `dist/` compilado con `PUBLIC_ENABLE_CMS=0`: `data-cms-tarjeta-enlace` (24), `data-cms-video-field` (20), `data-cms-fondo` (2) y `data-cms-sobre-fondo` (1), en 21 páginas. Frente a `docs/SECURITY.md` («`e2e/build-gate.spec.ts` comprueba que `dist/` no lleve marcas del CMS»).

**Impacto:** ninguno funcional. No revelan nada ni cargan el editor. Solo es una afirmación inexacta y un gate que no cubre estos nombres.

**Recomendación:** emitirlos solo con `PUBLIC_ENABLE_CMS=1`, o ajustar la documentación y el gate a lo que realmente se garantiza (sin `data-cms-entry`, sin overlay, sin API).

**Bloquea producción:** No.

### [BAJO] B-06 — npm 11 avisa de que los scripts de instalación de `better-sqlite3` y `esbuild` no están aprobados

**Área:** Dependencias / Deploy

**Ubicación:** `package.json` (sin `allowScripts`); `.npmrc`.

**Evidencia:** `npm ci` (npm 11.19) muestra «4 packages have install scripts not yet covered by allowScripts: better-sqlite3@12.10.0 (install: prebuild-install || node-gyp rebuild) · esbuild@0.28.1…». Hoy se ejecutan igual (el binario se genera y carga). Si una versión futura de npm los bloquea por defecto, `npm ci` en el VPS dejará `better-sqlite3` sin binario y el servicio no arrancará.

**Recomendación:** aprobarlos explícitamente (`npm install-scripts approve better-sqlite3 esbuild` o `allowScripts` en `package.json`) y fijar la versión de npm del VPS.

**Bloquea producción:** No.

### [BAJO] B-07 — Nombres de archivo subidos poco legibles

**Área:** CMS

**Ubicación:** `cms/services/mediaService.ts` (`safeFilename`).

**Evidencia:** `ñandú ü (1) <x>.JPG` → `n-andu-u-1-x-jpg-Z5U4iFc8.jpg`. La `ñ` se parte en «n-» por `NFKD` sin quitar los diacríticos, y la extensión en mayúsculas no se recorta del nombre. Es seguro (sin traversal y con sufijo único), solo feo en la biblioteca.

**Recomendación:** quitar los diacríticos (`.replace(/\p{M}/gu, '')`) antes de sustituir y recortar la extensión sin distinguir mayúsculas.

**Bloquea producción:** No.

### [BAJO] B-08 — Documentación y configuración con datos desfasados

**Área:** Mantenimiento

**Evidencia:**

- `README.md` pide «Node.js (v18 o superior)», pero `engines` exige ≥ 22.12.
- La tabla del README dice que `CMS_PUBLISH_CHECK_COMMAND` es `npm run build`; el código y el ejemplo usan `build:log`.
- El paso 5 del README aún habla de «Exportar» como acción del editor.
- Describe el límite de acceso como «bloqueo persistente» (ver M-06).
- La CI usa Node 22 y el VPS, Node 24.
- `npm run format:check` marca 15 archivos.

**Recomendación:** corregir el README, alinear la CI con la versión del VPS (o probar ambas) y pasar Prettier una vez.

**Bloquea producción:** No.

### [BAJO] B-09 — La rotación de respaldos también borra las copias «antes-de-sync»

**Área:** Persistencia

**Ubicación:** `cms/services/backupService.ts` (`listBackups` toma cualquier `*.sqlite`; `rotar` conserva 20).

**Evidencia:** `scripts/sync-datos-vps.sh` guarda `backups/antes-de-sync-<fecha>-hidromont-cms.sqlite`. Ese nombre entra en la rotación, así que la copia que protege frente a una sincronización equivocada desaparece tras 20 respaldos.

**Recomendación:** rotar solo `hidromont-cms-*.sqlite`.

**Bloquea producción:** No.

## 9. Oportunidades de mejora

- **O-01 — Papelera de fichas.** Hoy borrar una ficha se puede deshacer durante **12 s** (`expiresInMs: 12000`); después solo queda el respaldo. Una lista «Borradas recientemente» (30 días) con los snapshots que ya guarda `audit_events` daría tranquilidad a una persona no técnica.
- **O-02 — Prueba E2E de publicación real.** Un único test que publique desde el panel con el comando real (`build:log` en un directorio temporal) y compruebe el HTML servido por host. Es la prueba de mayor retorno, porque hoy la suite fija `CMS_PUBLISH_CHECK_COMMAND=false` (`scripts/e2e-cms-sandbox.mjs:133`).
- **O-03 — Aviso del último respaldo en «Administrar»** (fecha y tamaño), para que la persona editora vea que su trabajo está a salvo.
- **O-04 — Poda de `audit_events` y `revisions`.** Hoy son pequeñas (3.369 eventos y 1 MB de revisiones en la copia), pero crecen sin límite.
- **O-05 — Refactor del overlay** (`events.js` 1.453 líneas, `styles.js` 2.144) en rama aparte, como ya estaba previsto. No bloquea nada.

## 10. CMS

- **Edición:** muy buena para una persona no técnica. Se verificó en el navegador:
  - clic sobre el texto → panel con miga de pan legible («Portada — cabecera › Título»), «Revisiones», «Vaciar este texto» y «Detalles técnicos» plegados;
  - «Cambios sin guardar» al teclear;
  - cerrar con cambios pide confirmación y guarda una copia local recuperable;
  - recargar con cambios dispara el aviso del navegador.
- **Persistencia:** guardar escribe en SQLite con revisión y bloqueo optimista en el editor de campo (409 verificado). Al recargar, lo guardado aparece en la página **marcado como sin publicar**. Las fichas de colección se guardan sin control de versión (M-05).
- **Publicación:** resumen previo con la lista de cambios y el destino («Se actualizará hidromontchile.cl»), avance con reloj y resultado en palabras («Listo: el sitio está actualizado · tardó 15 s»). La barra pasa de «4 cambios sin publicar» a «Sitio actualizado» y el sitio público muestra el cambio.
- **Errores:** los de publicación están bien traducidos (422 «Una ficha tiene un dato…», 409 «en curso», 504 «tardó demasiado»). Los de subida no (M-01), y el corte de conexión se presenta como fallo (M-02).
- **Facilidad de uso:** los seis estados que se pedían distinguir existen y se nombran bien:

  | Estado               | Cómo se ve                                     |
  | -------------------- | ---------------------------------------------- |
  | Editando             | «Cambios sin guardar.»                         |
  | Guardado             | «Todo guardado.»                               |
  | Cambios pendientes   | «N cambios sin publicar» en la barra           |
  | Publicando           | Panel bloqueado con reloj                      |
  | Publicado            | «Sitio actualizado»                            |
  | Error de publicación | «No se pudo completar» y «No se pudo publicar» |

  La única ambigüedad es la de M-02.

- **Confiabilidad:** alta en el camino normal y ante fallos del build o del proceso. Media ante un corte de red y ante dos editores en la misma ficha.

## 11. Seguridad

Postura buena para el tamaño del proyecto.

**Verificado en esta auditoría:**

- sin sesión, 401; sin CSRF, 403;
- cookie `HttpOnly`, `SameSite=Lax`, `__Host-`/`Secure` con HTTPS y caducidad por inactividad de 24 h;
- bcrypt coste 12 con hash ficticio contra la enumeración de usuarios;
- el arranque en producción se niega si hay una cuenta con la contraseña por defecto (visto al arrancar con la base local: «1 cuenta(s) con la contraseña por defecto»);
- `/.env`, `/cms/data/*.sqlite`, `/_headers`, `/_redirects`, `/package.json`, `/server.mjs` y las variantes con `../` o `%2e%2e` devuelven 404;
- en `hidromontchile.cl`, `/api/cms/*` devuelve 404, también en producción;
- el HTML de producción no carga el editor.

**Subidas:**

- tipo comprobado por el contenido real;
- re-codificación con sharp, que aplica la orientación EXIF y descarta los metadatos (GPS);
- límite de 50 MP: una PNG de 144 MP se rechazó;
- 8 MB para fotos y 60 MB para videos;
- SVG saneado y convertido a PNG.

**XSS:**

- texto con `<script>`, comillas y `ñ` → escapado;
- cuerpo Markdown con `<script>`, `<iframe>`, `javascript:` y frontmatter incrustado → sin HTML crudo en `dist/`;
- CSP con hashes y `upgrade-insecure-requests`.

**Riesgos que quedan:**

- límite de intentos de acceso débil (M-06);
- formulario de contacto expuesto (M-03);
- el servicio corre como **root** con `ProtectSystem=full`. Es una decisión del propietario, documentada; se mantiene como riesgo aceptado: un fallo explotable en el CMS o en libvips comprometería la máquina entera.

`npm audit`: **0 vulnerabilidades**.

## 12. Publicación e integridad

**Flujo real verificado:**

```text
Editor (editor.hidromontchile.cl, dist-editor/ + overlay)
 → PATCH /api/cms/entries/:id/fields/:key   (zod + reglas por tipo + expectedVersion)
 → SQLite (transacción: campo + versión + revisión) + audit_events
 → «Publicar» → POST /api/cms/publish        (cerrojo en el proceso: 409 si hay otro)
   → exportGallery()  → src/data/gallery.json      (guarda por id; escribe .tmp y renombra)
   → exportContent()  → src/data/cms-content.json + src/content/**/*.md
                        (omite y avisa fichas inválidas; derivados WebP con sharp)
   → pruneOrphanDerivatives()
   → npm run build:log (.build.lock entre procesos)
       astro check → astro build (dist.nuevo, PUBLIC_ENABLE_CMS=0) → CSP
                   → astro build (dist-editor.nuevo, =1)           → CSP
       → si ambos tienen index.html: rename dist→dist.anterior, dist.nuevo→dist (ídem editor)
   → refreshPublicSecurityHeaders()
 → Fastify sirve dist/ a hidromontchile.cl y dist-editor/ a editor.* (sin reiniciar)
```

**Fuente de verdad:** en el servidor, la **base SQLite**. `src/data/*.json` y `src/content/*.md` son una proyección que se regenera al publicar y al desplegar (`deploy-vps.sh` los respalda, descarta y reexporta). En local, el repositorio y la base divergen de forma natural (M-04). Mientras nadie edite archivos a mano en el servidor, la divergencia no llega al público.

**Dónde se probó a romperlo:**

| Escenario                                 | Resultado                                                                                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build fallido (`.md` inválido)            | 422 con mensaje, `dist/` intacto (misma fecha), `dist.nuevo` borrado                                                                                           |
| Doble publicación / publicar + exportar   | 409 inmediato; la primera termina bien                                                                                                                         |
| Proceso matado a mitad del build          | `dist/` intacto; queda `.build.lock` huérfano; al arrancar, el trabajo pasa a `failed` («crashed») y la siguiente publicación retoma el cerrojo y termina bien |
| Ficha con categoría inválida              | Omitida con aviso; el resto se publica («Publicado, con avisos»)                                                                                               |
| Contenido con HTML, comillas, `ñ`, saltos | Publicado y escapado correctamente                                                                                                                             |

**Dónde pueden producirse inconsistencias:**

1. El export escribe varios archivos uno a uno. Si sharp o el disco fallan a mitad, `src/` queda parcialmente actualizado, pero **no se compila**, así que el público no lo ve; la siguiente publicación lo completa.
2. Un corte de conexión hace que el panel diga lo contrario de lo ocurrido (M-02).
3. El despliegue durante una publicación, y el export del despliegue antes de la siembra (M-04).
4. El guardado de fichas sin versión (M-05).
5. El sitio puede quedar «publicado» con una ficha omitida; se avisa, pero no bloquea.

**Rollback:** no hay rollback del build (se borra `dist.anterior`). Hay deshacer por campo o ficha (revisiones) y respaldos de la base. Para este proyecto basta: publicar una revisión anterior es el rollback. El riesgo real es el de A-01, no la falta de un rollback de build.

## 13. Testing

- **Existentes:** 61 archivos Vitest (`cms/test/`, `src/test/`, 501 casos) y 43 specs de Playwright (233 casos): overlay, colecciones, galería, subidas, encuadre, revisiones, deshacer, sesión, doble envío, publicación (resumen), a11y, CSP, URLs canónicas, responsive, formulario.
- **Ejecutados:**

  | Suite               | Resultado                                         | Detalle                              |
  | ------------------- | ------------------------------------------------- | ------------------------------------ |
  | Vitest, clon limpio | 499 / 501                                         | 2 fallos por falta de `dist/` (B-03) |
  | Playwright Chromium | **229 pasadas, 4 omitidas, 0 fallidas** (3,1 min) | como el job `e2e-full` de CI         |

- **Flujos críticos no cubiertos:**
  - **publicación real con build** (la suite E2E usa `CMS_PUBLISH_CHECK_COMMAND=false`);
  - corte de conexión durante la publicación;
  - estado HTTP de los rechazos de subida (M-01);
  - dos editores en la misma ficha (M-05);
  - despliegue con base anterior al código (M-04);
  - restauración desde respaldo.
- **Falsa confianza:** los E2E corren contra `astro dev`, no contra el `dist/` servido por host. La separación público/editor la cubren pruebas unitarias (`perfilesDelSitio.test.ts`) y el build-gate, no un E2E por dominio. «Publicar» en E2E solo se prueba hasta el resumen o con un comando que falla a propósito.
- **Tests de mayor retorno a añadir:**
  1. E2E de publicación real (O-02).
  2. Rechazos de subida por HTTP (M-01).
  3. Conflicto de versión al guardar una ficha (M-05).
  4. Script de restauración ensayado en CI con una base de ejemplo (A-01).

## 14. Resultados técnicos

| Comprobación    | Resultado | Detalle                                                                                                                                                     |
| --------------- | :-------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instalación     |    ⚠️     | `npm ci` en un clon limpio: correcto (840 paquetes, 4 s con caché), módulos nativos cargan. Aviso de npm 11 por scripts de instalación no aprobados (B-06). |
| TypeScript      |    ✅     | `astro check`: 0 errores, 0 warnings, 37 hints (en la corrida del build, 51, por `dist-editor`, M-07). `npm run lint`: sin errores.                         |
| Build público   |    ✅     | `npm run build:log` con dos perfiles: correcto en 12,9 s, 17 KB de salida; `dist/` sin overlay ni `/api`.                                                   |
| Build editor    |    ✅     | `dist-editor/` con overlay (8.674 marcas `data-cms-*`), servido solo en `editor.*`.                                                                         |
| Vitest          |    ⚠️     | 499/501; los 2 fallos son de entorno (sin `dist/`), no del producto (B-03).                                                                                 |
| Playwright      |    ✅     | 229 pasadas, 4 omitidas, 0 fallidas.                                                                                                                        |
| CMS             |    ✅     | Login, edición, validaciones, subidas, revisiones y borrado con deshacer, probados por API y por navegador. Rechazos de subida como 500 (M-01).             |
| Publicación E2E |    ✅     | 5 publicaciones reales por API y 1 desde la interfaz, todas correctas; fallos y caídas recuperados. Sin prueba automatizada que compile (O-02).             |

**Comandos ejecutados (resumen):**

- `npm ci`, `npm run lint`, `npm run format:check` (15 avisos), `npm run check`, `npx vitest run` y `npm audit` (0).
- `npm run cms:export` sobre una copia de la base, seguido de `npm run build:log`.
- `NODE_ENV=production node server.mjs`: la guarda rechazó la cuenta por defecto; tras quitarla, arrancó.
- Llamadas a la API con curl y fetch: login, edición, casos límite, subidas, publicación, concurrencia, caída y build roto.
- `npm run build && CI=1 npx playwright test --project=chromium`.
- Tres recorridos de Playwright por la interfaz del editor y del sitio (1440, 820 y 390 px). Nota de método: el script reescribía la CSP de los documentos con `route.fetch()`, que resuelve DNS fuera del navegador. Por eso el **HTML** de esas páginas llegó de producción (GET de solo lectura), mientras que la API del CMS y los recursos fueron a la copia local. Ninguna escritura llegó a producción: el login, el guardado y la publicación son `fetch` del panel. En la práctica, las comprobaciones de desbordes y de imágenes del sitio público se hicieron sobre el HTML real de producción: 0 desbordes horizontales en 10 páginas × 3 anchos, y las únicas imágenes «vacías» son el `<img>` del visor antes de abrirlo. El resultado de la publicación desde la interfaz se confirmó con curl contra la copia local.
- GET de solo lectura contra producción: `/`, `/api/cms/health` en ambos hosts, `robots.txt`, sitemap, `/_headers`, `/.env`, www y http.

## 15. Funcionalidades faltantes

### Antes de producción

- Respaldo automático fuera del servidor (base + `uploads/cms`) con restauración documentada y ensayada (A-01).

### Post lanzamiento

- Monitor de disponibilidad y aviso de fallos de publicación (M-07).
- Estado de publicación que sobreviva a un corte o una recarga (M-02).
- Mensajes claros en los rechazos de subida (M-01).
- Control de versión al guardar fichas (M-05).
- Endurecer el formulario de contacto (M-03) y el límite de acceso (M-06).
- Despliegue coordinado con el panel (M-04).

### Opcionales

- Papelera de fichas (O-01).
- Aviso del último respaldo en el panel (O-03).
- Poda de históricos (O-04).
- Refactor del overlay (O-05).

## 16. Plan de acción priorizado

| Prioridad | Acción                                                                                               | Severidad | Esfuerzo | Impacto | Bloquea producción |
| --------: | ---------------------------------------------------------------------------------------------------- | --------- | -------- | ------- | ------------------ |
|         1 | Respaldo diario fuera del VPS de la base y `uploads/cms` + restauración escrita y ensayada           | ALTO      | S        | Alto    | Sí                 |
|         2 | Monitor externo de `/` y `/api/cms/health` + aviso de publicación fallida (Sentry o correo)          | MEDIO     | XS       | Alto    | No                 |
|         3 | Rechazos de subida como 400 con mensaje (SVG, video, JPEG dañado) + prueba HTTP                      | MEDIO     | XS       | Medio   | No                 |
|         4 | Panel: consultar el trabajo tras un corte y al arrancar; `beforeunload` durante la publicación       | MEDIO     | S        | Medio   | No                 |
|         5 | Bloqueo progresivo de acceso por IP y por cuenta; mínimo de 12 en `.env` y `reset-password`          | MEDIO     | S        | Medio   | No                 |
|         6 | `deploy-vps.sh`: abortar si hay una publicación en curso; exportar con la reconciliación de arranque | MEDIO     | S        | Medio   | No                 |
|         7 | Formulario: alias de FormSubmit, captcha en el envío nativo y quitar los correos del HTML            | MEDIO     | XS       | Medio   | No                 |
|         8 | Guardado de ficha con `expectedVersion` (o un `PATCH` transaccional)                                 | MEDIO     | S        | Medio   | No                 |
|         9 | E2E de publicación real (export → build → HTML servido por host)                                     | OPORT.    | M        | Alto    | No                 |
|        10 | `tsconfig` excluye `dist-editor`; recortar y podar los logs de `publish_jobs`                        | MEDIO     | XS       | Bajo    | No                 |
|        11 | Validación de campos de imagen, enumeraciones al crear, longitudes máximas                           | BAJO      | S        | Bajo    | No                 |
|        12 | Aprobar los scripts de instalación de npm; alinear Node en CI y VPS                                  | BAJO      | XS       | Bajo    | No                 |
|        13 | Nombre del archivo en el error de build; títulos de las fichas borradas en el resumen                | BAJO      | XS       | Bajo    | No                 |
|        14 | Tests herméticos (`csp-headers`, `urlsCanonicas`); Prettier; README; rotación de respaldos           | BAJO      | XS       | Bajo    | No                 |
|        15 | Papelera de fichas; aviso del último respaldo                                                        | OPORT.    | M        | Medio   | No                 |

## 17. Qué NO cambiar

- **La arquitectura:** un proceso Node que sirve el estático y la API, con SQLite, detrás de Caddy. Para una persona editando y ~30 páginas es la opción correcta. No hacen falta colas, Redis ni contenedores.
- **El build atómico** de `build-con-registro.mjs`: compila en `*.nuevo`, sustituye solo si hay `index.html` y protege con un cerrojo entre procesos que detecta PID muertos. Probado con un build roto y con el proceso matado.
- **Los dos perfiles de build y la selección por host** (`distParaHost`, `apiFueraDeEsteHost`). Funcionan en local y en producción.
- **La descarga de trabajos colgados al arrancar** (`reapStaleJobs(…, 0)`) y el cerrojo en el proceso con 409.
- **La guarda de la galería por id** (P0-01 corregido): se publicó varias veces sin bloqueos.
- **Las guardas de arranque** (contraseña por defecto en `.env` y en la base, cookie insegura en un host expuesto, subidas dentro de `public/`).
- **La validación de subidas por contenido y la re-codificación con sharp**; el saneado de Markdown con `rehypeSinHtml`; la CSP con hashes recalculados.
- **La traducción de fallos de publicación a mensajes** (`explicarFalloDePublicacion`) y los estados de la barra. Son exactamente lo que necesita una persona no técnica.
- **Revisiones, deshacer, borradores locales y confirmaciones** del overlay.
- **El script de despliegue:** sus comprobaciones previas (commit empujado, cambios fuera del export, contador de reinicios, portada 200) son buenas. Solo le falta la coordinación de M-04.

## 18. Conclusión

El sitio y el CMS están bien construidos y **publicar es confiable**. Se intentó romperlo de varias formas y el sitio público nunca quedó vacío, a medias ni con el editor expuesto. Lo que separa al proyecto de estar realmente listo para producción no es el código de publicación, sino la operación alrededor:

1. poder **recuperar todo** si el VPS se pierde (hoy no se puede: no hay copia externa ni de la base ni de las fotos originales);
2. **enterarse** cuando algo falla;
3. unos pocos ajustes de robustez y UX (M-01 a M-07) para que la persona que edita nunca vea un «inténtalo de nuevo» que no sirve, ni un «no se pudo publicar» que no es cierto.

Con A-01 resuelto, el proyecto pasa a ser un lanzamiento viable sin reservas. Con M-01, M-02 y M-07 también resueltos, la puntuación rondaría los 85 puntos.

**Production Readiness: 75/100**
**Nota: 5,0 / 7,0**
**Estado: Casi preparado para producción**
