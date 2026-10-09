import { useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  countPrrProjectsByComponent,
  filterPrrProjects,
  formatPt2030Budget,
  groupPrrProjects,
  type PrrComponent,
  type PrrProject,
} from '@portugal-hoje/core'
import { usePrrProjects, usePrrSummary, usePt2030Summary } from '../hooks/useFundos'
import {
  Card, ChipRow, COLORS, EmptyText, ErrorView, LinkText, LoadingView, Notice, ScreenHeader, SearchInput, SectionTitle, uiStyles,
} from '../components/ui'

const NO_COMPONENTS: PrrComponent[] = []
const NO_PROJECTS: PrrProject[] = []

// Fundos PRR / PT2030 (WEB-032): resumo do PRR por componente, investimentos com pesquisa e resumo do PT2030.
export default function Fundos() {
  const [query, setQuery] = useState('')
  const [component, setComponent] = useState<string | null>(null)

  const summary = usePrrSummary()
  const projects = usePrrProjects()
  const pt2030 = usePt2030Summary()

  const components = summary.data?.components ?? NO_COMPONENTS
  const allProjects = projects.data ?? NO_PROJECTS
  const counts = useMemo(() => countPrrProjectsByComponent(allProjects), [allProjects])
  const groups = useMemo(
    () => groupPrrProjects(filterPrrProjects(allProjects, { q: query, component }), components),
    [allProjects, components, query, component],
  )
  const shown = groups.reduce((n, g) => n + g.projects.length, 0)

  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="🇪🇺 Fundos PRR / PT2030"
        subtitle="Plano de Recuperação e Resiliência e Portugal 2030 · Fonte: transparencia.gov.pt via API Aberta"
      />

      <Card>
        <SectionTitle>PRR</SectionTitle>
        {summary.isLoading && <LoadingView />}
        {summary.isError && <ErrorView error={summary.error} onRetry={() => summary.refetch()} />}
        {summary.data && (
          <>
            <Text style={styles.plan}>{summary.data.plan}</Text>
            <View style={styles.stats}>
              <Stat label="Execução" value={summary.data.execution_period.replace('-', '–')} />
              <Stat label="Componentes" value={String(summary.data.total_components)} />
              <Stat label="Investimentos" value={String(summary.data.total_investments)} />
            </View>
            <SourceLink href={summary.data.source} />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>PT2030</SectionTitle>
        {pt2030.isLoading && <LoadingView />}
        {pt2030.isError && <ErrorView error={pt2030.error} onRetry={() => pt2030.refetch()} />}
        {pt2030.data && (
          <>
            <Text style={styles.plan}>{pt2030.data.plan}</Text>
            <View style={styles.stats}>
              <Stat label="Período" value={pt2030.data.execution_period.replace('-', '–')} />
              <Stat label="Orçamento" value={formatPt2030Budget(pt2030.data.total_budget)} />
            </View>
            <Text style={styles.note}>A API Aberta só tem o resumo do PT2030 (sem lista de projetos).</Text>
            <SourceLink href={pt2030.data.source} />
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>
          Investimentos do PRR{allProjects.length > 0 ? ` (${shown} de ${allProjects.length})` : ''}
        </SectionTitle>
        <SearchInput value={query} onChangeText={setQuery} placeholder="Pesquisar (ex.: saúde, habitação)" />
        {components.length > 0 && (
          <View style={styles.chips}>
            <ChipRow
              options={components.map(c => ({ value: c.id, label: `${c.id} · ${c.name}${counts[c.id] ? ` (${counts[c.id]})` : ''}` }))}
              value={component}
              onChange={setComponent}
              allLabel="Todas"
            />
          </View>
        )}

        {projects.isLoading && <LoadingView />}
        {projects.isError && <ErrorView error={projects.error} onRetry={() => projects.refetch()} />}
        {projects.data && shown === 0 && <EmptyText>Nenhum investimento encontrado.</EmptyText>}

        {groups.map(g => (
          <View key={g.component.id} style={styles.group}>
            <Text style={styles.groupTitle}>
              <Text style={styles.groupId}>{g.component.id} </Text>
              {g.component.name}
              <Text style={styles.groupCount}> · {g.projects.length}</Text>
            </Text>
            {g.projects.map((p, i) => (
              <Text key={`${p.parent_id}-${i}`} style={styles.project}>{p.name}</Text>
            ))}
          </View>
        ))}
        {projects.data && (
          <Notice>Os nomes vêm da fonte sem acentos. A fonte não inclui montantes por investimento.</Notice>
        )}
      </Card>
    </ScrollView>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

function SourceLink({ href }: { href: string }) {
  if (!/^https?:\/\//.test(href)) return null
  return (
    <View style={uiStyles.actions}>
      <LinkText label={`🔗 ${href.replace(/^https?:\/\//, '')}`} onPress={() => Linking.openURL(href)} />
    </View>
  )
}

const styles = StyleSheet.create({
  plan: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10, marginTop: 10 },
  stat: { minWidth: '33%', paddingRight: 8 },
  statLabel: { fontSize: 11, fontWeight: '600', color: COLORS.faint, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 2 },
  note: { fontSize: 11, color: COLORS.faint, marginTop: 10 },
  chips: { marginTop: 10, marginBottom: 4 },
  group: { marginTop: 14 },
  groupTitle: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  groupId: { color: COLORS.primary, fontFamily: 'monospace' },
  groupCount: { color: COLORS.faint, fontWeight: '400' },
  project: { fontSize: 13, color: '#334155', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
})
