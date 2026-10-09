// Catálogo das secções da app (as mesmas do web, além do Início). As 5 primeiras são tabs
// (`app/(tabs)/`); as restantes são ecrãs da stack raiz, abertos a partir da grelha do Início.
export type Section = {
  href: string
  title: string
  emoji: string
  color: string
  description: string
}

export const SECTIONS: Section[] = [
  { href: '/combustivel', title: 'Combustível', emoji: '⛽', color: '#16a34a', description: 'Preços e postos' },
  { href: '/tempo', title: 'Tempo', emoji: '🌤️', color: '#0ea5e9', description: 'Previsão IPMA' },
  { href: '/ev', title: 'Carregamento EV', emoji: '⚡', color: '#f59e0b',   description: 'Tarifas e simulador' },
    { href: '/economia', title: 'Economia', emoji: '📊', color: '#6366f1', description: 'Taxas BdP e indicadores' },
  { href: '/turismo', title: 'Turismo', emoji: '🏖️', color: '#7c3aed', description: 'Pontos de interesse' },
  { href: '/protecao-civil', title: 'Proteção Civil', emoji: '🔥', color: '#ea580c', description: 'Ocorrências ANPC' },
  { href: '/hospitais', title: 'Hospitais', emoji: '🏥', color: '#dc2626', description: 'Urgências SNS' },
  { href: '/transportes', title: 'Transportes', emoji: '🚆', color: '#2563eb', description: 'CP · Carris · TML' },
  { href: '/metro-porto', title: 'Metro do Porto', emoji: '🚇', color: '#9333ea', description: 'Estações e partidas' },
  { href: '/servicos-publicos', title: 'Serviços Públicos', emoji: '🚓', color: '#1d4ed8', description: 'PSP e GNR' },
  { href: '/codigo-postal', title: 'Código Postal', emoji: '📮', color: '#0d9488', description: 'Pesquisa e mapa' },
  { href: '/nif', title: 'Validar NIF', emoji: '🪪', color: '#0891b2', description: 'Verificar um NIF' },
  { href: '/contratos', title: 'Contratos Públicos', emoji: '📑', color: '#475569', description: 'Contratos BASE' },
  { href: '/fundos', title: 'Fundos PRR / PT2030', emoji: '🇪🇺', color: '#1e40af', description: 'Investimentos PRR' },
]
