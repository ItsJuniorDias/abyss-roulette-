# Arquitetura do Aurum Club

Implementação baseada no documento `monorepo/.run/exports/ARCHITECTURE.md` fornecido para o refactor. Este repositório continua independente. A composição usa React e TypeScript estrito, mantendo Three.js como renderer da roleta e DOM acessível nos controles.

## Responsabilidades

| Camada | Contrato neste jogo |
| --- | --- |
| `app/` | Cria a sessão, injeta adapters e monta/desmonta a raiz React. |
| `components/app/` | Mantém áudio e tratamento de falhas acima da cena. |
| `components/scene-manager/` | Exibe carregamento ou gameplay conforme a prontidão. |
| `scenes/` | Compõe HUD, mascote, roleta, resultado e painéis. Guarda apenas interação local, como o painel aberto. |
| `components/` | JSX, props tipadas e callbacks; sem cálculo de pagamento. |
| `hooks/` | Input, observadores, ticker, playback, acessibilidade, efeitos e limpeza. |
| `stores/` | Sessão Zustand por instância: créditos demo, apostas e checkpoints da rodada. |
| `providers/` | Fábricas de recursos com `dispose`: mundo Three.js, áudio e composição de vídeo. |
| `adapters/` | Porta de resultado demo e persistência local versionada. |
| `animations/` | Funções puras de trajetória e keyframes; não escolhem resultados. |
| `config/` | Regras, layout, timings, aparência e aliases de assets. |
| `interfaces/` / `types/` | Props/contratos e uniões/aliases, respectivamente. |
| `utils/` | Validação, formatação e helpers independentes do renderer. |

Os imports locais incluem `.ts`/`.tsx`, os componentes têm exports nomeados e raiz `components/<nome>/index.tsx`, e as props ficam em `interfaces/`. Não há código JavaScript de jogo em paralelo ao TypeScript, `allowJs`, `any` explícito ou supressões de verificação.

## Sessão e apresentação

```text
Bootstrap → GameStore + RoulettePort + GameStorage
App → AudioSession → SceneManager → GameplayScene
UI → requestSpin → RoulettePort.play → validação → spin
Three.js → finishSpin(roundId) → result
Apresentação do resultado → finishResult(roundId) → bet
```

A store existe acima das cenas. Cada requisição tem UUID e apostas copiadas. `requesting` bloqueia novas submissões antes do primeiro `await`. O adapter retorna pocket, apostas, total apostado, pagamento e saldo; a sessão valida identidade, inteiros e consistência antes de apresentar. Não há retry automático.

`finishSpin` e `finishResult` verificam **ID e etapa**. Checkpoints antigos ou repetidos não avançam outra rodada. A roleta confirma o fim da trajetória; a animação de permanência do resultado confirma sua própria conclusão. Um timer externo não liquida a rodada. Valores por frame permanecem no hook, sem publicar 60 atualizações por segundo na store.

Na demonstração, a reserva de fichas é local e a liquidação utiliza o saldo retornado pelo adapter. `createDemoRoulette` calcula pagamentos apenas por ser uma simulação: a animação não usa sua aleatoriedade visual para decidir pocket ou pagamento. IDs repetidos recebem o mesmo resultado aceito durante a sessão; o cache é limitado a 100 rodadas e não é uma garantia de idempotência remota.

## Recuperação e ciclo de vida

O save v2 grava separadamente o saldo reservado e o resultado aceito pendente. No bootstrap, primeiro reconstrói a sessão; quando o renderer fica pronto, apresenta a rodada pendente. Depois da liquidação, grava saldo final e remove a pendência. Apostas ainda não submetidas retornam ao saldo ao recarregar. Saves antigos de Aurum e Abyss são aceitos e normalizados; saves corrompidos não são aplicados.

Esse contrato é exclusivo da demonstração local. Múltiplas abas não têm reconciliação financeira entre si. Um futuro RGS deve oferecer recuperação autoritativa e idempotência persistente, inclusive quando a resposta se perde. Seu cache remoto deve ficar na integração de API, sem duplicação desnecessária em Zustand, e sua operação de liquidação precisa ser explícita.

Cada recurso possui um dono: os hooks removem listeners, cancelam animações e desconectam observers; os providers encerram vídeos, áudio e GPU. React StrictMode exercita montagem/limpeza no desenvolvimento. A perda de contexto WebGL bloqueia a entrada e pausa a apresentação até a restauração. Respostas recebidas após o encerramento da sessão são descartadas.

## Assets, ambiente e testes

Os caminhos de mídia estão centralizados em `config/assets.ts`. Os exports atuais continuam em `public/` para preservar o pipeline de Python/FFmpeg, os manifestos e os vídeos alpha aprovados. Não foi criado um pipeline Pixi AssetPack/CDN nem dependências `@jungle/*`, pois o jogo não pertence ao workspace e não consome esses pacotes. Traduções ficam em `assets/locales/en.json`; fontes e tokens visuais permanecem locais.

O único perfil implementado é `demo`, independente de `NODE_ENV`. Um perfil desconhecido falha com mensagem acessível. `.env.example` diferencia configuração pública de credenciais usadas pelos scripts.

- Testes `*.test.ts` ficam junto às regras, adapters, store e cálculos.
- `tests/support/` mantém os doubles de vídeo/canvas/Web Audio. Os harnesses Node `.mjs` transpilam os providers TypeScript reais para testar os recursos sem depender do relógio do decoder de um navegador.
- Os comandos antigos `node --test scripts/test-mascot.mjs` e `scripts/test-audio.mjs` continuam como wrappers.
- `assets:check` verifica arquivos, checksums de áudio, manifesto dos clips e ambos os formatos alpha.
- `verify` executa lint, formatação, testes, assets, tipos e build.
- A verificação visual no navegador usa prontidão `data-ready`, fase `data-phase` e o estado observado do mascote. Esses atributos são somente observabilidade; não controlam a sessão.

A validação no viewport móvel não substitui a reprodução em iPhone físico, especialmente para HEVC alpha e políticas de autoplay do WebKit.
