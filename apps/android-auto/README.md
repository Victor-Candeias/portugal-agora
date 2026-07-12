# Portugal Hoje Android Auto

Aplicação Android Auto nativa em Kotlin para o projeto Portugal Hoje, construída com a Car App Library.

## Pré-requisitos

- Android Studio
- JDK 17
- Android SDK com API 34
- Variável de ambiente `VITE_APIABERTA_KEY` configurada com a mesma chave usada pela app web

## Build

```bash
cd apps/android-auto
./gradlew assembleDebug
```

## Configuração da API ANPC

Antes de compilar, exporte a chave da API aberta:

```bash
export VITE_APIABERTA_KEY="<sua-chave>"
```

A chave é injetada em `BuildConfig.APIABERTA_KEY` durante o build.

## Testar no Android Auto Desktop Head Unit (DHU)

1. Ligue um dispositivo Android com modo programador ativo.
2. Abra a app no Android Studio e instale a variante `debug`.
3. Inicie o Desktop Head Unit (DHU) a partir do Android SDK.
4. Ligue o dispositivo ao DHU e valide as 5 secções:
   - Proteção Civil
   - Combustível
   - Hospitais SNS
   - Tempo
   - Transportes CP
