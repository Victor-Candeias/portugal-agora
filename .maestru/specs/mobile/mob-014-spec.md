---
maestru: "0.4"
type: work-spec
id: mob-014-spec
title: "Android Auto: detalhe do local no mapa + navegar — Implementation Plan"
template: implementation-plan-v1
work-item: mobile/MOB-014
owner: developer
created: 2026-10-09
---

# Android Auto: detalhe do local no mapa + navegar — Implementation Plan

## Overview

Nos ecrãs do Android Auto com `PlaceListMapTemplate` (Combustível, Hospitais SNS, Turismo por
categoria, Serviços Públicos), tocar numa linha passa a abrir o detalhe desse local com o mapa
centrado nele, e a partir daí pedir a rota desde a posição atual.

Decisões:
- **Rota delegada na app de navegação.** A app é da categoria POI: só apps de navegação
  (`androidx.car.app.category.NAVIGATION`, `NavigationTemplate`) podem calcular/desenhar rotas.
  Usa-se `carContext.startCarApp(Intent(CarContext.ACTION_NAVIGATE, "geo:lat,lng"))`, o mecanismo
  oficial; o Google Maps/Waze calcula o caminho a partir da posição atual do carro.
  Se não houver app de navegação, mostra-se um `CarToast`.
- **Centrar o mapa = ecrã de detalhe com um só local.** O `PlaceListMapTemplate` ajusta o mapa aos
  marcadores das linhas e não tem API para centrar num item ao tocar (`MapWithContentTemplate` só
  existe na Car API 7 e a app suporta `minCarApiLevel=1`). Com uma única linha o host centra o mapa
  nesse ponto. Marcador explícito (`PlaceMarker`, azul).
- **Ação "Navegar" só no `ActionStrip`.** Tocar no cartão do detalhe não faz nada: antes também
  navegava, e um toque acidental abria o Maps com as coordenadas como título e "A carregar
  resultados da pesquisa" (parecia que o texto desaparecia).
- O Google Maps no Android Auto ignora o rótulo `geo:lat,lng?q=lat,lng(Nome)` e mostra como destino
  o POI mais próximo das coordenadas; usa-se só `geo:lat,lng` (a rota vai para as coordenadas certas).
- **Regresso à app:** o host não oferece "voltar" a partir da app de navegação; volta-se pelo ícone
  da app na barra, e o ecrã de detalhe mantém-se (a pilha de ecrãs é preservada).
- Profundidade máxima: Menu → Turismo → Categoria → Detalhe = 4 ecrãs (limite de 5 passos do host).
- A linha do detalhe continua a usar `distanceText` (`DistanceSpan`, MOB-012).

## Implementation

### Fase 1 — Utilitários e ecrã
- `utils/Navigation.kt` — `navigateTo(carContext, lat, lng)`.
- `screens/PlaceDetailScreen.kt` — `PlaceListMapTemplate` com uma linha (não clicável) + `ActionStrip` "Navegar".

### Fase 2 — Ligar as listas
- `setOnClickListener` em cada linha de `CombustivelScreen`, `HospitaisScreen`,
  `TurismoCategoriaScreen` e `ServicosPublicosScreen` → `screenManager.push(PlaceDetailScreen(...))`.

### Fase 3 — Validação
- `assembleDebug`, instalar no telemóvel e testar no DHU: tocar num item → mapa centrado →
  "Navegar" abre a app de navegação com a rota; `adb logcat -b crash` sem crashes.

## Impacted Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/utils/Navigation.kt` | create | Intent `ACTION_NAVIGATE` para a app de navegação |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/PlaceDetailScreen.kt` | create | Mapa centrado no local + Navegar |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/CombustivelScreen.kt` | modify | Clique na linha → detalhe |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/HospitaisScreen.kt` | modify | Clique na linha → detalhe |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/TurismoScreen.kt` | modify | Clique na linha → detalhe |
| `apps/android-auto/app/src/main/kotlin/pt/portugalhoje/auto/screens/ServicosPublicosScreen.kt` | modify | Clique na linha → detalhe |
| `apps/android-auto/README.md` | modify | Documentar o fluxo |
