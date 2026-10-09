import { useState } from 'react'
import { ScrollView } from 'react-native'
import { ScreenHeader, SegmentedTabs, uiStyles } from '../components/ui'
import { ComboiosTab } from '../components/transportes/Comboios'
import { CarrisTab } from '../components/transportes/Carris'
import { AlertasTmlTab } from '../components/transportes/AlertasTml'

type Tab = 'cp' | 'carris' | 'tml'

const TABS: { value: Tab; label: string }[] = [
  { value: 'cp', label: '🚆 Comboios CP' },
  { value: 'carris', label: '🚌 Carris' },
  { value: 'tml', label: '⚠️ Alertas TML' },
]

export default function Transportes() {
  const [tab, setTab] = useState<Tab>('cp')
  return (
    <ScrollView style={uiStyles.container} contentContainerStyle={uiStyles.content} keyboardShouldPersistTaps="handled">
      <ScreenHeader
        title="🚆 Transportes"
        subtitle="Comboios CP em tempo real · Carris Metropolitana · Alertas TML Lisboa/Setúbal"
      />
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'cp' && <ComboiosTab />}
      {tab === 'carris' && <CarrisTab />}
      {tab === 'tml' && <AlertasTmlTab />}
    </ScrollView>
  )
}
