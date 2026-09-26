# Material original y de trabajo

Los insumos originales que no forman parte del sitio publicado se agrupan en
`assets/originales/`. Esta carpeta está ignorada por Git: se conserva en cada
entorno local, pero no viaja al repositorio ni a los paquetes de despliegue.

## Estructura

| Carpeta                                        | Contenido                                                      |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `assets/originales/archivos_hidromont/`        | Catálogos, presentaciones y documentos técnicos de referencia. |
| `assets/originales/GASCO/`                     | Expedientes técnicos y administrativos de los proyectos GASCO. |
| `assets/originales/Pangal/`                    | Fotografías y videos originales del proyecto Pangal.           |
| `assets/originales/Canal Chacayes/`            | Fotografías originales del proyecto Canal Chacayes.            |
| `assets/originales/Dron Rio Colorado/`         | Videos originales de dron.                                     |
| `assets/originales/Fotos_Hidromont_mejoradas/` | Fotografías mejoradas pendientes de curaduría.                 |
| `assets/originales/top/`                       | Selecciones puntuadas que consumen los scripts de curaduría.   |
| `assets/originales/` (raíz)                    | Archivos multimedia sueltos conservados como respaldo.         |

## Scripts que usan estos insumos

- `scripts/historico/curate-images-smart.mjs`
- `scripts/historico/curate-and-optimize-images.mjs`
- `scripts/process-top-photos.mjs`

Los resultados destinados al sitio sí deben terminar en `public/`. El material
original no se sirve directamente, no se copia a `dist/` y no reemplaza a los
assets curados ni al contenido administrado por el CMS.

Si tienes un checkout anterior, mueve sus carpetas de trabajo a
`assets/originales/` antes de ejecutar los scripts de curaduría.
