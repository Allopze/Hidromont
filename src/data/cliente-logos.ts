import { getCmsText } from './cms';

/** Returns CMS-overridable logo path for a client by its slugified key, or '' if none. */
export function getClienteLogo(key: string, fallback = ''): string {
  return getCmsText('clientes.logos', `logo-${key}`, fallback);
}

/** Map from client nombre → logo path (CMS with fallback from clientes.json). */
const logoMap: Record<string, string> = {
  Acciona:            getCmsText('clientes.logos', 'logo-acciona',            '/logos-clientes/acciona.png'),
  Besalco:            getCmsText('clientes.logos', 'logo-besalco',            '/logos-clientes/besalco.png'),
  'Colbún':           getCmsText('clientes.logos', 'logo-colbun',             '/logos-clientes/colbun.png'),
  Conpax:             getCmsText('clientes.logos', 'logo-conpax',             '/logos-clientes/conpax.png'),
  EDP:                getCmsText('clientes.logos', 'logo-edp',                '/logos-clientes/edp-hc-energia.png'),
  Elecnor:            getCmsText('clientes.logos', 'logo-elecnor',            '/logos-clientes/elecnor.png'),
  'Eléctrica Puntilla': getCmsText('clientes.logos', 'logo-electrica-puntilla', '/logos-clientes/electrica-puntilla.png'),
  FCC:                getCmsText('clientes.logos', 'logo-fcc',                '/logos-clientes/fcc.png'),
  Ferrovial:          getCmsText('clientes.logos', 'logo-ferrovial',          '/logos-clientes/ferrovial.png'),
  'Gas Natural Fenosa': getCmsText('clientes.logos', 'logo-gas-natural-fenosa', '/logos-clientes/gas-natural-fenosa.png'),
  GPE:                getCmsText('clientes.logos', 'logo-gpe',                '/logos-clientes/gpe.png'),
  Iberdrola:          getCmsText('clientes.logos', 'logo-iberdrola',          '/logos-clientes/iberdrola.png'),
  NaturEner:          getCmsText('clientes.logos', 'logo-naturener',          '/logos-clientes/naturener.png'),
  'Navarro SiC':      getCmsText('clientes.logos', 'logo-navarro-sic',        '/logos-clientes/navarro-sic.png'),
  Norvento:           getCmsText('clientes.logos', 'logo-norvento',           '/logos-clientes/norvento.png'),
  'Pacific Hydro':    getCmsText('clientes.logos', 'logo-pacific-hydro',      '/logos-clientes/pacific-hydro.png'),
  'Plenium Partners': getCmsText('clientes.logos', 'logo-plenium-partners',   '/logos-clientes/plenium-partners.png'),
  Viesgo:             getCmsText('clientes.logos', 'logo-viesgo',             '/logos-clientes/viesgo.png'),
};

export function getClienteLogoByNombre(nombre: string): string {
  return logoMap[nombre] ?? '';
}
