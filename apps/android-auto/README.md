# Portugal Hoje Android Auto

Aplicação Android Auto nativa em Kotlin para o projeto Portugal Hoje, construída com a Car App Library.
Registada no Android Auto como app de **pontos de interesse** (`androidx.car.app.category.POI`).

## Pré-requisitos

- Android Studio
- JDK 17 (o lint do AGP 8.3 falha com JDK 25: `IllegalArgumentException: 25.0.2`)
- Android SDK com API 36 (compileSdk/targetSdk 36)
- Variável de ambiente `APIABERTA_KEY` com a mesma chave usada pela app web
  (`VITE_APIABERTA_KEY` continua a ser aceite por compatibilidade)

## Build

```bash
cd apps/android-auto
./gradlew assembleDebug     # debug: aceita qualquer host (DHU)
./gradlew assembleRelease   # release: R8/minify + allowlist de hosts oficiais
```

A chave é injetada em `BuildConfig.APIABERTA_KEY` durante o build:

```bash
export APIABERTA_KEY="<sua-chave>"
```

## Assinatura de release

O build de release é assinado apenas se estas variáveis estiverem definidas
(caso contrário é gerado sem assinatura). Nunca fazer commit da keystore nem das passwords.

| Variável | Descrição |
|---|---|
| `ANDROID_KEYSTORE_PATH` | Caminho para a keystore de upload (`.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | Password da keystore |
| `ANDROID_KEY_ALIAS` | Alias da chave |
| `ANDROID_KEY_PASSWORD` | Password da chave |

## Testar no Android Auto Desktop Head Unit (DHU)

1. No telemóvel, abra as definições do Android Auto, toque 10× em **Versão** para ativar o modo
   programador e, no menu ⋮ → **Definições do programador**, ative **Fontes desconhecidas**
   (sem isto, apps não instaladas pela Play Store não aparecem no carro).
2. Instale a variante `debug` (`./gradlew installDebug`) e abra a app uma vez no telemóvel
   para conceder a permissão de localização.
3. No menu ⋮ do Android Auto escolha **Iniciar servidor da unidade principal**.
4. No PC:
   ```bash
   adb forward tcp:5277 tcp:5277
   $ANDROID_HOME/extras/google/auto/desktop-head-unit
   ```
5. Valide as 8 secções:
   - Proteção Civil
   - Combustível
   - Hospitais SNS
   - Tempo
   - Transportes CP
   - Carregamento EV (tarifas por CEME para 10/20/30/50 kWh)
   - Turismo (SIGTUR, ICNF e UNESCO a 25 km, por categoria)
   - Serviços Públicos (esquadras/postos de polícia mais próximos; o `.sqlite` é descarregado na 1.ª vez)

   Nos ecrãs com mapa (Combustível, Hospitais, Turismo, Serviços Públicos), tocar num item abre o
   detalhe com o mapa centrado nesse local; **Navegar** entrega o destino à app de navegação
   (Google Maps/Waze), que calcula a rota a partir da posição atual. Apps POI não podem desenhar rotas.
   Para voltar do Maps à app, toque no ícone da app na barra: o ecrã de detalhe mantém-se.

## Publicação no Google Play

Apps Android Auto só são distribuídas pela Play Store, depois de ativar o fator de forma
Android Auto na Play Console e passar a revisão de qualidade. A categoria POI cobre
Combustível e Hospitais; Proteção Civil, Tempo e Transportes CP podem não ser aceites
(ver `.maestru/specs/mobile/mob-006-spec.md`).
