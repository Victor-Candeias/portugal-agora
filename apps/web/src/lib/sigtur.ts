import { configureSigturRequestUrl } from '@portugal-hoje/core'

// Dev: proxied via Vite (/api/sigtur → https://geo.turismodeportugal.pt/server/rest/services/TDP)
// Prod: via corsproxy.io to bypass CORS (o servidor só permite CORS para origens oficiais)
// Ver padrão idêntico em src/hooks/useTransportes.ts (comboios.live).
const REAL_BASE = 'https://geo.turismodeportugal.pt/server/rest/services/TDP'

configureSigturRequestUrl((url) =>
  import.meta.env.DEV
    ? url.replace(REAL_BASE, '/api/sigtur')
    : `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
)
