# 🌌 DopaStudy: Gamified Study RPG

O **DopaStudy** é uma aplicação web SPA (Single Page Application) projetada para transformar sessões de estudo desgastantes em uma campanha de RPG implacável contra a procrastinação. Vinculando o tempo de foco a mecânicas extremas de liberação de dopamina, o projeto substitui cronômetros entediantes por uma interface imersiva onde focar no mundo real significa estraçalhar monstros no mundo virtual.

O projeto utiliza uma arquitetura limpa de **estado centralizado** e **persistência local**, rodando inteiramente no lado do cliente sem a necessidade de frameworks ou dependências externas.

---

## 🕹️ Funcionalidades Principais

### ⚔️ Motor de Combate e Foco em Tempo Real
* **Vínculo com Matérias Reais:** Digite o projeto ou matéria atual (ex: *Estudar Algoritmos*) para materializar um monstro customizado na hora.
* **Dano Contínuo por Segundo (DPS):** O timer não é apenas um contador; cada segundo focado desconta vida do monstro com base no seu status efetivo de Foco (FOC).
* **Spawn Dinâmico (Mid-Timer):** Se a sua força for devastadora e o monstro morrer antes do Pomodoro acabar, os espólios são entregues e o próximo monstro surge imediatamente para o combate continuar sem pausar o seu estudo.

### 🔥 Mecânicas de Dopamina Extrema
* **Combo Fire (🔥):** Concluir blocos de foco consecutivos ativa o multiplicador de combo. Alcançar Combo x2 ou mais injeta uma pulsação de chamas neon nas bordas de toda a aplicação. Desistir ou falhar reseta o contador.
* **Ataques Críticos Sincronizados:** A cada 5 minutos de foco ininterrupto, o motor dispara um golpe massivo (15x dano), um efeito sonoro de impacto agudo e dropa ouro flutuante (`+5 GP 🪙`) que flutua e esmaece na tela.
* **Gacha: Baú do Conhecimento Lendário:** Uma mecânica de sorte probabilística por ouro. Abra o baú para desbloquear Poções de XP, títulos honoríficos raros ou o visual místico **Modo Deus** (10% de chance), que envolve o avatar do jogador em uma aura de fogo dourado animado.

### 🛡️ Inventário Avançado e Passivas Reais (Tiers de Loja)
Os equipamentos não alteram apenas números abstratos; eles oferecem modificadores reais para mudar o ritmo da campanha:
* **Tier 1 (Entrada):** *Óculos Cyber-Visão HUD* 🕶️ (+ Chance de acerto crítico).
* **Tier 2 (Avançado):** *Catana de Plasma Cyberpunk* 🗡️ (+25% de Dano por Segundo real) e *Jaqueta de Couro Synthwave* 🧥 (Proteção: reduz em 50% as penalidades de XP/Ouro por falhas ou desistências).
* **Tier 3 (Lendário):** *Drone Auxiliar de IA Suprema* 🛸 (+Status massivos, bônus de ouro por segundo e 15% de desconto vitalício na loja de Gacha).

### 🧪 Alquimia e Buffs Temporários
* Compre elixires de **XP Duplo** ou **Dano Duplo**.
* O tempo dos elixires (ex: 15 minutos) é consumido segundo a segundo **apenas enquanto o timer de foco estiver ativo**, exibindo badges neon com cronômetros regressivos estilizados na interface.

---

## 🛠️ Stack Tecnológica

O projeto foi construído seguindo a filosofia de zero dependências externas (*Vanilla Stack*), garantindo performance instantânea e facilidade de customização:

* **HTML5 Semântico:** Estruturação limpa baseada em componentes de interface acessíveis.
* **CSS3 Avançado:** Layout totalmente construído em *Flexbox/Grid Layout*, interface rica em *Glassmorphism* (efeitos de desfoque de fundo e translucidez), variáveis nativas para controle de temas neon e animações customizadas (`@keyframes`) para elementos flutuantes e auras.
* **JavaScript Vanilla (ES6):**
  * Engine de estado centralizado (`App.state`) impedindo mutações colaterais.
  * Sistema de cálculo dinâmico de atributos em runtime (`getEffectiveStats()`) para blindar o salvamento de dados.
  * Persistência local integral com o navegador via `LocalStorage` com rotinas de higienização de dados antigos.
* **Web Audio API:** Sintetizador de áudio procedural que gera efeitos sonoros digitais, cliques, arpejos de level-up e impactos diretamente nas frequências do navegador, sem carregar um único arquivo `.mp3` pesado.

---

## 🚀 Como Executar Localmente

Como o projeto não requer compiladores ou gerenciadores de pacotes, você pode rodá-lo localmente de duas formas simples:

### Opção 1: Direto no Navegador
Basta clonar o repositório e dar duplo clique no arquivo `index.html`.

### Opção 2: Via Servidor Local (Recomendado para persistência limpa)
Se você estiver no Linux ou macOS, abra o terminal na pasta do projeto e execute o servidor nativo do Python:

```bash
python3 -m http.server 8000
