# 🌌 DopaStudy: Gamified Study RPG (v2.0.0)

O **DopaStudy** é uma aplicação web SPA (Single Page Application) projetada para transformar sessões de estudo desgastantes em uma campanha de RPG implacável contra a procrastinação. Vinculando o tempo de foco a mecânicas extremas de liberação de dopamina, o projeto substitui cronômetros entediantes por uma interface imersiva onde focar no mundo real significa estraçalhar monstros no mundo virtual.

A **Build v2.0.0 (Cloud Edition)** eleva o projeto para o nível de produção, introduzindo uma arquitetura de persistência híbrida em nuvem, novos motores de combate infinito, balanceamento preciso de dificuldade e travas rígidas de interface contra exploits.

---

## 🎮 Jogue Agora (Live Demo)
⚔️ **Acesse o link oficial do deploy na Vercel:** [https://dopa-study.vercel.app/](https://dopa-study.vercel.app/)

---

## 🕹️ Novidades e Funcionalidades da Versão 2.0.0

### ⚔️ Motor de Combate Infinito & Spawn Dinâmico
* **Progressão por Tiers:** Enfrente uma fila interminável de criaturas geradas dinamicamente. Ao estraçalhar o clássico *Slime*, a engine invoca automaticamente o próximo monstro da masmorra, escalando o HP máximo e renderizando emojis temáticos obrigatórios (👾, 👹, 🐉, 👻) sem quebrar o loop visual ou deixar a tela vazia.
* **Dificuldade Balanceada (Hardcore):** O jogo foi reequilibrado para valorizar o esforço real. O cálculo de DPS (Dano por Segundo) foi reduzido globalmente em **30%** (`Dano = Dano_Base * 0.7`), tornando os monstros de Tiers mais altos verdadeiros desafios de resistência ao tempo de foco.

### 📋 Painel de Missões Automáticas (Anti-Cheat)
* **Travamento de Interface:** Acabou a bagunça de marcar e desmarcar tarefas para trapacear ouro. Todos os checkboxes de Missões Diárias e Semanais são estáticos e trancados (`disabled`) para clique direto do usuário.
* **Validação Nativa:** O próprio código do jogo monitora seu progresso e valida quando os requisitos numéricos de estudo são atingidos. A recompensa (XP/GP) é injetada de forma 100% automática e síncrona pelo sistema assim que você conclui um ciclo legítimo de foco.

### 🛡️ Loja Épica e Engine de Equipamentos Refatorada
* **Dedução Segura de Ouro:** Correção estrutural na validação da carteira. Todo o ouro do jogador e os custos dos itens da loja são sanitizados rigorosamente através da função `Number()`, eliminando bugs de "ouro insuficiente" causados por comparações de texto e garantindo preços dinâmicos baseados nas propriedades reais dos itens.
* **Visualizador de Itens Ativos:** O inventário ganhou uma interface premium. Ao equipar armas, jaquetas ou acessórios, o card do item recebe uma borda neon dourada e a insígnia **"EQUIPADO"**, aplicando instantaneamente os modificadores de atributos e mudando os slots de equipamento ativo na Aba do Herói.
* **Bordas Neon e Skins Dinâmicas:** Sistema de customização de perfil totalmente reconstruído. Ao ativar skins raras (como *Vaporwave Pink*, *Cyberpunk* ou *God Mode*), o sistema faz uma limpeza iterativa de classes antigas e injeta as bordas de gradiente animado corretas no contêiner principal do card (`#char-card`).

---

## 🛠️ Stack Tecnológica Atualizada

O projeto expandiu sua infraestrutura para suportar salvamento multiplataforma sem perder a velocidade de resposta original:

* **HTML5 Semântico & CSS3 Avançado:** Interface baseada em *Glassmorphism*, variáveis nativas de controle de temas neon, layouts em *Flexbox/Grid Layout* e animações customizadas via `@keyframes`.
* **JavaScript Vanilla (ES6+):** Engine orientada a objetos gerenciando loops de clock (`tick()`), listeners isolados de eventos, limpezas automáticas de classes no DOM e cálculo dinâmico de atributos em runtime (`getEffectiveStats()`).
* **Supabase Client SDK:** Integração com banco de dados relacional PostgreSQL na nuvem para autenticação de usuários, gerenciamento de contas de aventureiros e salvamento remoto de dados.
* **Estratégia de Persistência Híbrida (Cloud + Cache):** 1. `LocalStorage`: Atua como cache local ultra-rápido garantindo **zero latência** nas transações de ouro e dano durante o gameplay.
  2. `Supabase (dopastudy_profiles)`: Sincronização assíncrona em background que atua como a fonte da verdade na nuvem. O jogo nunca trava aguardando requisições de rede.

---

## 🚀 Como Executar Localmente

### 1. Clonar e Configurar as Variáveis de Nuvem
Clone o repositório para a sua máquina local:
```bash
git clone [https://github.com/CleitonJr01/dopa_study.git](https://github.com/SEU_USUARIO/dopa-study.git)
cd dopa-study
