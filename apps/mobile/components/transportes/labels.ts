// Etiquetas e cores partilhadas pelo ecrã Transportes (iguais às de apps/web/src/pages/Transportes.tsx).

export const SERVICE_COLORS: Record<string, string> = {
  'Alfa Pendular': '#dc2626',
  'Intercidades': '#ea580c',
  'InterRegional': '#d97706',
  'Regional': '#16a34a',
  'Urbano de Lisboa': '#2563eb',
  'Urbano do Porto': '#7c3aed',
  'Urbano de Coimbra': '#0891b2',
  'Fertagus': '#0d9488',
  'Histórico': '#78716c',
}

export const CAUSE_LABEL: Record<string, string> = {
  CONSTRUCTION: '🏗️ Obras',
  ROAD_ISSUE: '🚧 Problema na estrada',
  WEATHER: '🌩️ Mau tempo',
  DEMONSTRATION: '📢 Manifestação',
  NETWORK_UPDATE: '🔄 Atualização de rede',
  OTHER_CAUSE: 'ℹ️ Outra causa',
}

const EFFECT_COLORS: Record<string, { color: string; background: string }> = {
  SIGNIFICANT_DELAYS: { color: '#991b1b', background: '#fee2e2' },
  DETOUR: { color: '#9a3412', background: '#ffedd5' },
  REDUCED_SERVICE: { color: '#854d0e', background: '#fef9c3' },
  MODIFIED_SERVICE: { color: '#1e40af', background: '#dbeafe' },
  ADDITIONAL_SERVICE: { color: '#166534', background: '#dcfce7' },
  STOP_MOVED: { color: '#6b21a8', background: '#f3e8ff' },
  ACCESSIBILITY_ISSUE: { color: '#334155', background: '#f1f5f9' },
}

export const EFFECT_LABEL: Record<string, string> = {
  SIGNIFICANT_DELAYS: 'Atrasos',
  DETOUR: 'Desvio',
  REDUCED_SERVICE: 'Serviço reduzido',
  MODIFIED_SERVICE: 'Serviço alterado',
  ADDITIONAL_SERVICE: 'Serviço adicional',
  STOP_MOVED: 'Paragem movida',
  ACCESSIBILITY_ISSUE: 'Acessibilidade',
}

export const TRAIN_STATUS_LABEL: Record<string, string> = {
  IN_TRANSIT: 'Em trânsito',
  AT_STATION: 'Na estação',
  AT_ORIGIN: 'Na origem',
  NEAR_NEXT: 'A chegar',
}

export const VEHICLE_STATUS_LABEL: Record<string, string> = {
  INCOMING_AT: 'A chegar à paragem',
  STOPPED_AT: 'Parado na paragem',
  IN_TRANSIT_TO: 'Em trânsito',
}

export const effectColors = (effect: string) => EFFECT_COLORS[effect] ?? { color: '#334155', background: '#f1f5f9' }

export function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatClock(ts: number, withSeconds = false) {
  return new Date(ts).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  })
}

export const byNumeric = (a: string, b: string) => a.localeCompare(b, 'pt', { numeric: true })
