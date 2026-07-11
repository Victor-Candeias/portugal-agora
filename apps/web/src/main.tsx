import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Layout } from '@/components/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Combustivel } from '@/pages/Combustivel'
import { Tempo } from '@/pages/Tempo'
import { EV } from '@/pages/EV'
import { ProtecaoCivil } from '@/pages/ProtecaoCivil'
import { Economia } from '@/pages/Economia'
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
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="combustivel" element={<Combustivel />} />
            <Route path="tempo" element={<Tempo />} />
            <Route path="ev" element={<EV />} />
            <Route path="protecao" element={<ProtecaoCivil />} />
            <Route path="economia" element={<Economia />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
