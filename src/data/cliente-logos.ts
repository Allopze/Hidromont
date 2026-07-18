import { getCmsText } from './cms';

/** Returns CMS-overridable logo path for a client by its slugified key, or '' if none. */
export function getClienteLogo(key: string, fallback = ''): string {
  return getCmsText('clientes.logos', `logo-${key}`, fallback);
}

/** Map from client nombre → logo path (CMS with fallback from clientes.json). */
const logoMap: Record<string, string> = {
  Acciona:              getCmsText('clientes.logos', 'logo-acciona',            '/logos-clientes/acciona.svg'),
  'AES Andes':          getCmsText('clientes.logos', 'logo-aes-andes',          '/logos-clientes/aes-andes.png'),
  Arauco:               getCmsText('clientes.logos', 'logo-arauco',             '/logos-clientes/arauco.svg'),
  Besalco:              getCmsText('clientes.logos', 'logo-besalco',            '/logos-clientes/besalco.webp'),
  'Colbún':             getCmsText('clientes.logos', 'logo-colbun',             '/logos-clientes/colbun.svg'),
  Conpax:               getCmsText('clientes.logos', 'logo-conpax',             '/logos-clientes/conpax.png'),
  'Constructora Renaico SpA': getCmsText('clientes.logos', 'logo-constructora-renaico', '/logos-clientes/constructora-renaico.svg'),
  EDP:                  getCmsText('clientes.logos', 'logo-edp',                '/logos-clientes/edp.svg'),
  Elecnor:              getCmsText('clientes.logos', 'logo-elecnor',            '/logos-clientes/elecnor.svg'),
  'Eléctrica Puntilla': getCmsText('clientes.logos', 'logo-electrica-puntilla', '/logos-clientes/electrica-puntilla.png'),
  Endesa:               getCmsText('clientes.logos', 'logo-endesa',             '/logos-clientes/endesa.png'),
  Engie:                getCmsText('clientes.logos', 'logo-engie',              '/logos-clientes/engie.png'),
  Ferrovial:            getCmsText('clientes.logos', 'logo-ferrovial',          '/logos-clientes/ferrovial.png'),
  GPE:                  getCmsText('clientes.logos', 'logo-gpe',                '/logos-clientes/gpe.png'),
  Iberdrola:            getCmsText('clientes.logos', 'logo-iberdrola',          '/logos-clientes/iberdrola.png'),
  Gasco:                getCmsText('clientes.logos', 'logo-gasco',               '/logos-clientes/gasco.svg'),
  'M.O.P. / D.O.H.':   getCmsText('clientes.logos', 'logo-mop-doh',            '/logos-clientes/mop-doh.jpeg'),
  'Pacific Hydro':      getCmsText('clientes.logos', 'logo-pacific-hydro',      '/logos-clientes/pacific-hydro.png'),
};

export function getClienteLogoByNombre(nombre: string): string {
  return logoMap[nombre] ?? '';
}
