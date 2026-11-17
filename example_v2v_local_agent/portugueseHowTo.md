# Guia em português: exemplo DaVoice de agente local voz-a-voz (React Native)

> Para desenvolvedores que vão usar, testar ou copiar partes deste app de exemplo
> (`example_v2v_local_agent/` no repositório ReactNative_WakeWordDetection). Tudo aqui foi conferido no código (última atualização: 17/11/2026,
> `react-native-davoice-llm` 1.0.15: o núcleo com todos os recursos marcados como "núcleo de
> desenvolvimento" em 2.3, mais a Confiança local, 2.6). Os caminhos de arquivos são relativos à pasta
> `example_v2v_local_agent/`. A versão em inglês está em `englishHowTo.md`.

> **Status: modelos de teste, ainda em treinamento.** O modelo da demo do carro, que roda no
> aparelho ("DaVoice Automotive Agent 0.6B", checkpoint `g3c_it3639`, o padrão desde 17/11/2026),
> é **um modelo de teste, não um produto final**. Num conjunto lacrado de 128 frases novas,
> nunca vistas por ele (rodado uma única vez, português do Brasil e inglês, mesmo núcleo e mesmas
> configurações do app):
> - **86%** dos comandos do carro (92 de 107) terminaram exatamente na ação certa (ferramenta e
>   argumentos); só a primeira chamada do modelo já acertou 92% deles;
> - **2 de 128** turnos executaram uma ação errada, **nenhuma ação oposta** ("abrir" no lugar de
>   "fechar") e **nenhuma ação não suportada**; fala de fundo e fragmentos nunca viraram ação;
> - 6 comandos completos receberam "pode repetir" em vez da ação.
>
> Comparado ao modelo anterior (`r8d_it150`) nos mesmos testes: em 474 comandos novos em pt-BR o
> resultado final acerta 90,7% das vezes em vez de 84,2%, e uma ação errada roda 6,5% das vezes em
> vez de 10,1%; em conversas longas (12 conversas, 169 turnos) 89% dos turnos acertam em vez de
> 81%, e as continuações curtas ("o do passageiro", "não, pra mim") 78% em vez de 49%. Toda ação do
> carro é **simulada** e conferida pelo app antes de rodar (guards, 2.3), e a configuração
> **Confiança local** (2.6) pode mandar comandos incertos para um agente remoto. Considere os
> resultados uma prévia do pipeline de voz, não a precisão final.

O app demonstra um assistente de voz que roda no próprio aparelho:

- palavra de ativação (wake word);
- verificação de locutor (speaker verification / identificação do locutor);
- reconhecimento de fala (STT) e síntese de fala (TTS), com clonagem de voz;
- duas demos de IA local (LLM no aparelho) com ferramentas:
  - **Demo do carro:** um carro Volkswagen simulado (vidros, portas, travas, ar-condicionado,
    navegação, rádio...);
  - **Demo de calorias:** contador de calorias e memória pessoal.

Pacotes usados (`package.json`):

| Pacote | Para quê |
|---|---|
| `react-native-wakeword` | palavra de ativação + verificação de locutor (onboarding e verificação) |
| `react-native-davoice` | STT + TTS (`Speech`), clonagem de voz, filtro por locutor no STT |
| `react-native-davoice-llm` (1.0.15) | LLM no aparelho, `Agent` (turno completo de assistente), ferramentas, guards de chamada, Confiança local |
| `react-native-fs` | arquivos: assinatura de voz, modelos e pacotes de idioma baixados, estados de prompt salvos, banco do agente |

O que vai dentro do app e o que é baixado (e como mudar isso): veja 1.5.

---

## 1. Como usar o app em português, etapa por etapa

### 1.1 Rodar o app

```bash
cd example_v2v_local_agent       # não precisa de Git LFS: nenhum modelo de voz vem dentro deste app (1.5)
npm install            # o projeto usa npm / package-lock.json
cd ios && pod install && cd ..
npx react-native run-android     # ou: npx react-native run-ios
```

- Em uma build *debug*, o JavaScript vem do Metro (`npx react-native start`). No Android,
  com o aparelho no USB: `adb reverse tcp:8081 tcp:8081`.
- **Build release no Android:** `cd android && ./gradlew :app:assembleRelease`.
  - `android/gradle.properties` dá 8 GB ao Gradle para empacotar o APK.
  - Nenhum modelo de voz vai dentro do APK: todo idioma é baixado quando é escolhido (1.5).
  - `android/app/build.gradle` refaz o bundle JS quando só os pacotes do agente (`agent/`,
    `agent_automotive/`) ou o JSON das ferramentas em `src/` mudam.
- Logs do JS no Android: `adb logcat | grep ReactNativeJS`.
- As chaves de licença DaVoice ficam no código do exemplo. Em outro app, use as suas
  (contato: info@davoice.io).

### 1.2 Fluxo de inicialização

1. **Idioma.** A primeira tela pergunta o idioma. Escolha **"Português do Brasil"**.
   - Também há Português de Portugal, inglês, alemão, grego, espanhol, francês, italiano,
     holandês, dinamarquês e sueco.
   - **Nenhum idioma vem dentro deste app.** Todo idioma, inglês e português do Brasil inclusive, é
     baixado na primeira vez que é escolhido: o botão mostra "⬇ N MB" e, ao escolhê-lo, abre a tela
     **Downloading language pack** (progresso, MB, Retry, Back). O app só continua quando o
     download termina. Detalhes e configuração: 1.5.
   - O hebraico tem suporte no código, mas está escondido nesta tela (`hidden: true` em
     `APP_LANGUAGES`) e não vem no app nem é baixável (a voz dele é só para uso não
     comercial).
   - A escolha define:
     - o modelo de TTS em português (`model_ex2_portuguese_brv1.dm`, baixado);
     - o codificador de voz para clonagem (`embedder_brv1.dm`, que acompanha o modelo);
     - o locale do STT (`pt-BR`);
     - o idioma das respostas do LLM;
     - o idioma do pacote do agente (`agent/pt-BR/`, e o mesmo em `agent_automotive/pt-BR/`).

   Configuração: `APP_LANGUAGES` em `src/appflow.ts` (os idiomas oferecidos) e
   `language_packs.json` (os arquivos de cada idioma, dentro do app ou baixados; veja 1.5).
2. **Permissão de microfone.** Aceite.
3. **Carregamento.** O app carrega a wake word e o STT/TTS. No Android pode aparecer
   "Preparing voice demo..." por alguns segundos.
4. **Apresentação falada (em português).** A narração está em `src/narration.ts`, chave
   `'pt-BR'`.
5. **Escolha da voz.** Você pode:
   - escolher uma voz integrada;
   - escolher uma voz clonada que você já criou;
   - **clonar uma nova voz** a partir de uma gravação (`src/tts/voiceClone.ts`).
6. **Verificação do locutor** (detalhes em 1.3). Três opções: criar uma nova assinatura de
   voz, usar a assinatura salva ou pular.
7. **Palavra de ativação.** A narração diz "Agora diga a palavra de ativação…". A palavra
   deste exemplo é **"Hey Coach"** (modelo `hey_coach_model_28_22012026b.dm`). É uma frase
   em inglês, também no modo português.
8. **Escolha do modo**, depois da wake word:

| Modo | O que faz |
|---|---|
| **Local AI · Car demo** | STT → Agente Automotivo no aparelho → TTS, com o carro simulado |
| **Local AI · Calories demo** | STT → Agente Pessoal no aparelho → TTS, com calorias e memória |
| Full AI Chat | STT → Gemini (nuvem) → TTS. Precisa de uma chave Gemini válida. |
| Combined STT + TTS | você fala e ouve o texto de volta |
| STT Only | só mostra a transcrição |
| Type to TTS | você digita e o app fala |

Para voltar à escolha de modo, use o botão de voltar do app (`goBackToModeSelection` em
`App.tsx`).

### 1.3 Verificação do locutor: configuração e por que ela importa

**O que é:** o app grava uma *assinatura de voz* do dono (enrollment) e depois compara
cada fala com essa assinatura.

**Como fazer o onboarding no app:**
1. Na etapa de verificação do locutor, escolha **criar uma nova assinatura**.
2. O app coleta **5 amostras** de fala (`SV_ONBOARDING_SAMPLE_COUNT` em `src/appflow.ts`).
   Fale frases naturais, uma por amostra, em ambiente silencioso, na distância normal de
   uso do telefone.
   - Sugestão (a do README, adaptada ao português): *"Hey Coach, por favor mande uma
     mensagem para o meu amigo. Como vai estar o tempo hoje? Coloca um timer de três
     minutos. Toca uma música pra mim. Toda manhã eu tomo um café olhando o nascer do sol."*
3. A assinatura é salva em `Documents/sv_enrollment.json`
   (`writeEnrollmentJsonToFile` em `src/speaker_verification/onboarding.ts`). Na próxima
   vez, escolha **usar a assinatura salva**.
4. Ao terminar, o app registra o locutor ao vivo na wake word **e** no STT
   (`applySpeakerVerificationChoice` em `App.tsx`):
   ```ts
   await wakewordInstance.addSpeaker(SV_SPEAKER_ID, enrollmentJsonPath); // react-native-wakeword
   await Speech.addSpeaker(SV_SPEAKER_ID, enrollmentJsonPath);           // react-native-davoice
   ```
   Se o usuário pular, o app chama `setSpeakers([])` nos dois. Uma lista vazia desliga o
   filtro.
5. Limiar de decisão: `SV_DECISION_THRESHOLD` em `src/appflow.ts` (0.34 no Android, 0.35
   no iOS).

**Por que isso importa, principalmente no carro.** Sem verificação, qualquer voz no
ambiente pode comandar o assistente: passageiro, rádio, alguém do lado de fora da janela.
Com a verificação ligada:
- a wake word só dispara com uma voz cadastrada;
- cada resultado do STT informa **quem** falou: `speakerIds` (todos os locutores
  verificados na frase) e `speakerId` (o último). Veja `SpeechResultsEvent` em
  `react-native-davoice`.

**Este exemplo já faz isso para as portas.** As ferramentas `open_door` e `unlock_car`
declaram um escopo de autorização em `src/car/carToolDefinitions*.json`:
```json
"execution": { "authorization": { "scope": "door_locks", "message": "Unlock the car?" } }
```
O núcleo do agente **nunca executa** uma ferramenta assim sem um "sim" do app. Ele envia um
pedido `authorizeTool` para `onRequest`, e `isToolAuthorized` em `src/agent/LocalAgent.ts`
responde com `ownerMayAct()` (`src/speaker_verification/currentSpeaker.ts`):
- verificação de locutor **desligada** (pulada): liberado (é uma demo);
- verificação **ligada**: liberado só se o dono cadastrado foi verificado nesse pedido. Outra
  voz recebe "não autorizado", e nada abre.

Outros escopos são recusados, a não ser que estejam em `AUTHORIZED_TOOL_SCOPES` (vazio). Para
uma confirmação simples de "sim/não", sem checar o locutor, a ferramenta declara
`execution.confirmation`; o exemplo faz isso em `send_message`, com um diálogo antes de
enviar.

### 1.4 Comandos de exemplo em português

Diga "Hey Coach", espere o app ouvir e fale um dos comandos:

- **Demo do carro:**
  - vidros: "abre o vidro traseiro direito", "fecha o vidro do carona", "abre o vidro da
    frente do lado esquerdo até a metade", "fecha todos os vidros", "abre os vidros de trás";
  - portas e travas: "abre a porta traseira esquerda", "fecha as portas", "tranca o carro",
    "destranca a porta do motorista";
  - ar-condicionado: "coloca o ar em vinte e dois graus", "esquenta dois graus", "deixa o lado
    do passageiro em vinte", "coloca 20 graus pro motorista e 23 pro passageiro",
    "ventilação no três", "liga o desembaçador do para-brisa";
  - mídia: "toca Caetano Veloso", "sintoniza noventa e oito vírgula cinco", "aumenta o
    volume";
  - navegação: "me leva pra casa", "quanto tempo falta?", "acha um posto no caminho";
  - estado do carro: "quanto de autonomia eu tenho?".
- **Pedidos incompletos (o app deve perguntar):**
  - "abre a janela" → "Qual janela você quer abrir?";
  - "liga o desembaçador" → "O da frente ou o de trás?".
- **Demo de calorias:**
  - "comi dois ovos";
  - "almocei um prato de arroz com feijão";
  - "quantas calorias hoje?";
  - "desfaz".
- **Conversa e conhecimento (nas duas demos):**
  - "quem é você?" (resposta fixa do pacote, `fixedReplies`);
  - "o que você pode fazer no carro?" (lista fixa das funções do carro);
  - "me conta uma curiosidade sobre o Brasil": o modelo passa adiante; sem modelo remoto
    configurado, o app responde com a mensagem de 2.2.

---

### 1.5 O que vai dentro do app e o que é baixado

Só o que todo usuário precisa vai dentro do app. Os arquivos grandes são baixados na primeira
vez que fazem falta (nunca na instalação), do Cloudflare R2 da DaVoice
(`https://pub-27f94b1602c647ab95a601086cf52820.r2.dev`), e cada um é conferido por sha256.

| O quê | Onde | Quando |
|---|---|---|
| Wake word (`hey_coach_model_28_22012026b.dm`), verificação de locutor (`sv.dm`) | dentro do app | sempre |
| Pacotes do agente (`agent/`, `agent_automotive/`), JSON das ferramentas do carro, narração | dentro do app | sempre |
| Modelo de TTS + codificador de clonagem de todos os idiomas (en, pt-BR, pt-PT, de, es, fr, it, nl, da, sv, el; 136–170 MB cada) | R2 `language-packs/<arquivo>` → aparelho `Documents/language_packs/<idioma>/` | na primeira vez que o idioma é escolhido |
| Modelos no aparelho (GGUF, 382 MB cada): Agente Automotivo `auto16_g3c_it3639` (padrão; `auto8_r8d_it150` e `auto5_r4b_it100` como reservas), Personal Agent `ft7f2_it900` | R2 `agent-llm/<arquivo>` → aparelho `Documents/local_llm/models/` | na primeira vez que a demo abre |
| Estado pré-aquecido do Agente Automotivo, inglês ou pt-BR (cerca de 430 MB) | R2 `agent-llm/prewarm/<arquivo>` → ao lado do modelo | junto com o modelo, no idioma do app |

**Configuração dos arquivos de idioma: `language_packs.json`** (em `example_v2v_local_agent/`):

```json
{
  "baseUrl": "https://pub-27f94b1602c647ab95a601086cf52820.r2.dev/language-packs",
  "bundled": [],
  "languages": {
    "fr": {
      "model":    { "file": "model_ex2_french.dm", "bytes": 144455696, "sha256": "7c8044b4…" },
      "embedder": { "file": "embedder_fr.dm",      "bytes": 22320622,  "sha256": "31d7787d…" }
    }
  }
}
```

- `bundled`: os idiomas que vêm dentro do app (nenhum neste exemplo). Todo outro idioma em
  `languages` é baixado de `baseUrl/<arquivo>`.
  - Para colocar um idioma dentro do app, acrescente o código dele em `bundled`. Os dois
    arquivos dele precisam estar em `assets/models/`. Cada um soma cerca de 136–168 MB ao app.
  - Para transformar um idioma em download, tire-o de `bundled`. Os arquivos dele precisam
    estar no R2 em `language-packs/`, com os mesmos nomes.
- Não é preciso editar mais nada. O Metro só coloca no app arquivos que aparecem num
  `require()` estático, então o app não consegue ler o JSON em tempo de execução. Por isso o
  `metro.config.js` roda `scripts/generate-language-packs.js` em todo bundle (servidor de
  desenvolvimento, release Android, iOS). Ele escreve `src/tts/languagePacks.generated.ts` com
  os `require()` dos arquivos que vão no app e a tabela de arquivos de todos os idiomas.
  - Uma configuração errada (idioma desconhecido, arquivo faltando, tamanho errado) para o
    build com uma mensagem.
  - Para rodar à mão: `node scripts/generate-language-packs.js`.
  - Depois de trocar um arquivo em `assets/models/`, rode com `--rehash` (ele atualiza
    `bytes` e `sha256`) e suba o arquivo novo para o R2 com o mesmo nome.
- Código:
  - `src/tts/languagePacks.ts`: download (para um arquivo temporário, depois sha256, depois
    movido para o lugar), checagem de espaço livre, cancelamento e uma checagem ao iniciar
    (arquivo presente com o tamanho certo);
  - `src/tts/index.ts`: `languageFile()` usa o arquivo do app ou, se não houver, o baixado;
  - `App.tsx`: `selectAppLanguage` e a tela de download.
- A biblioteca de voz aceita o caminho absoluto de um arquivo baixado do mesmo jeito que um
  asset do app (Android e iOS).

**Os modelos do aparelho e os estados pré-aquecidos** estão em `src/local_llm/constants.ts`
(`url`, `sizeBytes`, `sha256` e `prebuiltStates` por idioma). A tela de carregamento da demo
baixa o modelo e o estado pré-aquecido do idioma do app juntos, com uma só barra de progresso
(2.1). Um estado pré-aquecido só serve para o arquivo de modelo, o pacote do agente, as
ferramentas e as configurações de prompt exatos com que foi feito: depois de mudar qualquer
um deles, gere estados novos num aparelho (o app salva um depois do primeiro aquecimento),
suba-os e atualize `sha256` e `sizeBytes`.

**Manifesto remoto de vozes** (desenvolvimento, 12/11/2026): apps instalados podem receber novos
arquivos de voz sem atualizar o app.
- Ao iniciar, o app busca `<baseUrl>/manifest.json` em segundo plano. Ele só é usado quando a
  assinatura Ed25519 confere com a chave pública em `src/tts/languagePacks.ts` (a DaVoice guarda
  a chave privada fora de qualquer repositório), o esquema é um que o app lê e toda entrada é
  válida (nome do arquivo, tamanho, sha256). Qualquer outra coisa: a configuração embutida.
- Ele só muda quais arquivos de voz um idioma baixado usa: nunca código, nunca o LLM do
  aparelho, nunca um idioma que vem no app. Os arquivos continuam vindo da mesma pasta e são
  conferidos por sha256.
- Cada versão fica na sua própria pasta (`language_packs/<idioma>/<versão>/`) e só é usada
  quando os dois arquivos estão completos; a última versão que carregou
  (`markLanguagePackWorking`) é mantida, e uma versão nova que não carrega volta para a anterior
  (`rollbackLanguagePack`).

**Regras de hospedagem:**
- Primeiro suba, depois confira cada URL pública (HTTP 200, sha256 do download) e só então
  coloque a URL no app. Nunca chute uma URL.
- Antes de apagar um arquivo do R2, confirme que nenhum app ainda o lista (todos os apps de
  exemplo da DaVoice). Uma instalação que já tem o arquivo continua usando.

Os outros apps de exemplo da DaVoice (React Native com inglês e pt-BR dentro do app, Expo, Flutter) usam a
mesma pasta no R2, os mesmos arquivos de idioma e os mesmos modelos e estados pré-aquecidos.

## 2. As demos de IA local: o que esperar e como testar

### 2.1 As duas demos, os modelos e a tela de carregamento

| | Demo do carro | Demo de calorias |
|---|---|---|
| Modelo (padrão) | **DaVoice Automotive Agent 0.6B** | **DaVoice Personal Agent 0.6B** |
| Pacote do agente (prompt de sistema) | `agent_automotive/` (sem a skill de calorias) | `agent/` + `agent/skills/calories/` |
| Ferramentas | o carro simulado (`src/car/`, 22 ferramentas) | calorias, memória, busca na web |
| Cartão | Cartão do carro | Cartão de calorias |
| Banco de dados | `davoice_agent*_car.db` | `davoice_agent*.db` |

- **Implementação:** `src/local_llm/demo.ts` guarda a demo atual, e
  `LOCAL_LLM_DEMO_DEFAULT_MODEL` em `src/local_llm/constants.ts` define o modelo de cada demo.
  - Demo do carro (desde 17/11/2026): **DaVoice Automotive Agent 0.6B**,
    `LOCAL_LLM_DAVOICE_AUTOMOTIVE_G3C` (checkpoint `g3c_it3639`, descrições de ferramentas h3d,
    cerca de 380 MB, baixado uma vez e conferido por sha256), com o seu estado pré-aquecido em
    inglês ou português do Brasil (cerca de 430 MB, baixado junto com o modelo), para que o
    primeiro início pule o aquecimento. Os arquivos no R2 foram conferidos baixando-os e
    comparando tamanho e sha256.
  - Reservas, usadas só quando escolhidas à mão: **r8d_it150** (`LOCAL_LLM_DAVOICE_AUTOMOTIVE_R8D`,
    "(r8d, backup)", o padrão de 13/11/2026 a 17/11/2026) e **r4b_it100**
    (`LOCAL_LLM_DAVOICE_AUTOMOTIVE_R4B`, "(r4b, backup)"). Não há troca automática para outro
    modelo.
  - Demo de calorias: o Personal Agent, `ft7f2_it900`.
  - Os outros apps de exemplo da DaVoice (React Native, Expo, Flutter) listam os mesmos modelos.
- **Outros modelos:** cada demo lembra a sua escolha feita em **Change** (seletor de modelos,
  `src/local_llm/ModelPicker.tsx`). O seletor também lista os checkpoints experimentais C3 e A
  (reservas: não hospedados, só quando o arquivo é copiado para a pasta de modelos) e modelos
  genéricos maiores (Qwen2.5 1.5B/3B, Gemma 3n). Os maiores são mais lentos.
  - As entradas antigas ft7c, ft7e e ft7f2 Automotive foram removidas. Um aparelho que tinha
    uma delas escolhida volta ao modelo da sua demo.
  - Só um modelo fica na memória por vez: escolher outro substitui o atual.
  - A escolha anterior de uma demo vale mais que um novo padrão: num aparelho em que outro
    modelo foi escolhido na demo do carro, escolha o Automotive Agent em **Change** (ou limpe
    os dados do app).
- **Tela de carregamento:** ao escolher uma demo, o app mostra uma tela própria de
  carregamento com três etapas até o modelo ficar pronto:
  1. Download (barra de progresso; o modelo e, se houver, o estado pré-aquecido dele, 1.5);
  2. Carregar na memória;
  3. Aquecimento.

  Ela mostra os segundos de cada etapa e, em caso de erro, Retry e Back.
- **Tela da conversa:** só no "Ready" o app passa para uma tela limpa com:
  - o estado do carro (ou o cartão de calorias) no alto;
  - **You said** (o STT ao vivo);
  - **Reply** (o que é falado);
  - o nome do modelo com **Change**;
  - na demo do carro, **Local confidence** com **Change** (2.6);
  - Reset Chat e Back.
- **Aquecimento e estado salvo:** o aquecimento processa o prompt de sistema (persona +
  ferramentas: cerca de 3.100 tokens na demo do carro e cerca de 4.000 na de calorias).
  - **Demo do carro, inglês ou pt-BR: pré-aquecida.** O Agente Automotivo já vem com esse
    prompt processado (baixado junto com o modelo, 1.5), então até a primeira abertura o
    restaura. Medido no S20: restauração em 0,23 s, primeira resposta em 0,34 s, em vez de
    24,6 s de aquecimento. Funciona porque o modelo usa `promptOrder: 'cache'` (a data vem
    depois das ferramentas, então o prompt salvo serve todo dia).
  - **Nos outros casos, na primeira vez** de cada demo e idioma leva cerca de **30–40 s** num
    Galaxy S20 (CPU). Depois, o app **salva esse prompt processado** (`*.kvstate` na pasta
    dos modelos, cerca de 435 MB) com `saveState` do `react-native-davoice-llm`.
  - **Nas próximas vezes** o estado é restaurado (`loadState`) em **menos de um segundo**, e o
    "Ready" chega logo. Medido no S20: restauração em 0,7–0,9 s, aquecimento em 0,5–0,6 s.
  - Os estados são guardados **por prompt** (demo, idioma, ferramentas): os 2 mais recentes
    por arquivo de modelo. Trocar de demo é rápido depois do primeiro aquecimento de cada uma.
  - Com a ordem de prompt do treino (o Personal Agent), um novo dia ainda paga parte do
    aquecimento, porque a data fica perto do começo do prompt.
  - Código: `warmUp` em `src/aichat/provider.ts`; `kvStatePath`, `stablePromptKey` e
    `downloadPrebuiltState` em `src/local_llm/ModelManager.ts`.

### 2.2 Como o turno funciona

- O modelo ajustado decide sozinho, a cada frase: chamar uma ferramenta, perguntar (pedido
  incompleto), recusar (não suportado) ou **passar adiante** para um modelo remoto.
- **O app diz o que foi feito.** Depois de uma ação no carro o modelo não fala: a frase da
  própria ferramenta, montada a partir do resultado real, é dita e o turno termina. Código:
  `done()` / `say` em `src/car/carTools.ts`, enviados com `toolReply`. A frase diz a ação, a
  posição, a zona e o valor, em português ou inglês:
  - sucesso: "Abri o vidro traseiro direito." / "Coloquei o lado do motorista em 20°C e o do
    passageiro em 23°C.";
  - já estava assim: "A porta dianteira direita já está trancada.";
  - recusado pelo carro: "O carro está trancado. Quer que eu destranque?", "Não posso fazer
    isso com o carro em movimento." Nada muda, e o modelo nunca age sozinho depois de uma
    recusa (antes ele destrancava o carro por conta própria);
  - consultas (horário de chegada, autonomia, pneus) são respondidas pelo app com os valores.

  Nada é anunciado antes de a ferramenta confirmar.
- **O que é passado adiante:** conhecimento geral, escrever um texto, papo. O modelo de 0,6B
  foi treinado para **agir** (ferramentas), não para conversar.
- **Modelo remoto: configuração atual.** **Não há modelo remoto configurado**
  (`LOCAL_LLM_LAYER2 = 'none'` em `src/local_llm/constants.ts`).
  - Tudo o que é passado adiante recebe esta resposta fixa: **"Preciso enviar isso para um
    modelo remoto. Para isso funcionar, configure um modelo remoto no aplicativo."** O texto
    fica em `LOCAL_LLM_NO_REMOTE_MESSAGE`.
  - Um pedido que o modelo entendeu, mas que a demo não faz, recebe
    `LOCAL_LLM_NOT_IN_DEMO_MESSAGE`: "Isso não está disponível nesta demonstração. Para
    disponibilizar, entre em contato com info@davoice.io".

  Essas mensagens são **esperadas**, não erros.
- **Como configurar um modelo remoto.** Mude `LOCAL_LLM_LAYER2`:
  - `'cloud'`: o app envia o pedido ao Gemini (`src/aichat/remote.ts`, chave
    `GEMINI_API_KEY` em `local.config.ts`). O agente fala uma frase de espera enquanto
    aguarda; se o Gemini falhar, ele diz que não conseguiu.
  - Qualquer outro serviço: implemente `answerRemoteRequest` em `src/aichat/remote.ts`. Ele
    recebe o pedido (`query`, `userText`, histórico, fatos da memória, resultados das
    ferramentas) e devolve `{ text }`, ou `{ failure, detail }` em caso de erro.
  - `'device'`: um segundo modelo no aparelho (`LOCAL_LLM_LAYER2_MODEL`, cerca de 470 MB).
    **Não recomendado:** os dois modelos disputam a mesma CPU.
- **Ruído do reconhecimento de fala:** transcrições curtas que são só preenchimento ("The.",
  "Mas.", "é...", "Alma Alma.") recebem "Desculpe, não entendi. Pode repetir?" sem passar pelo
  modelo. Na demo do carro, um "Pronto." solto do modelo é trocado do mesmo jeito, já que as
  ações de verdade são confirmadas pela frase do próprio app. Código:
  `src/aichat/fragments.ts`.
- **Busca na web** (demo de calorias): Wikipedia por padrão. Tavily ou Brave exigem chave em
  `local.config.ts`.
- **Respostas faladas:** cada frase do texto é enviada ao TTS assim que fica pronta. O texto
  aparece na tela antes da voz.

### 2.3 O que esperar (honestamente)

- É um modelo de **0,6B parâmetros no telefone**. Ele escolhe a ferramenta certa na maioria
  das vezes, mas ainda erra, por exemplo:
  - em inglês, "open the windows" às vezes escolhe a ferramenta da porta;
  - lado ou zona errados;
  - valor absoluto vs. relativo ("vinte e dois graus" vs. "sobe dois graus");
  - números falados.
- **Os guards do núcleo** conferem cada chamada com as palavras do usuário antes de executar
  (`callGuards: 'correct'` na entrada do modelo). Eles:
  - corrigem um argumento claramente errado: "fecha" vs. "abre", "levanta o vidro" = fechar,
    "desliga o desembaçador", o lado que o usuário disse, um número partido;
  - normalizam um valor escrito em outra ordem ("right front" → `front_right`);
  - **bloqueiam** uma chamada para o tipo errado de objeto, por exemplo a ferramenta de porta
    para um vidro, com um natural "Desculpe, acho que não entendi direito. Pode repetir?". Uma
    chamada bloqueada **nunca** vira outra ferramenta;
  - bloqueiam uma chamada cujos argumentos são de outra ferramenta;
  - usam o valor que o usuário disse (`enumWords`, núcleo de desenvolvimento de 12/11/2026):
    "joga o ar nos pés" → `feet`, "acha um estacionamento" → `parking`, "quanto tem de
    combustível" → `fuel`, só quando as palavras nomeiam exatamente um valor daquele argumento
    (dois ou nenhum: nada muda);
  - leem um plural sem lugar como todos ("fecha os vidros", "Can you open my car windows?" →
    `all`); qualquer palavra de lugar ("de trás", "do carona", "meu", "back") deixa a chamada
    como está;
  - mantêm a ação numa correção que só muda o alvo: "fecha o vidro traseiro esquerdo" → "não,
    o outro de trás" fecha o traseiro direito (`followUp`; precisa de `historyAsRun: true` na
    entrada do modelo, para o histórico mostrar cada chamada como ela rodou);
  - mais, no núcleo de desenvolvimento de 13/11/2026:
    - um valor que o usuário diz numa correção nunca é desfeito: "abre o teto solar" → "não, só
      inclina" inclina;
    - um lado só ("baixa três graus no lado do passageiro") → a ferramenta de duas zonas é a
      ferramenta errada (a nova tentativa abaixo escolhe a de um lado);
    - um número depois de "pra" / "to" é um alvo: "sobe a temperatura pra vinte" = 20, não +20
      ("aumenta em dois" continua um passo);
    - "abaixa os vidros" / "roll down the windows" abre; uma fresta precisa de "um pouco",
      "uma fresta", "a little";
    - valores ditos: "pedágio" → `tolls`, "pen drive" → `usb`, AM / FM, aquecimento x
      ventilação do banco, "no 1" → `low` (lido da descrição do próprio argumento), "casa" →
      `home`, "jantar" → `restaurant`;
    - objetos ditos: um posto, um pen drive, o aquecimento do banco, "autonomia". Uma
      ferramenta que não trata deles é a ferramenta errada.
    - (mais tarde no mesmo dia, a partir de frases de teste no estilo da fala) um número que o
      usuário não disse nunca roda ("onde eu ponho etanol" → duas zonas 19 / 18: bloqueado); um
      número para uma ferramenta que não recebe número ("o ar do passageiro em 22" → direção do
      ar), um passo numa ferramenta só de alvo ("dá mais dois graus" → 23 / 23) e um número de
      rádio como temperatura ("noventa e três ponto três" → 93 °C) são a ferramenta errada;
    - uma sensação pura ("tô suando", "tá um gelo aqui") não é chamada de teto solar / vidro; "a
      trava" / "o trinco" é a trava; o desembaçador não é "desce os vidros"; para-brisa,
      consumo, pneus, tanque, pedágio e "onde eu carrego / paro" precisam de uma ferramenta que
      trate deles; o porta-luvas não é suportado; um objeto negado ("não quero a porta, quero o
      vidro") não conta como dito;
    - quanto abrir: "um pouquinho" / "um dedinho" / "a couple of inches" = fresta (teto solar:
      inclinar), "de vez" / "all the way" = abrir; "bring / get / put / roll … down" abre,
      "… up" fecha; o objeto antes do verbo ("os vidros do carro, baixa") também vale;
    - "lado dela / her side" = passageiro ("meu lado" = motorista); "tira o embaçado" = liga o
      desembaçador, "chega de desembaçador" = desliga; "liga o som de novo" = tira do mudo; um
      valor de rádio fora da faixa (FM 87,5–108, AM 530–1710) vira o único número dito; "meu
      serviço" = `work`; níveis do banco "fraquinho" / "médio" / "forte".

    Esses são bloqueios de ferramenta *errada*, em que o modelo deve escolher de novo, então
    usam a nova tentativa abaixo. O app nunca troca um bloqueio por outra ferramenta.

  Toda decisão de guard aparece no log (`guard ...`).
- **Uma nova tentativa quando o modelo escolheu a ferramenta errada** (núcleo de desenvolvimento
  de 12/11/2026; `guardRetry: true` na entrada do modelo). Quando um guard bloqueia uma chamada
  por ser a *ferramenta* errada (uma ferramenta de porta para "fecha os vidros", a ferramenta de
  duas zonas para um lado só), o mesmo modelo reconsidera **uma vez**, a partir do mesmo prompt
  já processado, sem aquela ferramenta (nem as outras que não tratam o que o usuário nomeou). A
  nova chamada passa por todos os guards de novo; a mesma ferramenta, nenhuma chamada ou outro
  bloqueio → o usuário é perguntado, como antes. O app nunca troca uma ferramenta por outra.
  - Corrigiu "fecha os vidros" depois de "abre os vidros" (o modelo chamava `close_doors` toda
    vez): de 12 para 22 de 22 turnos no conjunto de regressão do celular, 40 / 40 num conjunto de
    sequências de vidro / porta; no Galaxy S20 soma cerca de 1,5–2 s nos turnos em que acontece
    (cerca de 3% dos turnos).
  - Com o núcleo de 13/11/2026, o Automotive Agent r8d_it150 acerta 156 de 161 turnos do teste
    de aceitação pt-BR (eram 149), com 12 ações erradas (eram 27) e nenhuma ação oposta ou não
    suportada. No Galaxy S20 a ação fica pronta cerca de 1,7 s depois que o texto reconhecido
    chega ao modelo (mediana; 2,2 s em 9 de cada 10 turnos), com pico de 1,8 GB de memória.
  - Com o núcleo de desenvolvimento mais recente de 13/11/2026: 157 de 161 (10 ações erradas,
    nenhuma oposta ou não suportada). Em frases novas no estilo da fala (com "ô", "aí", outras
    ordens de palavras) que aquele teste não tem, as ações erradas caem de cerca de 28% para
    cerca de 15% dos turnos (as certas sobem de cerca de 70% para 81%). O custo: a nova
    tentativa acontece em cerca de 20% desses turnos, e um turno com nova tentativa leva cerca
    de 3,6 s no S20 (2,0 s nos outros).
  - Travar vs. abrir / fechar (núcleo de desenvolvimento g29): uma palavra de travar ("trava",
    "tranca", "lock") numa ferramenta que só abre / fecha portas, ou uma palavra de abrir / fechar
    numa ferramenta de trava, é um bloqueio de ferramenta errada (a nova tentativa acima).
    "fecha o carro" / "abre o carro" continuam com as ferramentas de trava. "trava o carro" sem
    porta nomeada trava o carro todo.
- **Duas operações num pedido** (núcleo de desenvolvimento g29; `maxOperations: 2` na entrada do
  modelo, enviado como `maxOperations` no configure do agente). "fecha os vidros e trava o carro"
  executa as duas, uma depois da outra, na mesma sessão (mesmo modelo, mesmo prompt processado).
  - O núcleo corta a frase em "e" / "and" / "depois" / "then" / "também" / vírgula só onde cada
    parte é um comando claro ("fecha os vidros e as portas" → "fecha as portas" na segunda). Não
    corta uma autocorreção ("abre... quer dizer, fecha"), nomes ("Zezé di Camargo e Luciano"),
    números ("vinte e dois"), um lugar para duas coisas ("o vidro do motorista e o do
    passageiro", "o motorista em 20 e o passageiro em 23"), um desejo ("queria um ventinho, ...")
    ou uma primeira parte vaga ("esquenta um pouquinho, sobe dois graus").
  - Cada operação é decidida pelo modelo com as próprias palavras e conferida por todos os
    guards. A segunda vê a primeira no histórico e nunca executa de novo uma chamada que a
    primeira já executou.
  - As respostas são ditas uma depois da outra ("Fechei todos os vidros. Tranquei o carro."),
    então um sucesso parcial é contado como aconteceu. Um terceiro pedido não é feito; o usuário
    ouve "Não fiz o resto do pedido. Pode repetir?" (`prompts.notDoneRest` em `agent_automotive`).
  - O `operationTurns` do resultado fica com a resposta no histórico
    (`AIChatHistoryMessage.operationTurns`); o núcleo repete o pedido como as suas operações, e
    o turno seguinte reaproveita o prompt processado.
  - Custo no Galaxy S20: a segunda operação soma cerca de 3 s (cerca de 2 s de prompt + 1,2 s de
    decodificação), em parte escondidos enquanto a primeira resposta é falada.
- **Posições:** vidros, portas e travas aceitam `front_left`, `front_right`, `rear_left`,
  `rear_right`, `driver`, `passenger`, `front`, `rear`, `left`, `right` ou `all`.
  - `driver` / `passenger` são resolvidos pelo app a partir do lado do volante do carro
    (`CarState.vehicle.steering`, padrão esquerdo; `setSteering()` em `src/car/CarState.ts`),
    então nada supõe volante à esquerda.
  - O lado do volante também vai para o núcleo (configure do agente `vehicle: { steering }`,
    enviado de novo quando muda; núcleo de desenvolvimento g29). Um lado dito para um banco da
    frente ("o banco da direita", "lado direito 22 graus") é o motorista ou o passageiro conforme
    ele. Esquerda / direita ditas explicitamente mantêm o sentido físico: "o vidro do lado
    direito" é `front_right`, também quando o modelo disse `passenger` num carro com volante à
    direita. Sem essa configuração o núcleo não supõe nada.
  - Mover o vidro, abrir a porta e travar a porta são ferramentas separadas.
- **Duas temperaturas de uma vez:** `set_dual_zone_temperature` (motorista + passageiro). O app
  confere cada valor e diz qual lado não conseguiu ajustar. O r4b foi treinado nela e acerta a
  maioria dos pedidos com duas temperaturas, em qualquer ordem ("o carona quer 26 e eu 19").
  Um pedido de um lado só ("lado do passageiro em 22") usa `set_temperature` com uma zona.
  - Chega com o `react-native-davoice-llm` 1.0.14 (núcleo g11): um guard `dualZone` coloca os
    valores que o usuário disse nos lados certos da chamada dupla e bloqueia (pede de novo) uma
    chamada que perderia ou copiaria um lado. Ele nunca troca uma ferramenta por outra.
- **Valores fora da faixa** ("coloca o ventilador no 12"; o ventilador vai de 1 a 7): com o
  1.0.13 o usuário ouve o genérico "pode repetir?". A partir do 1.0.14, as frases do pacote
  `outOfRange` / `outOfRangeAsk` (já em `agent_automotive/agent.json` e `pt-BR/`) dizem a
  faixa: "Desculpe, 12 não dá: vai de 1 a 7."; um número que o usuário não disse é
  perguntado.
- **Latência (Galaxy S20, só CPU, medida em 10/11/2026):**
  - a decisão do modelo leva cerca de 1,3–2 s por comando;
  - a frase da ação é falada logo em seguida.

  Em iPhones com Metal é mais rápido.
- **Memória do usuário (demo de calorias):** um fato salvo às vezes aparece numa resposta que
  não tem nada a ver. É uma limitação conhecida do modelo atual.
- Pedidos que o carro não sabe fazer (capô, porta-malas, pisca-alerta, limpador, retrovisor,
  freio de mão) devem ser **recusados**, não executados.

### 2.4 Como testar

Só em builds de debug (`__DEV__`): **Continue without wake word (dev)** na tela da palavra de
ativação inicia o app como se "Hey Coach" tivesse sido ouvido, e **Run test script (dev)** na
tela do chat toca as linhas de `files/inapp_test.txt` (na pasta de arquivos do app; `#reset`
começa uma conversa nova) como se fossem faladas. Nenhum dos dois existe numa build release.

1. Escolha **Local AI · Car demo** (ou Calories). Espere a tela de carregamento terminar:
   cerca de 30–40 s na primeira vez, cerca de um segundo depois.
   - Para testar o estado salvo: feche o app por completo, abra de novo e volte à demo. O log
     mostra `[LocalLLM] KV state restored: N tokens in X ms`.
   - Faça uma pergunta geral ("me conta uma curiosidade sobre o Brasil"): a resposta deve ser
     a mensagem do modelo remoto de 2.2.
2. **Cartão do carro** (`src/car/CarCard.tsx`):
   - a última ação em palavras e a **chamada exata** que a IA fez, por exemplo
     `set_window(window: rear_right, position: open)`;
   - as duas ações anteriores;
   - uma linha com o estado do carro: temperatura por lado, vidros, portas abertas, travas;
   - botão **"Parado / Em movimento"**: em movimento, o app recusa porta-malas, portinhola de
     recarga, girar a tela, abrir todos os vidros, abrir portas e alguns modos
     (`NOT_WHILE_DRIVING` em `src/car/carTools.ts`);
   - botão **"Reiniciar"**: zera o carro.

   Na demo de calorias, o cartão de calorias (`src/calories/CaloriesCard.tsx`) mostra o total
   do dia e a lista.
3. **O que verificar em cada comando:**
   - a ferramenta certa;
   - os argumentos exatos (posição, valor, unidade);
   - a frase falada bate com o que aconteceu ("já está…", recusas);
   - pergunta quando falta informação;
   - recusa quando não é suportado;
   - **nenhuma ação executada** em frases de conversa ou em ruído de fala.
4. **Ferramentas registradas:** `LOCAL_LLM_CAR_TOOLS` em `src/local_llm/constants.ts`:
   - `'vw_demo'` (padrão: 22 ferramentas, prompt menor e mais rápido);
   - `'all'` (o catálogo inteiro).

   O `toolWording` da entrada do modelo escolhe o arquivo de descrições:
   - `h3d` (`src/car/carToolDefinitions.h3d.json`: posições + duas zonas, com as descrições
     corrigidas com que os modelos do Agente Automotivo são treinados);
   - `h3`, `h2` (modelos mais antigos);
   - `v1` (a redação original dos primeiros modelos).
5. **Log da conversa:**
   - build debug: `adb shell run-as com.exampleapp cat files/davoice_chat.log`;
   - build release: `adb logcat | grep DavoiceChat` (mesmo conteúdo).

   Mostra as palavras do usuário, o que o modelo gerou, as decisões dos guards, as chamadas
   de ferramenta e os resultados, a resposta, e linhas `[timing]` com os tempos de prompt e
   de geração.
6. **Testes do app:**
   ```sh
   npx jest __tests__/carTools.test.ts __tests__/fragments.test.ts
   ```
   Eles conferem as frases faladas do carro (sucesso / já estava / recusado, em português e
   inglês, posições, lado do volante, duas zonas) e as regras de ruído de fala.
7. **Com a verificação de locutor ligada:** confirme que a wake word não dispara com outra
   pessoa falando, que `speakerId` aparece nos resultados do STT, e que outra voz não
   consegue destrancar o carro.

### 2.5 Conversa por turnos: o usuário espera a IA terminar

**Como funciona hoje.** O chat de IA (local e Gemini) é **por turnos**. O usuário **não
consegue interromper** a IA:

1. O usuário fala. Quando ele faz silêncio, o app envia a frase para a IA.
2. Nesse momento o STT é pausado (`Speech.pauseSpeechRecognition()` em `processAIChatTurn`,
   `App.tsx`). Enquanto `aiChatInFlightRef` está ligado, os resultados do STT são ignorados
   (`src/stt/index.ts`).
3. A IA pensa e fala a resposta, frase por frase.
4. Só depois que o último áudio termina, `finishAIChatSpeechFlow` reabre o microfone para o
   próximo turno.

Enquanto a IA pensa ou fala, nada do que o usuário diz é ouvido. Dizer "Hey Coach" também
não para a resposta, e não há botão de parar. Isso é proposital: é o jeito mais simples e
seguro de evitar que a IA escute a própria voz e transcreva o que ela mesma está falando.

**Se você quiser que o usuário possa interromper a IA, é preciso mudar o app.** O padrão abaixo
vem de um app da DaVoice em produção (um treinador de academia) em que o usuário diz a wake word
por cima da voz do treinador e ele para na hora. Como aplicar aqui:

1. **A wake word fica ouvindo enquanto a IA fala** (o STT continua fechado). Naquele app,
   quando o turno do usuário termina, o STT fecha e a detecção da wake word volta
   (`unPauseDetection`) antes de o treinador falar. Aqui: chame
   `myInstanceRef.current?.unPauseDetection()` logo depois do `pauseSpeechRecognition()` em
   `processAIChatTurn`.
2. **Cancelamento de eco ligado sempre:** `AEC: { mode: 'always' }` na configuração de
   roteamento de áudio. Aqui o `defaultAudioRoutingConfig` em `src/wakeword/index.ts`
   usa `WakewordAEC: { regular: false, duringTTS: false }`. Troque por
   `AEC: { mode: 'always' }`, para que a voz da própria IA não dispare a wake word nem
   entre no STT. Suporte (documentado em `react-native-wakeword`, `audioRoutingConfig.d.ts`):
   - iPhones mais novos usam o AEC do próprio iOS; os mais antigos, um motor de áudio com
     cancelamento de eco;
   - no Android vale para a wake word e o TTS; para o STT, Android 13+ no alto-falante.
3. **Wake word durante a fala da IA = parar.** Uma wake word ouvida enquanto a IA fala sempre
   quer dizer "pare", antes de qualquer outro estado. Aqui, no começo do `keywordCallback` em `App.tsx`:
   ```ts
   if (aiChatInFlightRef.current) {             // a IA está pensando ou falando
     if (interruptInFlightRef.current) return;  // a mesma "Hey Coach" detectada duas vezes
     interruptInFlightRef.current = true;
     try {
       aiChatRequestIdRef.current += 1;         // textos e eventos atrasados do turno antigo são ignorados
       (await getLocalAgent()).cancel();        // para o turno do LLM (src/agent/LocalAgent.ts)
       aiChatSpeechQueueRef.current = [];       // descarta as frases que ainda não foram faladas
       ignoreNextFinishedSpeakingRef.current = true; // o "terminou de falar" do stop não abre outro turno
       await Speech.stopSpeaking();             // cala a voz agora
       resetSpeechTranscriptState();            // descarta o que o STT pegou no meio (não envia para a IA)
       aiChatInFlightRef.current = false;
       await myInstanceRef.current?.pauseDetection(false);
       await Speech.unPauseSpeechRecognition(-1, 0); // novo turno do usuário; preFetchMs 0, veja abaixo
     } finally {
       interruptInFlightRef.current = false;
     }
     return;
   }
   ```
   `interruptInFlightRef` e `ignoreNextFinishedSpeakingRef` são refs novos.
   `finishAIChatSpeechFlow` precisa respeitar o segundo e não reabrir o microfone de novo.
4. **Detalhes aprendidos na prática:**
   - **Proteja contra detecção dupla** (um sinalizador de parada em andamento): a mesma
     palavra pode disparar duas vezes.
   - **Descarte a transcrição acidental, não envie.** Interromper a fala não pode mandar
     para a IA um pedaço de frase ou o eco da própria IA.
   - **Abra o STT com `preFetchMs: 0`.** Senão o STT repete os ~2 s de áudio anteriores e
     transcreve o "Hey Coach" (ou a voz da IA) como se fosse a nova mensagem.
   - **Botão vs. voz.** Um botão de parar só faz silêncio. Pela wake word, ele
     abre o microfone, porque o usuário quer falar.
   - **Toque um som curto de "ouvindo"** quando o microfone abre, para o usuário saber que
     pode falar.
   - **Histórico:** guarde no histórico só o que a IA chegou a falar, para o próximo turno
     fazer sentido.
5. **No carro, combine com a verificação de locutor (1.3).** Com locutor cadastrado, só a
   voz do dono consegue interromper. O rádio ou um passageiro, não.

**Variante "qualquer fala interrompe" (duplex).** O STT fica aberto por baixo da voz da IA, com
`AEC 'always'`, e palavras que **não** são eco do que a IA está dizendo param a fala e começam um
turno normal. É mais complexo (é preciso filtrar o eco comparando a transcrição com a frase que a
IA está falando) e, hoje, com a DaVoice, só no iOS. Para o carro, a versão com wake word acima é
mais segura.

### 2.6 Confiança local: comandos incertos vão para o agente remoto

A tela de conversa da demo do carro tem uma linha **Local confidence** com **Change**: Off (padrão)
→ 0,80 → 0,90 → 0,95 → Off. O valor fica salvo na instalação (`getLocalConfidence` /
`setLocalConfidence` em `src/local_llm/ModelRegistry.ts`) e é enviado ao agente antes do próximo
turno (`agent.configure({ confidence: { min } })` em `src/aichat/provider.ts`; a demo de calorias
sempre envia 0).

- Cada chamada de ferramenta que o modelo escreve tem uma probabilidade: o produto das
  probabilidades dos tokens que o modelo escolheu (o texto que o guia insere é certo e não conta).
  Uma chamada abaixo do valor **nunca roda**: nem guard, nem ação no carro.
- O pedido então vai para o assistente remoto com o motivo `low-confidence`. Sem modelo remoto
  configurado (`LOCAL_LLM_LAYER2 = 'none'`), o `src/aichat/remote.ts` responde com
  `LOCAL_LLM_LOW_CONFIDENCE_MESSAGE`: **"Para esse comando eu preciso de um agente remoto."** (em
  inglês: *"For this command I need a remote agent."*).
- O resultado do turno traz `confidence: { value, min, low }`; o log mostra `confidence: 0.29 <
  0.80: the call did not run`.
- Precisa do `react-native-davoice-llm` 1.0.15 ou mais novo (núcleos antigos ignoram a
  configuração). Ela não muda o prompt, então os estados pré-aquecidos continuam valendo.

Medido com o `g3c_it3639` em comandos que ele nunca viu no treinamento:

| Valor | Ações erradas evitadas | Comandos válidos enviados ao agente remoto |
|---|---|---|
| Off (padrão) | 0% | 0% |
| 0,80 | cerca de 40% | cerca de 13% |
| 0,90 | cerca de dois terços | cerca de 20% |
| 0,95 | cerca de 70% | cerca de 27% |

Em frases mais difíceis (pares de contraste, números falados) muito mais comandos válidos são
enviados para fora, e algumas chamadas erradas saem com confiança alta (por exemplo "fexa as
portas" → travar), então sozinha a configuração não chega a zero ação errada. Escolha o valor com
os seus próprios comandos.

---

## 3. Como extrair cada componente para outro app

Regra geral: copie o **módulo** de `src/` e os **assets** listados, instale o pacote e use
a sua licença. Os módulos de `src/` foram separados do `App.tsx` exatamente para isso (veja
`src/README.md`).

### 3.1 Palavra de ativação (`react-native-wakeword`)

- **Código:** `src/wakeword/index.ts`:
  - `instanceConfigs` (modelo, limiar, buffer);
  - `initializeWakewordBootstrap`, `startWakewordDetection`;
  - `attachKeywordListenerOnce` / `detachKeywordListener`;
  - `pauseDetection` / `unPauseDetection`.
- **API mínima:**
  ```ts
  import { createKeyWordRNBridgeInstance } from 'react-native-wakeword';
  const inst = await createKeyWordRNBridgeInstance('ww1', false);
  await inst.setKeywordDetectionLicense(LICENSE);
  await inst.createInstance('hey_coach_model_28_22012026b.dm', 0.999, 3);
  await inst.startKeywordDetection(0.999 /* ... */);
  ```
- **Assets:** o modelo `.dm` da palavra precisa estar no **bundle nativo**:
  - Android: `android/app/src/main/assets/hey_coach_model_28_22012026b.dm`;
  - iOS: adicionado ao projeto Xcode (Copy Bundle Resources), como neste exemplo.

  Para outra palavra de ativação, peça um modelo à DaVoice.
- **Antes do STT:** pause a wake word antes de abrir o STT (o exemplo faz isso). Dois
  pipelines de áudio abertos ao mesmo tempo causam instabilidade. A exceção é o padrão de
  interrupção de 2.5: a wake word ouve enquanto o TTS fala, com o STT fechado.

### 3.2 Onboarding e verificação de locutor (`react-native-wakeword` + `react-native-davoice`)

- **Código:**
  - `src/speaker_verification/onboarding.ts`: `runSpeakerVerifyEnrollment`,
    `runSpeakerVerificationStartupFlow`, `writeEnrollmentJsonToFile`,
    `loadEnrollmentJsonFromFile`;
  - `src/speaker_verification/verification.ts`: verificação contínua ou pontual;
  - `src/speaker_verification/currentSpeaker.ts`: quem foi verificado neste pedido,
    `ownerMayAct()` (usado para autorizar as ferramentas de porta, 1.3);
  - `src/appflow.ts`: limiar e número de amostras.
- **Asset:** `sv.dm` no bundle nativo:
  - Android: `android/app/src/main/assets/sv.dm`;
  - iOS: no projeto Xcode.

  O controlador usa `modelPath: 'sv.dm'`.
- **Fluxo:**
  ```ts
  import { createSpeakerVerificationMicController, onSpeakerVerificationOnboardingDone } from 'react-native-wakeword';
  const ctrl = await createSpeakerVerificationMicController('svMic1');
  await ctrl.create(JSON.stringify({ modelPath: 'sv.dm', options: { decisionThreshold: 0.35 } }));
  await ctrl.beginOnboarding('davoice', 5, true);
  // 5x: await ctrl.getNextEmbeddingFromMic();  -> eventos de progresso; no fim, onboardingDone traz enrollmentJson
  // salve o JSON (react-native-fs) e registre o locutor:
  await wakewordInstance.addSpeaker('owner', enrollmentJsonPath);
  await Speech.addSpeaker('owner', enrollmentJsonPath);
  ```
- **No início do STT:** também dá para registrar o locutor já na inicialização:
  `Speech.initAll({ locale: 'pt-BR', model, onboardingJsonPath, speakerId: 'owner' })`.
- **Gerenciar a lista de locutores:**
  - `setSpeakers([...])` troca a lista inteira (vazia = desligado);
  - `removeSpeaker(id)` tira um locutor;
  - `getSpeakerIds()` lista os cadastrados.
- **Autorização de ações:** use `speakerId` / `speakerIds` dos resultados do STT. Veja a
  autorização das portas em 1.3.

### 3.3 STT e TTS (`react-native-davoice`)

- **Código:**
  - `src/initialization/index.ts`: `initializeSpeechLibrary` (chama `Speech.initAll`),
    permissão de microfone;
  - `src/stt/index.ts`: handlers de resultado, junção de texto parcial/final;
  - `src/tts/index.ts`: modelo por idioma, vozes, velocidades;
  - `src/tts/voiceClone.ts`: clonagem de voz.
- **Assets:** um modelo de TTS e um codificador de clonagem por idioma, dentro do app ou
  baixados (1.5). Para português do Brasil (dentro do app):
  - TTS: `model_ex2_portuguese_brv1.dm` (cerca de 145 MB);
  - clonagem de voz: `embedder_brv1.dm`.
  - Todo `require()` de um arquivo `.dm` coloca o arquivo no app, mesmo que esse código nunca
    rode. Neste exemplo os `require()` são gerados a partir de `language_packs.json`; não
    acrescente um à mão.
  - `Speech.initAll` e `createVoiceClone` aceitam um `require()` ou um caminho de arquivo,
    então um arquivo baixado funciona do mesmo jeito (copie `src/tts/languagePacks.ts` para o
    download).
- **API mínima:**
  ```ts
  import Speech from 'react-native-davoice/speech';
  await Speech.initAll({ locale: 'pt-BR', model: require('./assets/models/model_ex2_portuguese_brv1.dm') });
  Speech.onSpeechResults = (e) => console.log(e.value[0], e.speakerId);
  await Speech.unPauseSpeechRecognition(-1);   // começa a ouvir
  await Speech.pauseSpeechRecognition();       // antes de falar
  await Speech.speak('Abri a janela.', 0, 1.0);
  ```
- **Clonagem de voz:**
  `Speech.createVoiceClone(gravacao, pastaDeSaida + '/', require('./assets/models/embedder_brv1.dm'))`,
  depois `Speech.setExternalVoicesPath(pasta)` e `changeVoice(nome)`. Se a resposta trouxer
  `warnings`, peça ao usuário para gravar de novo.
- **Texto para a voz:** não reescreva o texto para a fala no app (números, domínios como
  "DaVoice.io"). A biblioteca de TTS já faz esse pré-processamento.

### 3.4 IA local e ferramentas (`react-native-davoice-llm`)

- **Instalação:**
  ```sh
  npm install react-native-davoice-llm
  cd ios && pod install
  ```
  No Android, adicione o repositório Maven do pacote em `android/build.gradle`:
  ```gradle
  allprojects { repositories { maven { url "${project(":react-native-davoice-llm").projectDir}/libs" } } }
  ```
- **Código para copiar:**
  - `src/local_llm/`:
    - lista de modelos e URLs com sha256, mais o modelo padrão de cada demo
      (`constants.ts`);
    - a demo atual (`demo.ts`);
    - download, registro com um modelo por demo e os estados salvos (`ModelManager.ts`,
      `ModelRegistry.ts`);
    - carregamento (`LocalLLMLoader.ts`) e seletor (`ModelPicker.tsx`).
  - `src/agent/LocalAgent.ts`: cria o `Agent` com o pacote da demo e do idioma, `onRequest`
    (`remote`, `authorizeTool`, `confirmTool`). Também tem `resetLocalAgent()` para trocar de
    demo.
  - `src/agent/AgentPack.ts`: escolhe `agent/` ou `agent/pt-BR/`, e o pacote do carro
    (`automotiveAgentFor`).
  - `src/aichat/remote.ts`: o modelo remoto (`answerRemoteRequest`: as mensagens fixas, o
    Gemini ou o seu serviço, veja 2.2).
  - `src/aichat/provider.ts`: configura o agente por modelo (ferramentas, guards, modelo
    remoto, aquecimento, estado salvo por prompt com `saveState` / `loadState`) e faz o
    streaming para o TTS.
  - `src/aichat/fragments.ts`: regras de ruído de fala.
  - **Pacotes do agente** (arquivos JSON: dá para mudar o comportamento sem mudar código):
    - `agent/pt-BR/agent.json` + `agent/pt-BR/skills/calories/` (a demo de calorias);
    - `agent_automotive/pt-BR/agent.json` (a demo do carro: a mesma persona e as mesmas
      mensagens, sem a skill de calorias). Este é o prompt de sistema com que o modelo
      automotivo é treinado: mantenha-o igual quando usar esse modelo.
  - **Carro:**
    - `src/car/carToolDefinitions.h3d.json` (definições das ferramentas no formato MCP:
      `name`, `description`, `inputSchema`, `execution`);
    - `src/car/carTools.ts` (handlers e as frases faladas);
    - `src/car/positions.ts` (posições, lado do volante, redação das frases);
    - `src/car/CarState.ts` (estado simulado);
    - `src/car/CarCard.tsx` (UI).

    Não dê o mesmo nome a um módulo `.ts` e a um arquivo `.json`: o Metro resolve o `.json`
    primeiro.
- **API mínima:**
  ```ts
  import { setLicense, loadModel, Agent, toolReply } from 'react-native-davoice-llm';
  await setLicense(LICENSE);
  await loadModel(caminhoDoGguf, { contextSize: 8192 });
  const agent = await Agent.create({
    pack: { agent: require('./agent_automotive/pt-BR/agent.json'), skills: [] },
    databasePath: `${RNFS.DocumentDirectoryPath}/davoice_agent_pt_br_car.db`,
    chatTemplate: 'qwen3',
  }, { onRequest });
  await agent.configure({ intentRouter: false, webSearchTool: true, timeTool: true, guards: { /* veja provider.ts */ } });
  await agent.setTools(minhasFerramentas);   // um handler devolve toolReply(resultado, 'Abri a janela.') para falar ele mesmo
  const r = await agent.turn({ text, history }, (ev) => { if (ev.type === 'text') falar(ev.text); });
  // agent.cancel() para um turno em andamento (usado nas interrupções, veja 2.5)
  ```
- **Modelos:** baixe o GGUF pelas URLs de `src/local_llm/constants.ts` e confira o sha256
  (o exemplo já faz isso). Modelos ajustados precisam do mesmo `chatTemplate` (`qwen3`) e
  das configurações da entrada (`usesRouter: false`, `modelTools: true`,
  `remoteAssistant: true`, `temperature: 0`, `callGuards: 'correct'`, `toolWording`; no
  Agente Automotivo também `historyAsRun: true`, `guidedToolCalls: true`, `promptOrder:
  'cache'` e `guardRetry: true`, além dos `prebuiltStates`). O `provider.ts` as
  envia para `agent.configure` (`historyAsRun`, `guidedToolCalls`, `promptOrder` e os
  `guards`, incluindo `followUp`, `dualZone` a partir do 1.0.14, e `enumWords` e `guardRetry` com
  o núcleo de 12/11/2026). A partir do 1.0.15 ele envia também a Confiança local (`confidence: { min }`, 2.6).
- **Ferramentas novas:** um modelo pequeno depende muito do texto das descrições. Use
  descrições curtas e claras e diga explicitamente "absoluto vs. relativo" e qual lado é
  qual. Mantenha no app **o mesmo texto** com que o modelo foi treinado: o modelo da demo do
  carro espera `src/car/carToolDefinitions.h3d.json`.

---

## Resumo rápido para testar em português

1. Instale e rode o app (1.1); escolha **Português do Brasil**. Teste também um idioma que não
   tinha sido baixado ainda (por exemplo, francês): a tela de download precisa mostrar o progresso, e o app
   só continua quando o download termina (1.5). Na segunda vez, sem download.
2. Escolha uma voz; **crie a assinatura de voz** (5 frases); diga **"Hey Coach"**.
3. Escolha **Local AI · Car demo** → espere a tela de carregamento. Na primeira vez ela baixa
   o modelo e o estado pré-aquecido dele (cerca de 780 MB) e fica pronta em cerca de um
   segundo (a demo de calorias: cerca de 30–40 s na primeira vez, cerca de 1 s depois). Perguntas gerais recebem a mensagem "configure um
   modelo remoto" (veja 2.2).
4. Teste os comandos de 1.4. Confira o cartão do carro (ferramenta e argumentos exatos) e se
   a frase falada bate com o que aconteceu.
5. Teste a **Local AI · Calories demo** do mesmo jeito.
6. Lembre que o chat é por turnos (2.5): espere a IA terminar antes de falar de novo.
7. Teste também uma voz diferente: ela **não** deve ativar o assistente, nem destrancar o
   carro.
8. Na demo do carro, coloque a **Local confidence** em 0,90 (2.6) e fale alguns comandos: os incertos não rodam e o app
   diz "Para esse comando eu preciso de um agente remoto."; os claros continuam rodando.
