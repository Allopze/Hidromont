# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cms-overlay.spec.ts >> CMS overlay flow >> collections panel opens and shows entries
- Location: e2e/cms-overlay.spec.ts:187:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Ir al contenido principal" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - generic [ref=e5]:
      - link "Hidromont Chile — Inicio" [ref=e6] [cursor=pointer]:
        - /url: /
        - img "Hidromont Chile S.A." [ref=e7]
      - navigation "Navegación principal" [ref=e8]:
        - link "Inicio" [ref=e9] [cursor=pointer]:
          - /url: /
        - link "Servicios" [ref=e11] [cursor=pointer]:
          - /url: /servicios
          - text: Servicios
          - img [ref=e12]
        - link "Proyectos" [ref=e14] [cursor=pointer]:
          - /url: /proyectos
        - link "Galería" [ref=e15] [cursor=pointer]:
          - /url: /galeria
        - link "Empresa" [ref=e16] [cursor=pointer]:
          - /url: /empresa
        - link "Clientes" [ref=e17] [cursor=pointer]:
          - /url: /clientes
        - link "Contacto" [ref=e18] [cursor=pointer]:
          - /url: /contacto
      - link "Contáctenos" [ref=e20] [cursor=pointer]:
        - /url: /contacto
        - generic [ref=e21]: Contáctenos
  - main [ref=e22]:
    - generic [ref=e23]:
      - img "Vista aérea de las instalaciones de Hidromont Chile S.A. en Los Ángeles, Biobío"
      - generic [ref=e25]:
        - generic [ref=e26]: Especialistas en equipos hidromecánicos
        - heading "Ingeniería, fabricación y montaje de equipos hidromecánicos" [level=1] [ref=e27]
        - paragraph [ref=e28]: Más de 40 años de trayectoria en proyectos hidráulicos e hidroeléctricos en Chile y el exterior. Especialistas en soluciones técnicas de alta complejidad desde 1983.
        - generic [ref=e29]:
          - link "Conocer nuestros servicios" [ref=e30] [cursor=pointer]:
            - /url: /servicios
          - link "Ver proyectos" [ref=e31] [cursor=pointer]:
            - /url: /proyectos
      - img [ref=e33]
    - generic [ref=e37]:
      - generic [ref=e38]:
        - generic [ref=e39]: Servicios
        - heading "Soluciones hidromecánicas llave en mano" [level=2] [ref=e40]
        - paragraph [ref=e41]: "Cubrimos toda la cadena de valor de los proyectos hidromecánicos: desde ingeniería y fabricación hasta montaje, mantenimiento y rehabilitación en terreno."
      - generic [ref=e42]:
        - article [ref=e43]:
          - img [ref=e45]
          - generic [ref=e47]:
            - heading "Tuberías Forzadas y Blindajes" [level=3] [ref=e48]
            - paragraph [ref=e49]: Proyectos llave en mano para tuberías forzadas, blindajes en acero mecano-soldado, bifurcaciones, codos, embocaduras, juntas de dilatación, apoyos, puntos fijos, repartidores, transiciones y piezas especiales.
            - list [ref=e50]:
              - listitem [ref=e51]: Tuberías forzadas
              - listitem [ref=e53]: Blindajes en acero mecano-soldado
              - listitem [ref=e55]: Bifurcaciones y trifurcaciones
          - link "Ver servicio" [ref=e57] [cursor=pointer]:
            - /url: /servicios/tuberias-forzadas
            - text: Ver servicio
            - img [ref=e58]
        - article [ref=e60]:
          - img [ref=e62]
          - generic [ref=e65]:
            - heading "Compuertas" [level=3] [ref=e66]
            - paragraph [ref=e67]: Diseño, fabricación, montaje, mantenimiento y reparación de compuertas para presas y centrales hidroeléctricas. Diseño según especificaciones, cargas y dimensiones del conducto, con comprobación por elementos finitos.
            - list [ref=e68]:
              - listitem [ref=e69]: Compuerta vagón
              - listitem [ref=e71]: Compuerta Taintor (radial)
              - listitem [ref=e73]: Compuerta clapeta
          - link "Ver servicio" [ref=e75] [cursor=pointer]:
            - /url: /servicios/compuertas
            - text: Ver servicio
            - img [ref=e76]
        - article [ref=e78]:
          - img [ref=e80]
          - generic [ref=e83]:
            - heading "Válvulas Hidráulicas" [level=3] [ref=e84]
            - paragraph [ref=e85]: Diseño, fabricación, montaje, mantenimiento y reparación de válvulas para obras hidráulicas e hidroeléctricas. Soluciones para desagüe de fondo, by-pass, cierre de emergencia, guarda de turbinas y aireación.
            - list [ref=e86]:
              - listitem [ref=e87]: Válvula Bureau
              - listitem [ref=e89]: Válvula Howell-Bunger
              - listitem [ref=e91]: Válvula mariposa
          - link "Ver servicio" [ref=e93] [cursor=pointer]:
            - /url: /servicios/valvulas
            - text: Ver servicio
            - img [ref=e94]
        - article [ref=e96]:
          - img [ref=e98]
          - generic [ref=e101]:
            - heading "Turbinas Hidráulicas" [level=3] [ref=e102]
            - paragraph [ref=e103]: Montaje de nuevas instalaciones, mantenimientos, reparaciones y rehabilitaciones de turbinas Pelton, Francis, Kaplan y Bulbo. Desde minicentrales hasta potencias de 106 MVA.
            - list [ref=e104]:
              - listitem [ref=e105]: Turbina Pelton
              - listitem [ref=e107]: Turbina Francis
              - listitem [ref=e109]: Turbina Kaplan
          - link "Ver servicio" [ref=e111] [cursor=pointer]:
            - /url: /servicios/turbinas
            - text: Ver servicio
            - img [ref=e112]
        - article [ref=e114]:
          - img [ref=e116]
          - generic [ref=e119]:
            - heading "Limpiarrejas" [level=3] [ref=e120]
            - paragraph [ref=e121]: Diseño, fabricación, montaje, mantenimiento y reparación de equipos limpiarrejas para canales, presas y centrales hidroeléctricas. Equipos para limpieza de desechos de rejas metálicas y libre admisión de agua.
            - list [ref=e122]:
              - listitem [ref=e123]: Limpiarreje de husillos
              - listitem [ref=e125]: Limpiarreje de cremallera
              - listitem [ref=e127]: Limpiarreje oleo-hidráulico
          - link "Ver servicio" [ref=e129] [cursor=pointer]:
            - /url: /servicios/limpiarrejas
            - text: Ver servicio
            - img [ref=e130]
        - article [ref=e132]:
          - img [ref=e134]
          - generic [ref=e136]:
            - heading "Montajes y Fabricaciones Especiales" [level=3] [ref=e137]
            - paragraph [ref=e138]: Montajes electromecánicos, estanques, estructuras metálicas, vigas principales, canales metálicos, reparaciones de sifones, apoyos de tubería y otras obras vinculadas a infraestructura hidráulica e industrial.
            - list [ref=e139]:
              - listitem [ref=e140]: Montajes electromecánicos
              - listitem [ref=e142]: Estanques industriales
              - listitem [ref=e144]: Estructuras metálicas
          - link "Ver servicio" [ref=e146] [cursor=pointer]:
            - /url: /servicios/otros-montajes
            - text: Ver servicio
            - img [ref=e147]
        - article [ref=e149]:
          - img [ref=e151]
          - generic [ref=e153]:
            - heading "Infraestructura Hidráulica y Vial" [level=3] [ref=e154]
            - paragraph [ref=e155]: Fabricación y montaje de estructuras metálicas pesadas para acueductos, centrales, puertos, puentes y defensas fluviales. Soluciones robustas para proyectos civiles de gran envergadura.
            - list [ref=e156]:
              - listitem [ref=e157]: Pasarelas y puentes metálicos
              - listitem [ref=e159]: Estructuras de soporte de gran tonelaje
              - listitem [ref=e161]: Pórticos de izaje y vigas principales
          - link "Ver servicio" [ref=e163] [cursor=pointer]:
            - /url: /servicios/infraestructuras
            - text: Ver servicio
            - img [ref=e164]
        - article [ref=e166]:
          - img [ref=e168]
          - generic [ref=e171]:
            - heading "Tanques Especiales y Recipientes a Presión" [level=3] [ref=e172]
            - paragraph [ref=e173]: Ingeniería, fabricación y montaje de estanques de gran volumen, recipientes a presión, silos y reactores en acero al carbono e inoxidable bajo estándares internacionales (ASME/API).
            - list [ref=e174]:
              - listitem [ref=e175]: Tanques acumuladores a presión
              - listitem [ref=e177]: Estanques de gran volumen verticales y horizontales
              - listitem [ref=e179]: Silos para sólidos y almacenamiento de fluidos
          - link "Ver servicio" [ref=e181] [cursor=pointer]:
            - /url: /servicios/tanques-especiales
            - text: Ver servicio
            - img [ref=e182]
    - separator [ref=e184]
    - generic [ref=e186]:
      - generic [ref=e187]:
        - generic [ref=e188]: Por qué elegirnos
        - heading "Capacidad técnica y experiencia comprobada" [level=2] [ref=e189]
        - paragraph [ref=e190]: Más de 40 años de trayectoria en proyectos hidráulicos nacionales e internacionales.
      - generic [ref=e191]:
        - generic [ref=e194]:
          - heading "Especialización sectorial" [level=3] [ref=e195]
          - paragraph [ref=e196]: Empresa enfocada exclusivamente en soluciones hidromecánicas e hidroeléctricas.
        - generic [ref=e199]:
          - heading "Llave en mano" [level=3] [ref=e200]
          - paragraph [ref=e201]: Diseño, ingeniería, fabricación, suministro, montaje, mantenimiento y rehabilitación.
        - generic [ref=e204]:
          - heading "Experiencia internacional" [level=3] [ref=e205]
          - paragraph [ref=e206]: Proyectos ejecutados en Chile, España, Honduras, Costa Rica y otros países.
    - separator [ref=e207]
    - generic [ref=e208]:
      - img "Fabricación de tuberías forzadas de gran diámetro en el taller de Hidromont" [ref=e212]
      - generic [ref=e213]:
        - generic [ref=e214]:
          - generic [ref=e215]: Instalaciones y medios productivos
          - heading "Taller propio en Los Ángeles, Biobío" [level=2] [ref=e216]
          - paragraph [ref=e217]: Infraestructura especializada para responder a proyectos complejos con rapidez y precisión.
        - generic [ref=e218]:
          - generic [ref=e219]:
            - paragraph [ref=e220]: 11.000 m²
            - heading "Superficie total" [level=3] [ref=e221]
            - paragraph [ref=e222]: 11.000 m² de terreno para almacenamiento, maniobras y logística
          - generic [ref=e223]:
            - paragraph [ref=e224]: 2.000 m²
            - heading "Taller industrial" [level=3] [ref=e225]
            - paragraph [ref=e226]: 2.000 m² equipado para fabricación de equipos de gran dimensión
          - generic [ref=e227]:
            - paragraph [ref=e228]: 320 m²
            - heading "Oficinas e ingeniería" [level=3] [ref=e229]
            - paragraph [ref=e230]: 320 m² con equipo técnico especializado en proyectos hidromecánicos
          - generic [ref=e231]:
            - paragraph [ref=e232]: 5 grúas
            - heading "Capacidad de izaje" [level=3] [ref=e233]
            - paragraph [ref=e234]: 5 puentes grúa de 10 a 20 toneladas para maniobras de gran peso
    - separator [ref=e235]
    - generic [ref=e237]:
      - generic [ref=e238]:
        - generic [ref=e239]:
          - generic [ref=e240]: Experiencia
          - heading "Proyectos destacados" [level=2] [ref=e241]
        - link "Ver todos los proyectos" [ref=e242] [cursor=pointer]:
          - /url: /proyectos
      - generic [ref=e243]:
        - article [ref=e244]:
          - img "Montaje vertical de tubería forzada en caverna subterránea" [ref=e246]
          - generic [ref=e247]:
            - generic [ref=e248]:
              - generic [ref=e249]: Tuberías y Blindajes
              - heading "C.H. Los Condores" [level=3] [ref=e250]
              - paragraph [ref=e251]: Ferrovial S.A.
            - paragraph [ref=e252]: Ingeniería, fabricación y montaje de tubería forzada DN 2200, bifurcación y ramales DN 2200-1600, blindaje vertical de 500 m en pique subterráneo, acceso vehicular y pieza de conexión. Tubería de aducción DN 3200 de 1.100 m y blindaje DN 3400.
            - generic [ref=e253]:
              - generic [ref=e254]: DN 2200 / DN 3200 / DN 3400
              - generic [ref=e255]: 1.600 m tubería forzada + 1.100 m aducción + 500 m vertical
            - link "Ver detalle" [ref=e256] [cursor=pointer]:
              - /url: /proyectos/ch-los-condores
              - generic [ref=e257]: Ver detalle
              - img [ref=e258]
        - article [ref=e260]:
          - img "Válvula instalada en túnel de central" [ref=e262]
          - generic [ref=e263]:
            - generic [ref=e264]:
              - generic [ref=e265]: Compuertas y Válvulas
              - heading "Embalse Chironta" [level=3] [ref=e266]
              - paragraph [ref=e267]: Consorcio Dragados - Besalco / M.O.P. / D.O.H.
            - paragraph [ref=e268]: "Ingeniería, suministro y montaje de equipamiento hidromecánico completo: tubería DN 1600 de 360 m, válvulas Bureau, mariposa y Howell-Bunger. Fabricación de válvulas de repuesto para el MOP."
            - generic [ref=e269]:
              - generic [ref=e270]: DN 1600 / DN 1400 / DN 800
              - generic [ref=e271]: 360 m
            - link "Ver detalle" [ref=e272] [cursor=pointer]:
              - /url: /proyectos/embalse-chironta
              - generic [ref=e273]: Ver detalle
              - img [ref=e274]
        - article [ref=e276]:
          - img "Instalación de tubería en terreno" [ref=e278]
          - generic [ref=e279]:
            - generic [ref=e280]:
              - generic [ref=e281]: Tuberías y Blindajes
              - heading "C.H. Queltehues" [level=3] [ref=e282]
              - paragraph [ref=e283]: AES Andes S.A.
            - paragraph [ref=e284]: Ingeniería, fabricación, desmontaje de tubería existente, demolición de apoyos y machones, fabricación y montaje de nueva tubería de 550 m con diámetros 1500-1800 mm.
            - generic [ref=e285]:
              - generic [ref=e286]: DN 1500 / DN 1800
              - generic [ref=e287]: 550 m
            - link "Ver detalle" [ref=e288] [cursor=pointer]:
              - /url: /proyectos/ch-queltehues
              - generic [ref=e289]: Ver detalle
              - img [ref=e290]
        - article [ref=e292]:
          - img "Bifurcación instalada en obra" [ref=e294]
          - generic [ref=e295]:
            - generic [ref=e296]:
              - generic [ref=e297]: Tuberías y Blindajes
              - heading "C.H. Dorias" [level=3] [ref=e298]
              - paragraph [ref=e299]: Tinguiririca Energía
            - paragraph [ref=e300]: Ingeniería, suministro y montaje de blindaje, diseño 3D, análisis tensional de trifurcación, pre-montaje en taller y montaje de tramos DN 4000/DN 2600, chimenea de equilibrio DN 6000 y válvulas mariposa DN 2700 PN10.
            - generic [ref=e302]: DN 4000 / DN 6000
            - link "Ver detalle" [ref=e303] [cursor=pointer]:
              - /url: /proyectos/ch-dorias
              - generic [ref=e304]: Ver detalle
              - img [ref=e305]
        - article [ref=e307]:
          - img "Montaje de tubería forzada de gran diámetro" [ref=e309]
          - generic [ref=e310]:
            - generic [ref=e311]:
              - generic [ref=e312]: Tuberías y Blindajes
              - heading "C.H. Besaya" [level=3] [ref=e313]
              - paragraph [ref=e314]: HC Energía
            - paragraph [ref=e315]: Ingeniería, suministro y montaje de tramo superior de tubería forzada. Transporte mediante teleférico, junta de dilatación, unión de tramo nuevo con tubería antigua mediante cono, apoyo de hormigón y punto fijo.
            - generic [ref=e317]: España
            - link "Ver detalle" [ref=e318] [cursor=pointer]:
              - /url: /proyectos/ch-besaya
              - generic [ref=e319]: Ver detalle
              - img [ref=e320]
        - article [ref=e322]:
          - img "Tubería forzada en ladera de montaña" [ref=e324]
          - generic [ref=e325]:
            - generic [ref=e326]:
              - generic [ref=e327]: Tuberías y Blindajes
              - heading "C.H. Río Frío" [level=3] [ref=e328]
              - paragraph [ref=e329]: Norvento
            - paragraph [ref=e330]: Ingeniería, suministro y montaje de tubería forzada de 1.655 m de longitud, diámetros 1.200/1.000 mm, incluyendo 185 m de tubería vertical.
            - generic [ref=e331]:
              - generic [ref=e332]: DN 1200 / DN 1000
              - generic [ref=e333]: 1.655 m
              - generic [ref=e334]: España
            - link "Ver detalle" [ref=e335] [cursor=pointer]:
              - /url: /proyectos/ch-rio-frio
              - generic [ref=e336]: Ver detalle
              - img [ref=e337]
    - separator [ref=e339]
    - generic [ref=e341]:
      - generic [ref=e342]:
        - generic [ref=e343]: Clientes y referencias
        - heading "Empresas que confían en Hidromont" [level=2] [ref=e344]
      - generic [ref=e345]:
        - generic "Acciona" [ref=e346]:
          - img "Acciona"
        - generic "Besalco" [ref=e347]:
          - img "Besalco"
        - generic "Colbún" [ref=e348]:
          - img "Colbún"
        - generic "Conpax" [ref=e349]:
          - img "Conpax"
        - generic "EDP" [ref=e350]:
          - img "EDP"
        - generic "Elecnor" [ref=e351]:
          - img "Elecnor"
        - generic "Eléctrica Puntilla" [ref=e352]:
          - img "Eléctrica Puntilla"
        - generic "FCC" [ref=e353]:
          - img "FCC"
        - generic "Ferrovial" [ref=e354]:
          - img "Ferrovial"
        - generic "Gas Natural Fenosa" [ref=e355]:
          - img "Gas Natural Fenosa"
        - generic "GPE" [ref=e356]:
          - img "GPE"
        - generic "Iberdrola" [ref=e357]:
          - img "Iberdrola"
        - generic "NaturEner" [ref=e358]:
          - img "NaturEner"
        - generic "Navarro SiC" [ref=e359]:
          - img "Navarro SiC"
        - generic "Norvento" [ref=e360]:
          - img "Norvento"
        - generic "Pacific Hydro" [ref=e361]:
          - img "Pacific Hydro"
        - generic "Plenium Partners" [ref=e362]:
          - img "Plenium Partners"
        - generic "Viesgo" [ref=e363]:
          - img "Viesgo"
      - generic [ref=e364]:
        - paragraph [ref=e365]: También trabajamos con
        - generic [ref=e366]:
          - generic [ref=e367]: AES Andes
          - generic [ref=e368]: Arauco
          - generic [ref=e369]: HC Energía
          - generic [ref=e370]: Engie
          - generic [ref=e371]: Endesa
          - generic [ref=e372]: M.O.P. / D.O.H.
          - generic [ref=e373]: Mainco
          - generic [ref=e374]: OHL
      - link "Ver todos los clientes" [ref=e376] [cursor=pointer]:
        - /url: /clientes
        - generic [ref=e377]: Ver todos los clientes
        - img [ref=e378]
    - generic [ref=e382]:
      - heading "¿Quiere saber más sobre nuestra empresa?" [level=2] [ref=e383]
      - paragraph [ref=e384]: Estamos disponibles para presentar nuestra trayectoria, capacidades técnicas y experiencia en proyectos hidromecánicos nacionales e internacionales.
      - generic [ref=e385]:
        - link "Ponerse en contacto" [ref=e386] [cursor=pointer]:
          - /url: /contacto
        - link "Conocer la empresa" [ref=e387] [cursor=pointer]:
          - /url: /empresa
  - contentinfo [ref=e388]:
    - generic [ref=e390]:
      - generic [ref=e391]:
        - generic [ref=e393]:
          - generic [ref=e394]:
            - iframe [ref=e395]
            - generic:
              - generic:
                - img
                - text: Cómo llegar
            - link "Abrir ruta en Google Maps" [ref=e396] [cursor=pointer]:
              - /url: https://www.google.com/maps/dir/?api=1&destination=Hidromont+Chile+S.A.,+Avenida+Las+Industrias+10950,+Los+Angeles,+Chile
          - generic [ref=e397]:
            - link "Google Maps" [ref=e398] [cursor=pointer]:
              - /url: https://www.google.com/maps/dir/?api=1&destination=Hidromont+Chile+S.A.,+Avenida+Las+Industrias+10950,+Los+Angeles,+Chile
              - img [ref=e399]
              - text: Google Maps
            - link "Waze" [ref=e402] [cursor=pointer]:
              - /url: https://waze.com/ul?q=Hidromont%20Chile%20S.A.,%20Avenida%20Las%20Industrias%2010950,%20Los%20Angeles,%20Chile&navigate=yes
              - img [ref=e403]
              - text: Waze
        - paragraph [ref=e407]:
          - generic [ref=e408]: Dirección
          - text: Av. Las Industrias N° 10.950, Longitudinal Sur, Km 513
          - text: Los Ángeles, Región del Biobío, Chile
      - generic [ref=e409]:
        - paragraph [ref=e410]: Servicios
        - navigation "Servicios" [ref=e411]:
          - list [ref=e412]:
            - listitem [ref=e413]:
              - link "Tuberías Forzadas" [ref=e414] [cursor=pointer]:
                - /url: /servicios/tuberias-forzadas
            - listitem [ref=e415]:
              - link "Compuertas" [ref=e416] [cursor=pointer]:
                - /url: /servicios/compuertas
            - listitem [ref=e417]:
              - link "Válvulas" [ref=e418] [cursor=pointer]:
                - /url: /servicios/valvulas
            - listitem [ref=e419]:
              - link "Turbinas" [ref=e420] [cursor=pointer]:
                - /url: /servicios/turbinas
            - listitem [ref=e421]:
              - link "Limpiarrejas" [ref=e422] [cursor=pointer]:
                - /url: /servicios/limpiarrejas
            - listitem [ref=e423]:
              - link "Montajes Especiales" [ref=e424] [cursor=pointer]:
                - /url: /servicios/otros-montajes
      - generic [ref=e425]:
        - paragraph [ref=e426]: Empresa
        - navigation "Empresa" [ref=e427]:
          - list [ref=e428]:
            - listitem [ref=e429]:
              - link "Quiénes somos" [ref=e430] [cursor=pointer]:
                - /url: /empresa
            - listitem [ref=e431]:
              - link "Proyectos" [ref=e432] [cursor=pointer]:
                - /url: /proyectos
            - listitem [ref=e433]:
              - link "Galería" [ref=e434] [cursor=pointer]:
                - /url: /galeria
            - listitem [ref=e435]:
              - link "Clientes" [ref=e436] [cursor=pointer]:
                - /url: /clientes
            - listitem [ref=e437]:
              - link "Contacto" [ref=e438] [cursor=pointer]:
                - /url: /contacto
      - generic [ref=e439]:
        - paragraph [ref=e440]: Contacto
        - generic [ref=e441]:
          - paragraph [ref=e442]:
            - generic [ref=e443]: Teléfono
            - link "+56 43 32 84 14" [ref=e444] [cursor=pointer]:
              - /url: tel:+5643328414
          - paragraph [ref=e445]:
            - generic [ref=e446]: Correo
            - link "hidromont@hidromont.cl" [ref=e447] [cursor=pointer]:
              - /url: mailto:hidromont@hidromont.cl
    - generic [ref=e449]:
      - paragraph [ref=e450]: © 2026 Hidromont Chile S.A.. Todos los derechos reservados.
      - paragraph [ref=e451]: Los Ángeles, Región del Biobío, Chile
  - generic:
    - generic [ref=e452]:
      - strong [ref=e453]: Hidromont CMS
      - button "Colecciones" [ref=e454] [cursor=pointer]
      - button "Historial" [ref=e455] [cursor=pointer]
      - button "Exportar y validar" [ref=e456] [cursor=pointer]
      - button "Salir" [ref=e457] [cursor=pointer]
    - complementary "Editor CMS" [ref=e458]:
      - generic [ref=e459]:
        - heading "Editor" [level=2] [ref=e460]
        - button "Cerrar" [ref=e461] [cursor=pointer]
      - main [ref=e462]:
        - generic [ref=e463]:
          - generic [ref=e464]:
            - text: Email
            - textbox "Email" [ref=e465]: admin@hidromont.local
          - generic [ref=e466]:
            - text: Password
            - textbox "Password" [ref=e467]
          - button "Entrar" [ref=e468] [cursor=pointer]
          - paragraph [ref=e469]: "Servidor CMS: http://localhost:8787"
  - generic [ref=e472]:
    - button "Menu" [ref=e473]:
      - img [ref=e475]
      - generic: Menu
    - button "Inspect" [ref=e479]:
      - img [ref=e481]
      - generic: Inspect
    - button "Audit" [ref=e483]:
      - generic [ref=e484]:
        - img [ref=e485]
        - img [ref=e488]
      - generic: Audit
    - button "Settings" [ref=e491]:
      - img [ref=e493]
      - generic: Settings
```

# Test source

```ts
  93  |   test('login with correct credentials', async ({ request }) => {
  94  |     const res = await request.post(`${CMS_URL}/api/cms/login`, {
  95  |       data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  96  |     });
  97  |     expect(res.ok()).toBeTruthy();
  98  |     const body = await res.json();
  99  |     expect(body.ok).toBe(true);
  100 |     expect(typeof body.csrfToken).toBe('string');
  101 |   });
  102 | 
  103 |   test('login fails with wrong password', async ({ request }) => {
  104 |     const res = await request.post(`${CMS_URL}/api/cms/login`, {
  105 |       data: { email: ADMIN_EMAIL, password: 'wrong-password' },
  106 |     });
  107 |     expect(res.status()).toBe(401);
  108 |   });
  109 | 
  110 |   test('entries list requires auth', async ({ request }) => {
  111 |     const res = await request.get(`${CMS_URL}/api/cms/entries`);
  112 |     expect(res.status()).toBe(401);
  113 |   });
  114 | 
  115 |   test('authenticated entries list returns items', async ({ page }) => {
  116 |     await apiLogin(page);
  117 |     const res = await page.request.get(`${CMS_URL}/api/cms/entries`);
  118 |     expect(res.ok()).toBeTruthy();
  119 |     const body = await res.json();
  120 |     expect(Array.isArray(body.entries)).toBe(true);
  121 |     expect(body.entries.length).toBeGreaterThan(0);
  122 |   });
  123 | 
  124 |   test('media list returns items with usageCount', async ({ page }) => {
  125 |     await apiLogin(page);
  126 |     const res = await page.request.get(`${CMS_URL}/api/cms/media`);
  127 |     expect(res.ok()).toBeTruthy();
  128 |     const body = await res.json();
  129 |     expect(Array.isArray(body.items)).toBe(true);
  130 |     // Each item should have usageCount
  131 |     if (body.items.length > 0) {
  132 |       expect(typeof body.items[0].usageCount).toBe('number');
  133 |     }
  134 |   });
  135 | 
  136 |   test('schema endpoint returns field types', async ({ page }) => {
  137 |     await apiLogin(page);
  138 |     const res = await page.request.get(`${CMS_URL}/api/cms/schema`);
  139 |     expect(res.ok()).toBeTruthy();
  140 |     const body = await res.json();
  141 |     expect(Array.isArray(body.fieldTypes)).toBe(true);
  142 |     expect(body.fieldTypes).toContain('image');
  143 |     expect(body.fieldTypes).toContain('richtext');
  144 |   });
  145 | });
  146 | 
  147 | test.describe('CMS overlay flow', () => {
  148 |   test.beforeEach(async ({ page }) => {
  149 |     // Enable overlay via localStorage
  150 |     await page.goto('/');
  151 |     await page.evaluate(() => localStorage.setItem('hidromont:cms', '1'));
  152 |   });
  153 | 
  154 |   test('overlay bar appears with ?cms=1', async ({ page }) => {
  155 |     await page.goto('/?cms=1');
  156 |     await expect(page.locator('.hm-cms-bar')).toBeVisible();
  157 |   });
  158 | 
  159 |   test('overlay shows login form when not authenticated', async ({ page }) => {
  160 |     await page.goto('/?cms=1');
  161 |     // Click on any editable element to trigger login
  162 |     const editable = page.locator('[data-cms-entry]').first();
  163 |     if (await editable.count() > 0) {
  164 |       await editable.click({ force: true });
  165 |       await expect(page.locator('form[data-login]')).toBeVisible();
  166 |     }
  167 |   });
  168 | 
  169 |   test('overlay login succeeds and closes panel', async ({ page }) => {
  170 |     await page.goto('/?cms=1');
  171 |     // Open panel with any editable element
  172 |     const editable = page.locator('[data-cms-entry]').first();
  173 |     if (await editable.count() === 0) return;
  174 |     await editable.click({ force: true });
  175 | 
  176 |     // Fill login form
  177 |     const loginForm = page.locator('form[data-login]');
  178 |     if (await loginForm.count() === 0) return; // Already logged in
  179 |     await loginForm.locator('[name="email"]').fill(ADMIN_EMAIL);
  180 |     await loginForm.locator('[name="password"]').fill(ADMIN_PASSWORD);
  181 |     await loginForm.locator('button[type="submit"]').click();
  182 | 
  183 |     // Panel should close after login
  184 |     await expect(page.locator('.hm-cms-panel.open')).not.toBeVisible({ timeout: 3000 });
  185 |   });
  186 | 
  187 |   test('collections panel opens and shows entries', async ({ page }) => {
  188 |     // Login first via API
  189 |     await page.goto('/');
  190 |     const res = await page.request.post(`${CMS_URL}/api/cms/login`, {
  191 |       data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  192 |     });
> 193 |     expect(res.ok()).toBeTruthy();
      |                      ^ Error: expect(received).toBeTruthy()
  194 | 
  195 |     await page.goto('/?cms=1');
  196 |     await page.locator('[data-action="collections"]').click();
  197 |     await expect(page.locator('.hm-cms-panel.open')).toBeVisible();
  198 |   });
  199 | });
  200 | 
```