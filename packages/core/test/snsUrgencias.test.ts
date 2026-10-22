import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  compactSnsObservations,
  describeSnsObservations,
  expandSnsSeries,
  filterSnsSeries,
  formatSnsDate,
  normalizeSnsEmergencyRecord,
  normalizeSnsEmergencyRecords,
  snsDataState,
  snsLatestObservation,
  snsRangeBounds,
  snsSeriesWithGaps,
  type SnsEmergencyObservation,
} from '../src/utils/snsUrgencias.ts'

const EPIS = 'Número estimado de episódios de urgência'
const ESPERA = 'Tempo médio de espera entre a triagem e a primeira observação médica'

const raw = (periodo: unknown, ars: string, indicador: string, valor: unknown, unidade = 'minuto') => ({
  periodo,
  ars,
  indicador,
  valor,
  unidade,
  id: 'nome antigo do indicador',
})

test('normaliza um registo real e ignora o id', () => {
  const r = normalizeSnsEmergencyRecord(raw('2026-10-19', 'ARS Norte', EPIS, 6273, 'episódio urgência'))
  assert.deepEqual(r, {
    ok: true,
    observation: {
      sourceDataset: 'atividade-sindrome-gripal-csh',
      ars: 'ARS Norte',
      indicador: EPIS,
      periodo: '2026-10-19',
      valor: 6273,
      unidade: 'episódio urgência',
    },
  })
})

test('periodo fica como data civil, sem conversão de fuso', () => {
  const r = normalizeSnsEmergencyRecord(raw('2026-10-19T23:30:00-05:00', 'ARS Norte', ESPERA, 64.11))
  assert.equal(r.ok && r.observation.periodo, '2026-10-19')
})

test('rejeita valores em falta (nunca zero), datas e campos inválidos', () => {
  assert.deepEqual(normalizeSnsEmergencyRecord(raw('2026-10-19', 'ARS Algarve', ESPERA, null)), { ok: false, reason: 'missing-field' })
  assert.deepEqual(normalizeSnsEmergencyRecord(raw('2026-10-19', 'ARS Norte', ESPERA, 'n/d')), { ok: false, reason: 'invalid-value' })
  assert.deepEqual(normalizeSnsEmergencyRecord(raw('2026-02-30', 'ARS Norte', ESPERA, 1)), { ok: false, reason: 'invalid-date' })
  assert.deepEqual(normalizeSnsEmergencyRecord(raw('19/10/2026', 'ARS Norte', ESPERA, 1)), { ok: false, reason: 'invalid-date' })
  assert.deepEqual(normalizeSnsEmergencyRecord(raw('2026-10-19', '  ', ESPERA, 1)), { ok: false, reason: 'missing-field' })
  assert.deepEqual(normalizeSnsEmergencyRecord(null), { ok: false, reason: 'missing-field' })
})

test('remove duplicados pela chave lógica (fica o último) e ordena', () => {
  const summary = normalizeSnsEmergencyRecords([
    raw('2026-10-20', 'ARS Norte', ESPERA, 71.25),
    raw('2026-10-19', 'ARS Norte', ESPERA, 60),
    raw('2026-10-19', 'Portugal Continental', ESPERA, 73.17),
    raw('2026-10-19', 'ARS Norte', ESPERA, 64.11),
    raw('2026-10-19', 'ARS Norte', ESPERA, null),
  ])
  assert.equal(summary.duplicates, 1)
  assert.equal(summary.rejectedCount, 1)
  assert.deepEqual(
    summary.observations.map(o => [o.periodo, o.ars, o.valor]),
    [['2026-10-19', 'Portugal Continental', 73.17], ['2026-10-19', 'ARS Norte', 64.11], ['2026-10-20', 'ARS Norte', 71.25]],
  )
})

const obs = (periodo: string, ars: string, indicador: string, valor: number, unidade = 'minuto'): SnsEmergencyObservation => ({
  sourceDataset: 'atividade-sindrome-gripal-csh',
  ars,
  indicador,
  periodo,
  valor,
  unidade,
})

const sample = [
  obs('2026-10-16', 'ARS Norte', ESPERA, 60),
  obs('2026-10-18', 'ARS Norte', ESPERA, 0),
  obs('2026-10-19', 'ARS Norte', ESPERA, 64.11),
  obs('2026-10-20', 'ARS Algarve', EPIS, 1019, 'episódio urgência'),
  obs('2026-10-19', 'ARS Algarve', EPIS, 1105, 'episódio urgência'),
]

test('lacunas: um ponto por dia, dias sem registo a null e zero real preservado', () => {
  const points = snsSeriesWithGaps(sample, { indicador: ESPERA, ars: 'ARS Norte', fromDate: '2026-10-15', toDate: '2026-10-20' })
  assert.deepEqual(points.map(p => [p.periodo, p.valor, p.missing]), [
    ['2026-10-15', null, true],
    ['2026-10-16', 60, false],
    ['2026-10-17', null, true],
    ['2026-10-18', 0, false],
    ['2026-10-19', 64.11, false],
    ['2026-10-20', null, true],
  ])
})

test('lacunas atravessam a mudança de hora sem saltar nem repetir dias', () => {
  const points = snsSeriesWithGaps([], { indicador: ESPERA, ars: 'ARS Norte', fromDate: '2026-10-24', toDate: '2026-10-27' })
  assert.deepEqual(points.map(p => p.periodo), ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'])
})

test('Algarve sem o indicador: só lacunas e sem última observação', () => {
  const points = snsSeriesWithGaps(sample, { indicador: ESPERA, ars: 'ARS Algarve', fromDate: '2026-10-19', toDate: '2026-10-20' })
  assert.ok(points.every(p => p.valor === null && p.missing))
  assert.equal(snsLatestObservation(sample, { indicador: ESPERA, ars: 'ARS Algarve' }), null)
})

test('última observação por indicador e região', () => {
  assert.equal(snsLatestObservation(sample, { indicador: ESPERA, ars: 'ARS Norte' })?.periodo, '2026-10-19')
  assert.equal(snsLatestObservation(sample, { ars: 'ARS Algarve' })?.valor, 1019)
  assert.equal(snsLatestObservation(sample)?.periodo, '2026-10-20')
  assert.equal(snsLatestObservation([]), null)
})

test('filtro por intervalo inclusivo e por ordem cronológica', () => {
  const { fromDate, toDate } = snsRangeBounds('2026-10-19', 2)
  assert.deepEqual([fromDate, toDate], ['2026-10-18', '2026-10-19'])
  assert.equal(snsRangeBounds('2026-10-20', 90, '2026-07-25').fromDate, '2026-07-25')
  assert.deepEqual(filterSnsSeries(sample, { indicador: ESPERA, ars: 'ARS Norte', fromDate, toDate }).map(o => o.valor), [0, 64.11])
})

test('série compacta ida e volta e deteção de mudança de unidade', () => {
  const series = { sourceDataset: 'atividade-sindrome-gripal-csh', series: compactSnsObservations(sample) }
  assert.deepEqual(expandSnsSeries(series), normalizeSnsEmergencyRecords(sample).observations)
  assert.throws(() => compactSnsObservations([...sample, obs('2026-10-21', 'ARS Norte', ESPERA, 1, 'hora')]), /Unidades diferentes/)
})

test('metadados vêm dos dados: Algarve só com o número de episódios', () => {
  const d = describeSnsObservations(sample)
  assert.deepEqual(d.indicators.map(i => [i.indicador, i.regions]), [[EPIS, ['ARS Algarve']], [ESPERA, ['ARS Norte']]])
  assert.deepEqual([d.firstPeriod, d.latestPeriod], ['2026-10-16', '2026-10-20'])
})

test('estado: atraso e sincronização possivelmente desatualizada', () => {
  const now = Date.parse('2026-10-22T12:00:00Z')
  const fresh = { status: 'fresh' as const, possiblyStale: false, lastSuccessfulSyncAt: '2026-10-22T03:00:00Z' }
  assert.deepEqual(snsDataState({ latestPeriod: '2026-10-20', status: fresh, now }), {
    delayDays: 2,
    delayed: false,
    syncAgeHours: 9,
    possiblyStale: false,
  })
  assert.equal(snsDataState({ latestPeriod: '2026-10-15', status: fresh, now }).delayed, true)
  assert.equal(snsDataState({ latestPeriod: '2026-10-20', status: { ...fresh, status: 'republished' }, now }).possiblyStale, true)
  assert.equal(snsDataState({ latestPeriod: '2026-10-20', status: { ...fresh, lastSuccessfulSyncAt: '2026-10-20T03:00:00Z' }, now }).possiblyStale, true)
})

test('formatação da data sem passar por fusos', () => {
  assert.equal(formatSnsDate('2026-10-19'), '19/10/2026')
})
