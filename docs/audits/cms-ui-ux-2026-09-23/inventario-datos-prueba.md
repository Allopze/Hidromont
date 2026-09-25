# Inventario para revisión manual de datos de prueba del CMS

Fecha de revisión: 2026-09-23. Este documento identifica posibles restos de pruebas E2E en la biblioteca editorial antes de cualquier limpieza.

> **Limpieza ejecutada el 2026-09-24**, con aprobación del responsable del sitio. Se eliminaron los 56 candidatos (32 categorías y 24 medios) de la base local; el detalle está en [Limpieza ejecutada](#limpieza-ejecutada).

## Respaldos previos

- Base SQLite: `/Users/allopze/dev/Hidromont Chile/pagina-web/cms/data/backups/hidromont-cms-2026-09-23T15-37-50.sqlite` (generada con `npm run cms:backup` antes de esta implementación; existe en disco).
- Archivos candidatos: `/Users/allopze/dev/Hidromont Chile/pagina-web/cms/data/backups/e2e-synthetic-media-review-2026-09-23` (copia verificada por SHA-256 de cada archivo) y su `manifest.json`.
- El respaldo de SQLite conserva categorías y registros de medios. La copia separada conserva los PNG sintéticos antes de cualquier posible eliminación.

## Estado de la biblioteca al revisar

| Recurso             | Total |                             Candidatos incluidos |
| ------------------- | ----: | -----------------------------------------------: |
| Categorías          |    81 | 32 categorías vacías con nombre generado por E2E |
| Álbumes             |    23 |                          0 con patrón E2E/prueba |
| Registros de medios |  2049 |                                24 PNG sintéticos |
| Ítems de galería    |   177 |       0 relacionados con los candidatos listados |

Las categorías de la tabla tienen cero ítems de galería. Cada medio listado tiene cero ítems de galería y cero usos de contenido. Los álbumes no tienen candidatos con los patrones revisados.

## Categorías candidatas

Los nombres `Prueba <timestamp>` y `Accesible <timestamp>` coinciden con los nombres que crea `e2e/cms-undo.spec.ts`. Se listan para aprobación manual; la coincidencia de nombre por sí sola no autoriza borrado.

| ID                      | Nombre                  | Slug                      | Creado                   | Ítems de galería | Revisión  |
| ----------------------- | ----------------------- | ------------------------- | ------------------------ | ---------------: | --------- |
| `FLPYe9pw2bFv1u0ZTc4Iy` | Prueba 1790085780798    | `prueba-1790085780798`    | 2026-09-22T14:03:00.799Z |                0 | Eliminado |
| `cPB4cvJ2z_Ygjk9fKv7zN` | Accesible 1790085812760 | `accesible-1790085812760` | 2026-09-22T14:03:32.761Z |                0 | Eliminado |
| `QT92JKWd2MtzH-j571szE` | Prueba 1790085852605    | `prueba-1790085852605`    | 2026-09-22T14:04:12.606Z |                0 | Eliminado |
| `h0v_8BbtK-Gq6wsTqWTky` | Accesible 1790085884479 | `accesible-1790085884479` | 2026-09-22T14:04:44.480Z |                0 | Eliminado |
| `CQY4Epw9jej3XMgXPZWTY` | Prueba 1790085902526    | `prueba-1790085902526`    | 2026-09-22T14:05:02.527Z |                0 | Eliminado |
| `4JbJAJ6CPBcQYN67L3MZI` | Accesible 1790085904675 | `accesible-1790085904675` | 2026-09-22T14:05:04.676Z |                0 | Eliminado |
| `0f5KSRUjpAcFurJ6lfDK3` | Prueba 1790085983022    | `prueba-1790085983022`    | 2026-09-22T14:06:23.024Z |                0 | Eliminado |
| `kfPmE6lX4sgDcXKSDhbXE` | Accesible 1790085985123 | `accesible-1790085985123` | 2026-09-22T14:06:25.123Z |                0 | Eliminado |
| `l4IBfx3p4IuJZOAH23tlz` | Prueba 1790086089418    | `prueba-1790086089418`    | 2026-09-22T14:08:09.419Z |                0 | Eliminado |
| `-gwKn2czSX82C4r9sFt4w` | Accesible 1790086091554 | `accesible-1790086091554` | 2026-09-22T14:08:11.555Z |                0 | Eliminado |
| `jpI5N-jSkR5DGJxNBOR3R` | Prueba 1790086187974    | `prueba-1790086187974`    | 2026-09-22T14:09:47.975Z |                0 | Eliminado |
| `l-kShhIrbXjqRSCfMiP0w` | Accesible 1790086190120 | `accesible-1790086190120` | 2026-09-22T14:09:50.121Z |                0 | Eliminado |
| `YIsSZediQRZZ8bdxJmCk8` | Prueba 1790086286015    | `prueba-1790086286015`    | 2026-09-22T14:11:26.016Z |                0 | Eliminado |
| `ZGp596gKdVZj5aFtNYtbW` | Accesible 1790086288197 | `accesible-1790086288197` | 2026-09-22T14:11:28.198Z |                0 | Eliminado |
| `Of2sXkfkmEWWJwPOWXpEL` | Prueba 1790086335206    | `prueba-1790086335206`    | 2026-09-22T14:12:15.207Z |                0 | Eliminado |
| `wMrnCM2ZmSLXQ808FATD7` | Accesible 1790086337328 | `accesible-1790086337328` | 2026-09-22T14:12:17.329Z |                0 | Eliminado |
| `KJtlZwwAg9besitf-E4Vw` | Prueba 1790086341842    | `prueba-1790086341842`    | 2026-09-22T14:12:21.843Z |                0 | Eliminado |
| `_cGVnbeomlEx-03fwMbsJ` | Accesible 1790086343976 | `accesible-1790086343976` | 2026-09-22T14:12:23.977Z |                0 | Eliminado |
| `_oL6alWyhDt_2XRCqazVO` | Prueba 1790086348584    | `prueba-1790086348584`    | 2026-09-22T14:12:28.585Z |                0 | Eliminado |
| `-Fyyt0qhvYhlqmwoDmQgU` | Accesible 1790086350755 | `accesible-1790086350755` | 2026-09-22T14:12:30.756Z |                0 | Eliminado |
| `Vqz1gc8Z7ubGJgD5poSiP` | Prueba 1790089037831    | `prueba-1790089037831`    | 2026-09-22T14:57:17.832Z |                0 | Eliminado |
| `L6CdDx4jOh6fsc-MAUL2V` | Accesible 1790089039893 | `accesible-1790089039893` | 2026-09-22T14:57:19.894Z |                0 | Eliminado |
| `e9Jds5NxmQfg_aW-6RUrc` | Prueba 1790089218715    | `prueba-1790089218715`    | 2026-09-22T15:00:18.716Z |                0 | Eliminado |
| `hpRG1xvxDXJdsyGKIKO-U` | Accesible 1790089221026 | `accesible-1790089221026` | 2026-09-22T15:00:21.027Z |                0 | Eliminado |
| `_AUGdCXemMu7Rzgm5bEsq` | Prueba 1790089969168    | `prueba-1790089969168`    | 2026-09-22T15:12:49.169Z |                0 | Eliminado |
| `IHzdqMXDBvU3SwXDohJ1m` | Accesible 1790089971342 | `accesible-1790089971342` | 2026-09-22T15:12:51.343Z |                0 | Eliminado |
| `c4KQ0y85zo9X3mbFFfu2H` | Prueba 1790135848154    | `prueba-1790135848154`    | 2026-09-23T03:57:28.155Z |                0 | Eliminado |
| `U7mcpWF4Gq42HSJWHxGB5` | Accesible 1790135850470 | `accesible-1790135850470` | 2026-09-23T03:57:30.472Z |                0 | Eliminado |
| `Iq8yG4rmFEPw5sxfbSBq1` | Prueba 1790135950688    | `prueba-1790135950688`    | 2026-09-23T03:59:10.689Z |                0 | Eliminado |
| `VrS7RIXPgZL1nivDZpUJi` | Accesible 1790135953107 | `accesible-1790135953107` | 2026-09-23T03:59:13.108Z |                0 | Eliminado |
| `ZXbXyCZbcFI1QBcJsNEwd` | Prueba 1790136007851    | `prueba-1790136007851`    | 2026-09-23T04:00:07.852Z |                0 | Eliminado |
| `6_YUw2x0J7Cm9JV7DSMKB` | Accesible 1790136010175 | `accesible-1790136010175` | 2026-09-23T04:00:10.176Z |                0 | Eliminado |

## Medios sintéticos candidatos

Los nombres `e2e-synthetic-test-*.png` coinciden con el archivo que sube `e2e/cms-media-upload.spec.ts`. Los archivos físicos están presentes y cada uno mide 70 bytes. Se conservan tanto en la biblioteca original como en el respaldo separado.

| ID                      | Archivo                           | Creado                   | Bytes | Ítems | Usos de contenido | Archivo presente | Revisión  |
| ----------------------- | --------------------------------- | ------------------------ | ----: | ----: | ----------------: | ---------------- | --------- |
| `CAnlS9j_aAnfrFykUtzcD` | `e2e-synthetic-test-oR7inx9d.png` | 2026-09-10T23:31:58.996Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `TNlQYvv9OKi_Vj7cf9Hf_` | `e2e-synthetic-test-A8bYfjd0.png` | 2026-09-10T23:32:35.225Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `7aaSugojADQtHetK7rNCJ` | `e2e-synthetic-test-pChV9N4b.png` | 2026-09-10T23:37:47.765Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `_0XK-3JGI3o0ZKnplDMg_` | `e2e-synthetic-test-hi-9BMSG.png` | 2026-09-11T00:53:23.498Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `XI0mZpasvUGACkWTgwOgR` | `e2e-synthetic-test--QA2YCeg.png` | 2026-09-11T00:57:01.039Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `oSF372YFTm_rngpTzrGjy` | `e2e-synthetic-test-oAhl-hoV.png` | 2026-09-22T01:58:24.555Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `ZEA3SZIXhloh6mHNsnBzL` | `e2e-synthetic-test-7koFOWsW.png` | 2026-09-22T03:20:32.344Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `9icH6cttfvah1en9ilbJ9` | `e2e-synthetic-test-_6LomDON.png` | 2026-09-22T03:21:48.007Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `A7qZuvPhvI6-LtynEi_yN` | `e2e-synthetic-test-45WKCAwz.png` | 2026-09-22T03:26:26.358Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `Wc2vI8XC9v8_R0VI247pM` | `e2e-synthetic-test-s8y8Z3g-.png` | 2026-09-22T03:30:15.239Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `jHvMD9Cmp07iRPDMKSVVf` | `e2e-synthetic-test-kjDWct5E.png` | 2026-09-22T04:03:50.123Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `BEc4yhmw6QZDdhf1srMOi` | `e2e-synthetic-test-K0w7aR2X.png` | 2026-09-22T04:06:55.907Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `LroIE3lAbEIWs5WTYNUvR` | `e2e-synthetic-test-0iIePQ2B.png` | 2026-09-22T04:11:05.891Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `uhZk6WWfSMjZ4xnb4U6yZ` | `e2e-synthetic-test-cL8PZOqy.png` | 2026-09-22T04:49:51.268Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `CVb8F4dhIGrt0Q-w70Iz-` | `e2e-synthetic-test-u8n-GIxd.png` | 2026-09-22T12:45:51.584Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `sBazNp0vL9F7MUrCCMuG1` | `e2e-synthetic-test-BGJOXrwm.png` | 2026-09-22T13:40:09.375Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `dGi1xnrAT-kxKGRlFzS0j` | `e2e-synthetic-test-ybUt00S0.png` | 2026-09-22T13:44:09.440Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `Mh9wx5B4-uhtNqgbLX3kU` | `e2e-synthetic-test-MZmg0Ao0.png` | 2026-09-22T13:45:51.955Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `Ac4abi7tQXy-GoTtXPJxJ` | `e2e-synthetic-test-LcQCx_13.png` | 2026-09-22T14:00:09.953Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `UxWPMYr_-BZrNx4yjmSRN` | `e2e-synthetic-test-RxlVjGNZ.png` | 2026-09-22T14:06:03.864Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `B28P3OYNkultVBB7K5-Nq` | `e2e-synthetic-test-Ozvqdjb1.png` | 2026-09-22T14:07:50.163Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `jrvJcGgy4d6vmHdQl0Z2p` | `e2e-synthetic-test-sXpvk1kF.png` | 2026-09-22T14:11:06.152Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `aGQGh0ODu22xl4VrImNX7` | `e2e-synthetic-test-GeQKYkIe.png` | 2026-09-22T14:59:58.611Z |    70 |     0 |                 0 | Sí               | Eliminado |
| `Fd7jLfTv-dUTuCi1CZFjE` | `e2e-synthetic-test-OzwyvZvI.png` | 2026-09-22T15:12:29.572Z |    70 |     0 |                 0 | Sí               | Eliminado |

## Exclusiones y decisión pendiente

- No aparecieron álbumes candidatos ni ítems de galería huérfanos atribuibles a estos datos.
- `Soldadura de Probeta Testigo de Producción.webp` se excluyó: contiene la palabra “Testigo” por el nombre del producto y no coincide con el prefijo exacto `e2e-synthetic-test-`.
- No se ejecutó ninguna eliminación. El HOLD editorial permanece hasta que una persona revise y apruebe cada candidato y confirme que no pertenece a contenido vigente.

## Limpieza ejecutada

Fecha: 2026-09-24, con aprobación explícita del responsable del sitio.

- **Respaldo previo:** `cms/data/backups/hidromont-cms-2026-09-25T00-46-12.sqlite` (UTC), además del de 09-23. Las 24 copias de `e2e-synthetic-media-review-2026-09-23` se verificaron de nuevo por SHA-256 antes de borrar.
- **Método:** los servicios del CMS (`GalleryService.deleteCategory` y `MediaService.deleteMedia`) sin la opción de forzar, que rechazan cualquier registro en uso. Antes de cada borrado se comprobó otra vez el patrón del nombre, 0 fotos por categoría, 70 bytes y 0 usos por medio. Una simulación previa dio 56 borrables y 0 omitidos.
- **Resultado:** categorías 81 → 49; medios 2049 → 2025; ítems de galería 177 → 177. Las 4 fotos sin categoría ya estaban así antes de la limpieza. Los 24 PNG ya no están en `uploads/cms`. Cada borrado quedó en el registro de actividad con el motivo.
- **Sitio público:** `src/data/gallery.json` y `src/data/cms-content.json` no contenían ninguno de estos registros; el sitio publicado no los mostraba.
- **Pendiente:** esto se hizo en la base local. La base del VPS se preparó a partir de una copia de la local (`npm run cms:preparar-produccion` no filtra datos de prueba), así que puede contener los mismos restos y hay que revisarla allí.
