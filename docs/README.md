# Documentación

Documentación técnica del proyecto **Hidromont Chile — Sitio web + CMS**.

## Guías

| Documento                                                            | Descripción                                                                                                          |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                               | Arquitectura real: VPS, dos perfiles de build, sitio, editor, API, publicación y pruebas.                            |
| [`CMS-GUIDE.md`](./CMS-GUIDE.md)                                     | Cómo editar contenido con el CMS visual: arranque, overlay, publicación, medios, galería, backup.                    |
| [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md)                             | Sistema de diseño: tokens (colores, tipografía, spacing, radius, motion, z-index), componentes, l10n, accesibilidad. |
| [`SECURITY.md`](./SECURITY.md)                                       | Modelo de amenazas, medidas, cabeceras, formulario, auditoría y credenciales.                                        |
| [`DESPLIEGUE-VPS.md`](./DESPLIEGUE-VPS.md)                           | Despliegue en el VPS (Caddy + systemd), sincronización de datos y recuperación.                                      |
| [`historico/DESPLIEGUE-CPANEL.md`](./historico/DESPLIEGUE-CPANEL.md) | Histórico: el despliegue antiguo en cPanel.                                                                          |

## Auditorías y registros

| Documento                                                                          | Descripción                                                                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [`AUDITORIA_LOGICA_UIUX.md`](./AUDITORIA_LOGICA_UIUX.md)                           | Auditoría de lógica/funcionalidad + UI/UX (nota 9/10 tras remediación). Registro completo de hallazgos y fixes. |
| [`auditorias/AUDITORIA_PRODUCCION.md`](./auditorias/AUDITORIA_PRODUCCION.md)       | Auditoría de producción previa (nota 7/10, hallazgos H1/H2).                                                    |
| [`auditorias/AUDITORIA_VISUAL.md`](./auditorias/AUDITORIA_VISUAL.md)               | Auditoría visual/UI inicial.                                                                                    |
| [`auditorias/AUDITORIA_UI_UX.md`](./auditorias/AUDITORIA_UI_UX.md)                 | Auditoría UI/UX histórica frente a las directivas de diseño.                                                    |
| [`auditorias/INFORME-AUDITORIA-UX-UI.md`](./auditorias/INFORME-AUDITORIA-UX-UI.md) | Informe de auditoría UX/UI y seguimiento de correcciones.                                                       |

## Proyectos y referencias

| Documento                                                                                                                        | Descripción                                                               |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [`proyectos/gasco/ANALISIS-GASCO.md`](./proyectos/gasco/ANALISIS-GASCO.md)                                                       | Inventario y análisis de la documentación técnica de los proyectos GASCO. |
| [`referencias/empresa/Presentación HIDROMONT CHILE S.A..pdf`](./referencias/empresa/Presentación%20HIDROMONT%20CHILE%20S.A..pdf) | Catálogo corporativo de Hidromont Chile.                                  |
| [`referencias/README.md`](./referencias/README.md)                                                                               | Índice de catálogos y documentación técnica de respaldo.                  |

## Documentos de trabajo

| Documento                                                                                                | Descripción                                                                    |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`trabajo/PRODUCT.md`](./trabajo/PRODUCT.md)                                                             | Definición de producto: usuarios, personalidad de marca, principios de diseño. |
| [`trabajo/hidromont_contenido_web_por_secciones.md`](./trabajo/hidromont_contenido_web_por_secciones.md) | Contenido del sitio organizado por secciones (insumo editorial).               |
| [`trabajo/PROMPT_AUDITORIA_CMS.md`](./trabajo/PROMPT_AUDITORIA_CMS.md)                                   | Prompt maestro para auditorías integrales del CMS.                             |
| [`trabajo/PROMPT_AUDITORIA_LOGICA_UIUX.md`](./trabajo/PROMPT_AUDITORIA_LOGICA_UIUX.md)                   | Prompt que guio la auditoría de lógica + UI/UX.                                |
| [`trabajo/verificacion_catalogos.md`](./trabajo/verificacion_catalogos.md)                               | Contraste editorial del sitio contra los catálogos originales.                 |

## Material local

| Documento                          | Descripción                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| [`ORIGINALES.md`](./ORIGINALES.md) | Ubicación y uso del material original que se conserva localmente fuera de Git. |

## Punto de partida

- **¿Primera vez con el proyecto?** Lee el [`README.md`](../README.md) de la raíz (instalación, comandos) y luego [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **¿Vas a editar contenido?** [`CMS-GUIDE.md`](./CMS-GUIDE.md).
- **¿Vas a cambiar estilos/componentes?** [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md).
- **¿Pregunta de seguridad?** [`SECURITY.md`](./SECURITY.md).
- **¿Buscas un hallazgo específico o el historial de fixes?** [`AUDITORIA_LOGICA_UIUX.md`](./AUDITORIA_LOGICA_UIUX.md) §7.
