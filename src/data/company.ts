import { getCmsText } from './cms';

export const company = {
  nombre: getCmsText('site.company', 'nombre', 'Hidromont Chile'),
  razonSocial: getCmsText('site.company', 'razonSocial', 'Hidromont Chile'),
  domicilio: getCmsText('site.company', 'domicilio', 'Av. Las Industrias N° 10.950'),
  ciudad: getCmsText('site.company', 'ciudad', 'Los Ángeles, Región del Biobío, Chile'),
  telefono: getCmsText('site.company', 'telefono', '+56 43 232 8414'),
  email: getCmsText('site.company', 'email', 'hidromont@hidromont.cl'),
  sitioWeb: getCmsText('site.company', 'sitioWeb', 'https://hidromontchile.cl'),
  descripcionCorta: getCmsText(
    'site.company',
    'descripcionCorta',
    'Ingeniería, fabricación y montaje de equipos hidromecánicos para embalses y centrales hidroeléctricas.'
  ),
} as const;
