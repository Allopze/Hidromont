import { getCmsNumber, getCmsText } from './cms';

export const company = {
  nombre: getCmsText('site.company', 'nombre', 'Hidromont Chile'),
  razonSocial: getCmsText('site.company', 'razonSocial', 'Hidromont Chile'),
  domicilio: getCmsText('site.company', 'domicilio', 'Av. Las Industrias N° 10.950'),
  ciudad: getCmsText('site.company', 'ciudad', 'Los Ángeles, Región del Biobío, Chile'),
  casillaPostal: getCmsText(
    'site.company',
    'casillaPostal',
    'Casilla 48 — Los Ángeles, Región del Biobío'
  ),
  telefono: getCmsText('site.company', 'telefono', '+56 43 232 8414'),
  email: getCmsText('site.company', 'email', 'hidromont@hidromont.cl'),
  sitioWeb: getCmsText('site.company', 'sitioWeb', 'https://hidromont.cl'),
  fundacion: getCmsNumber('site.company', 'fundacion', 1983),
  chileDesde: getCmsNumber('site.company', 'chileDesde', 1997),
  descripcionCorta: getCmsText(
    'site.company',
    'descripcionCorta',
    'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.'
  ),
  descripcionLarga: getCmsText(
    'site.company',
    'descripcionLarga',
    'Ingeniería, fabricación y montaje de tuberías forzadas, blindajes, compuertas, válvulas, turbinas y limpiarrejas para proyectos hidráulicos e hidroeléctricos.'
  ),
  especialidad: getCmsText(
    'site.company',
    'especialidad',
    'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.'
  ),
  modalidad: getCmsText('site.company', 'modalidad', 'Proyectos EPC'),
} as const;
