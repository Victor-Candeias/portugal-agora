import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Combustivel } from '@/pages/Combustivel'
import { Tempo } from '@/pages/Tempo'
import { EV } from '@/pages/EV'
import { ProtecaoCivil } from '@/pages/ProtecaoCivil'
import { Hospitais } from '@/pages/Hospitais'
import { Transportes } from '@/pages/Transportes'
import { Economia } from '@/pages/Economia'
import { CodigoPostal } from '@/pages/CodigoPostal'
import { Turismo } from '@/pages/Turismo'
import { MetroPorto } from '@/pages/MetroPorto'
import { ServicosPublicos } from '@/pages/ServicosPublicos'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="combustivel" element={<Combustivel />} />
            <Route path="tempo" element={<Tempo />} />
            <Route path="ev" element={<EV />} />
            <Route path="protecao" element={<ProtecaoCivil />} />
            <Route path="hospitais"   element={<Hospitais />} />
            <Route path="transportes" element={<Transportes />} />
            <Route path="economia"    element={<Economia />} />
            <Route path="codigo-postal" element={<CodigoPostal />} />
            <Route path="turismo" element={<Turismo />} />
            <Route path="metro-porto" element={<MetroPorto />} />
            <Route path="servicos-publicos" element={<ServicosPublicos />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
