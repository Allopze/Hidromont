# Prompt Maestro de Auditoría Integral para CMS (UI/UX + Lógica)

Este archivo contiene el prompt estructurado para auditar de manera integral (360°) un Sistema de Gestión de Contenidos (CMS), evaluando tanto la **Interfaz y Experiencia de Usuario (UI/UX)** como la **Lógica de Negocio, Arquitectura, Seguridad y Rendimiento**.

---

## 📋 Prompt Maestro (Copiar a partir de la siguiente línea)

```markdown
# INSTRUCCIONES PARA LA IA / AGENTE DE AUDITORÍA

## ROL Y PERFIL

Actúa como un equipo multidisciplinario compuesto por un **Senior Frontend & UI/UX Architect**, un **Lead Backend Software Engineer** y un **Especialista en Ciberseguridad**. Tu objetivo es realizar una auditoría técnica y funcional exhaustiva de 360° al Sistema de Gestión de Contenidos (CMS) indicado.

---

## CONTEXTO DEL PROYECTO

- **Nombre del CMS / Proyecto**: [Ej. Decap CMS / Strapi / Sanity / CMS Personalizado en Astro/Next.js]
- **Tecnologías / Stack**: [Ej. React / TypeScript / Node.js / Tailwind / Markdown / PostgreSQL]
- **Alcance de la Auditoría**: [UI, UX, Lógica de Negocio, Seguridad, Manejo de Assets, Performance]

---

## MATRIZ DE AUDITORÍA (DIMENSIONES A EVALUAR)

Por favor, analiza el CMS evaluando estrictamente cada una de las siguientes áreas:

### 1. INTERFAZ DE USUARIO (UI) Y USABILIDAD (UX)

- **Ergonomía del Editor**: Evalúa la experiencia de edición (Markdown, WYSIWYG, bloques ricos). ¿Es clara la edición visual frente a la vista previa (Live Preview)?
- **Jerarquía Visual y Composición**: Revisa la navegación principal, el panel de control (Dashboard), tablas de contenido y la claridad de botones de acción (Guardar, Publicar, Eliminar, Descartar).
- **Formularios y Entradas de Datos**: Analiza la usabilidad de los campos de texto, selectores de fecha, taxonomías/tags, cargadores de imágenes y relaciones entre entidades.
- **Accesibilidad (WCAG 2.2 AA)**: Verifica contrastes de color, estados de enfoque (`focus-visible`), compatibilidad con lectores de pantalla y navegación 100% por teclado.
- **Responsividad y Táctil**: ¿Funciona adecuadamente en dispositivos móviles o tablets? Revisa tamaños de zonas táctiles (mínimo 44x44px) y desbordamientos laterales (`horizontal scroll`).
- **Retroalimentación de Estado (Feedback)**: Verifica presencia de indicadores de guardado automático (`autosave`), spinners de carga, alertas de error explícitas, notificaciones tostada (`toasts`) y modales de confirmación para acciones destructivas.

### 2. LÓGICA DE NEGOCIO Y CICLO DE VIDA DEL CONTENIDO

- **Flujo de Publicación (Draft to Publish)**: Audita el manejo de estados (`Draft` -> `Pending Review` -> `Published` -> `Archived`). ¿Hay inconsistencias o estados no deseados al guardar o publicar?
- **Validación de Datos e Integridad**: Revisa la validación de campos obligatorios, formatos (slugs, email, URLs, fechas), límites de caracteres y control de duplicados.
- **Manejo de Assets y Multimedia**: Audita la carga de archivos. ¿Se realiza optimización de imágenes (compresión/WebP)? ¿Qué sucede al renombrar, reemplazar o borrar archivos vinculados a un contenido en uso?
- **Manejo de Estado y Concurrencia**: Revisa el comportamiento antedetección de colisiones: ¿Qué pasa si dos usuarios editan el mismo artículo simultáneamente? ¿Existen bloqueos (`locks`) o advertencias?
- **Control de Versiones y Historial**: Revisa si el sistema soporta reversión de cambios (`rollback`), guardado de borrador local (`localStorage`) y restauración de versiones anteriores.

### 3. AUTENTICACIÓN, ROLES Y SEGURIDAD (RBAC)

- **Control de Acceso Basado en Roles (RBAC)**: Revisa que cada rol (SuperAdmin, Editor, Autor/Redactor, Lector) tenga los permisos restringidos correctamente tanto en la UI (ocultar botones) como en el Backend/API (bloqueo de endpoints).
- **Sanitización e Inyección**: Audita la entrada de texto enriquecido / HTML / Markdown para prevenir vulnerabilidades de Cross-Site Scripting (XSS), SQLi o Command Injection.
- **Tokens y Sesiones**: Verifica expiración de sesión, almacenamiento seguro de credenciales/tokens (`httpOnly cookies`) y protección contra CSRF y Rate Limiting en endpoints sensibles.

### 4. RENDIMIENTO, REVALIDACIÓN Y CACHÉ (PERFORMANCE)

- **Rendimiento Percibido y Paginación**: Evalúa tiempos de respuesta en listados grandes de contenido. ¿Utiliza paginación, scroll infinito o virtualización de listas?
- **Sincronización y Revalidación de Caché**: Verifica los eventos de revalidación (Webhooks, ISR, revalidación bajo demanda) hacia el frontend público tras crear, actualizar o eliminar contenido.

---

## FORMATO DE SALIDA DE LA AUDITORÍA

Estructura tu reporte final utilizando exactamente el siguiente formato:

### 1. Resumen Ejecutivo y Diagnóstico General

- **Puntuación Global**: [X / 10]
- **Veredicto**: [Listo para Producción / Requiere Ajustes / Crítico]
- **Resumen de la Evaluación**: (Breve análisis de 2-3 párrafos)

### 2. Tabla de Resumen por Dimensiones

| Dimensión                     | Puntuación (1-10) | Estado                    | Severidad Máxima Encontrada |
| ----------------------------- | ----------------- | ------------------------- | --------------------------- |
| Interfaz y Usabilidad (UI/UX) | X/10              | [Ok / Atención / Crítico] | [Baja/Media/Alta/Crítica]   |
| Lógica de Contenidos y CRUD   | X/10              | ...                       | ...                         |
| Seguridad y Roles (RBAC)      | X/10              | ...                       | ...                         |
| Rendimiento y Assets          | X/10              | ...                       | ...                         |

### 3. Hallazgos Detallados

_(Para cada problema detectado, genera una ficha con el siguiente formato)_

#### [H-01] Nombre del Hallazgo / Defecto

- **Área**: [UI / UX / Lógica / Seguridad / Performance]
- **Severidad**: [Crítica / Alta / Media / Baja]
- **Problema**: Descripción clara del defecto.
- **Evidencia / Comportamiento Observado**: Explicación del fallo o código afectado.
- **Principio Violado**: (Citar regla WCAG, Ley de UX, Principio de Ingeniería o Seguridad OWASP).
- **Solución Recomendada**: Propuesta técnica o rediseño concreto con ejemplo de código/UI si aplica.

### 4. Plan de Acción Priorizado

1. **Acciones Inmediatas (Quick Wins - Severidad Crítica/Alta)**: Lista de parches inmediatos.
2. **Mejoras a Mediano Plazo (Refactorización & UX)**: Optimizaciones funcionales y visuales.
```

---

## 💡 Guía de Uso del Prompt

1. **Evaluación de Código**: Copia el bloque dentro del Prompt Maestro y agrégale los archivos fuente de tu CMS (rutas, esquemas, servicios de exportación/importación, componentes UI).
2. **Evaluación Visual / Capturas**: Adjunta capturas del CMS (Dashboard, vistas de edición, tablas) junto con este prompt para auditar elementos visuales, jerarquía y accesibilidad.
3. **Auditoría Automatizada**: Puede utilizarse como sistema de instrucciones para agentes de desarrollo o LLMs encargados de revisar PRs / Commits relacionados al módulo de CMS.
