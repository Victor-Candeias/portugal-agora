import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/clients'

// Fundos PRR / PT2030 (WEB-032). Os dados mudam pouco: cache de 24 h.
const DAY = 24 * 60 * 60 * 1000

export function usePrrSummary() {
  return useQuery({ queryKey: ['prr', 'summary'], queryFn: () => apiClient.getPrrSummary(), staleTime: DAY })
}

// Lista completa (61 investimentos); a pesquisa é feita no cliente (`filterPrrProjects`).
export function usePrrProjects() {
  return useQuery({ queryKey: ['prr', 'projects'], queryFn: () => apiClient.getAllPrrProjects(), staleTime: DAY })
}

export function usePt2030Summary() {
  return useQuery({ queryKey: ['pt2030', 'summary'], queryFn: () => apiClient.getPt2030Summary(), staleTime: DAY })
}
