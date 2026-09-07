# Verificación del sitio contra los catálogos originales

Contraste del contenido publicado con las fuentes primarias de la empresa. Complementa
`matriz_editorial_auditada.md`: donde aquella marcaba "sin respaldo", aquí se indica si el
catálogo lo resolvió.

## Fuentes

| Documento                                                        | Contenido                                                                                          |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `archivos_hidromont/PPTX/2015-05-29 Hidromont - Catalogo 1.pptx` | Catálogo de **Hidromont S.A. (España)**, la matriz. 66 diapositivas                                |
| `archivos_hidromont/PDF/Presentación HIDROMONT CHILE S.A..pdf`   | Catálogo de **Hidromont Chile**, proyectos 1997–2015 con Ø, espesor, toneladas, longitud y cliente |
| `archivos_hidromont/PDF/PROCEDIMIENTO DE MONTAJE CONDORES.pdf`   | Metodología de montaje del blindaje Los Cóndores, Rev.05                                           |
| `archivos_hidromont/PDF/ANEXOS (Rev.05).pdf`                     | Programa de trabajo y PPI de Los Cóndores                                                          |
| `archivos_hidromont/PDF/1750-14-A Calculo Viga Carril.pdf`       | Memoria de cálculo de vigas carril, Los Cóndores                                                   |

Los 4 PDF de la raíz del repo son copias idénticas de `archivos_hidromont/PDF/`.

## Convención de notación

Los catálogos usan **Ø** para tubería forzada, blindajes, piezas especiales y estanques, y
reservan **DN** para válvulas. El sitio había convertido todo a DN por igual. La convención
del catálogo es la que rige ahora; `formatDiameters()` en `src/utils/format.ts` normaliza
ambos prefijos y unifica el signo ∅ en Ø.

Las compuertas van en dimensiones (m o mm), nunca en Ø ni DN.

## Corregido

| Ficha                              | Estaba                                                                        | Fuente                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `ch-doiras.md` (antes `ch-dorias`) | "C.H. Dorias", Chile, cliente Tinguiririca Energía                            | PPTX slide 9: **C.H. Doiras (Asturias, España), 2007**                         |
| `celco-mariquina.md`               | "acero inoxidable DN 600 (50 T)"                                              | p15/p102: **Ø 6.000, 40 Ton** — error de factor 10                             |
| `celulosa-santa-fe.md`             | "tubería de agua de alimentación", cliente Arauco                             | p66/p102: **estanque feed water**, cliente **Vapor Industrial S.A.**           |
| `ch-san-pedro.md`                  | "2 compuertas de 15×5,5 m"                                                    | slide 29 + p78: **2 conjuntos de 5 tableros**, 5,5 × 14,5 m, 40 t/conjunto     |
| `embalse-ancoa.md`                 | "2 válvulas Bureau DN 1500"                                                   | p9: **Howell-Bunger** DN 1500 PN 20; además eran dos contratos (Besalco y GPE) |
| `ch-carena.md`                     | fundía Carena con la bocatoma del Mapocho                                     | p7/p77: son **dos obras y dos clientes** distintos                             |
| `ch-mainco.md`                     | ficha "C.H. Mainco"                                                           | Mainco S.A. es **cliente**, no central. Su alcance era el de C.H. Renaico      |
| `ch-allipen.md`                    | compuertas "2,4×3 m"                                                          | p8/p78: **2.500 × 3.400 mm**                                                   |
| `embalse-convento-viejo.md`        | "compuerta/válvula Bureau", "DN 2,4 m"                                        | p7 + slide 44: **compuerta tipo Bureau**, Howell-Bunger **Ø 2.400**, 20 m.c.a. |
| `embalse-chacrillas.md`            | faltaba una válvula                                                           | slide 46: mariposa **DN 1600 PN 25** además de las 2 DN 1000                   |
| Teléfono (todo el sitio)           | `+56 43 32 84 14`                                                             | p1/p104: **2328414** — faltaba un dígito                                       |
| `ch-rucue.md`, `ch-peuchen.md`     | sin tilde                                                                     | p7/p3: **Rucúe**, **Peuchén**                                                  |
| varios                             | "blindaje forzado", "trifurcador", "tubería en presión", "reparación Culvert" | términos inexistentes o sin traducir                                           |

## Confirmado como correcto (no tocar)

Términos que parecían erróneos y son de la casa, respaldados por el catálogo:

- **"blindaje de devolución"** (C.H. Itata) — p5 y p25 lo usan literalmente
- **"válvula difusora"** Howell-Bunger — p7
- **"compuerta desarenadora"** y **"compuerta desripiadora"** — p9
- **"cuerpo de vapores"** — p62, C.M.P.C. Planta Santa Fe
- **DN 760** en Chacrillas — slide 46
- **C.H. Nacaome** — slide 16 lo escribe así; el catálogo chileno tiene la errata ("Nacahome")

## Retirado por falta de respaldo

Ninguna de las dos fuentes lo menciona:

- **Turbina Pelton** (estaba en `tipos` y en el resumen de `servicios/turbinas.md`)
- **Chimenea de equilibrio Ø 6.000** de Doiras
- **DIN 19704-1 / 19704-2** — slide 63 solo cita DIN 19705-1
- **Directiva de Máquinas 2006/42/CE**
- **AWWA M11** y **Guía técnica CEDEX**

La Directiva de Equipos a Presión 2014/68/EU (PED) se mantiene: está aprobada en
`matriz_editorial_auditada.md`.

## Incorporado desde los catálogos

- **Las dos patentes**, que el sitio nunca mencionaba: el limpiarrejas de peine y husillos
  (slides 61-62) y el obturador tablero-cúpula para válvulas Bureau con carga de agua
  (slides 58-60).
- **Datos reales de limpiarrejas**: rejas de Mampil y Peuchén con sus dimensiones y
  separación entre lamas (p98-99).
- **Turbinas reales**: proyecto Duqueco (Peuchén y Mampil, 2 turboalternadores Francis de
  36,5 MW y 2 de 24 MW), Sobradelo, Aguilar, Palmucho y las válvulas de guarda de Aguayo.
  Sustituyen la atribución a "Besalco, Iberdrola, Acciona y Endesa", que no tiene respaldo.
- **P.G.O.H. expandido** a Pliego General de Obras Hidráulicas (slide 63).
- **Obturación de desagües de fondo** en Belesar, con ROV y sonar (slides 54-55).

## Pendiente: requiere confirmación de la empresa

1. **C.H. Doiras** — cliente real. Tinguiririca Energía figura en el catálogo asociada a
   C.H. La Higuera, no a Doiras. La ficha quedó sin cliente.
2. **C.H. Río Frío** — el PPTX (slide 6) dice **Ø 1.067 y 185 m verticales por raise
   boring**; el sitio publica Ø 1.200 / Ø 1.000 y 1.655 m totales. Conflicto sin resolver.
3. **C.H. Besaya** — el teleférico (5 t, 800 m de vano) el PPTX lo atribuye a **Ribes de
   Fresser (1998)**, no a Besaya. Verificar si se conflacionaron dos obras.
4. **Embalse El Bato** — el catálogo chileno dice mariposa **950 mm** y Howell-Bunger
   **800 mm**; el PPTX (slides 42-43) dice mariposa **Ø 760** y Howell-Bunger **Ø 660 /
   DN 760**. Se publicó la versión chilena.
5. **C.H. Pulelfú** — el catálogo se contradice: p9 le atribuye las 17 compuertas; p78
   atribuye la misma lista a Bocatoma San Nicolás / El Yeso (cliente Dalco). Se siguió p9.
6. **Álbum de galería `ch-san-pedro`** — sus 12 fotos son montaje de tubería forzada
   fechadas en enero de 2010, pero el alcance de San Pedro son compuertas del túnel de
   desvío. Se recategorizaron por lo que muestran; falta saber a qué obra pertenecen.
7. **Cifras de planta** — el sitio dice oficinas de **320 m²** y **5 puentes grúa de 10 a
   20 t**; el catálogo de 2015 dice **330 m²** y **4 puentes grúa de 16 t**, y menciona un
   **taller de pintura de 260 m²** que el sitio no muestra. No se modificaron: la planta pudo
   crecer desde 2015.
8. **C.H. El Toqui** — no aparece en los catálogos (que llegan hasta 2015). Se mantuvo
   porque Nyrstar / El Toqui sí figura en el muro de logos de clientes.
9. **Certificaciones** — el PPTX (slide 65) declara **ISO 9001:2008** e **ISO 14001:2004**.
   Hay respaldo, pero las versiones están vencidas. Pedir el certificado vigente antes de
   publicarlas.
10. **Los Cóndores** — el PPTX (slide 15) respalda **presión máxima 89 kg/cm²**, **caudal
    nominal 25 m³/s** y acero **S460 ML**. `src/test/audited-content.test.ts` sigue
    bloqueando `89 kg/cm²` en `ch-los-condores.md` por la decisión editorial anterior. Si se
    publica, hay que actualizar ese test.
11. **Aguas Andinas** — el catálogo (p5) documenta la tubería del Embalse El Yeso, Ø 2.200,
    240 t, 290 m. Publicarla respaldaría la mención a empresas "sanitarias" en `/clientes`.
12. **Título "Tanques Especiales"** — el catálogo y el cuerpo del sitio usan _estanque_. El
    título del servicio quedó como está por su dependencia con la navegación y el slug.
13. **Fotos con fecha de cámara quemada** ("20/01/2010", "06/01/2010") visibles en la galería.
14. **`/contacto` no tiene mapa**: los dos bloques que lo parecen son un patrón decorativo.
