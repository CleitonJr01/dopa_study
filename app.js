/**
 * DopaStudy: Gamified Study RPG — Engine de Estado e Lógica Expansiva
 * v2.0.0 — Online/Cloud Edition (Supabase Backend)
 */

// ==========================================================================
// 0. SUPABASE — Inicialização do cliente e módulo de autenticação
// ==========================================================================

// ⚠️ SUBSTITUA PELAS SUAS CREDENCIAIS DO PAINEL DO SUPABASE:
//    Project Settings → API → Project URL e anon/public key
const SUPABASE_URL = 'https://ljjwmlxvvvvowuacbdph.supabase.co';
const SUPABASE_ANON = 'sb_publishable_8a-Lm7giudR4EmgecsiWiA_LFxMiyRA';

// Cria o cliente global Supabase (SDK carregado via CDN no index.html)
const supabaseClient = (typeof supabase !== 'undefined')
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON)
  : null; // Fallback gracioso quando offline / sem CDN

/**
 * SupabaseAuth — Módulo de autenticação e sincronização de perfil na nuvem.
 *
 * Estratégia de Persistência Híbrida:
 *  1. LocalStorage: cache local ultra-rápido (zero latência para o gameplay).
 *  2. Supabase (dopastudy_profiles): source-of-truth na nuvem (sync assíncrono em background).
 *  => O gameplay nunca trava aguardando a nuvem.
 */
const SupabaseAuth = {
  currentUser: null,  // objeto { id, email } do usuário autenticado

  /** Verifica sessão ativa ao carregar a página */
  async getSession() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data?.session?.user ?? null;
  },

  /** Login com e-mail e senha */
  async signIn(email, password) {
    if (!supabaseClient) throw new Error('Supabase não disponível. Verifique sua conexão.');
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    return data.user;
  },

  /** Registro de nova conta */
  async signUp(email, password) {
    if (!supabaseClient) throw new Error('Supabase não disponível. Verifique sua conexão.');
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    return data.user;
  },

  /** Logout */
  async signOut() {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    this.currentUser = null;
  },

  /**
   * Salva o estado do App na tabela 'dopastudy_profiles' (upsert).
   * Fire-and-forget: não bloqueia a thread do gameplay.
   */
  async saveProfile(state) {
    if (!supabaseClient || !this.currentUser) return;
    try {
      const { error } = await supabaseClient
        .from('dopastudy_profiles')
        .upsert({
          user_id: this.currentUser.id,
          updated_at: new Date().toISOString(),
          state_json: state
        }, { onConflict: 'user_id' });
      if (error) console.warn('[SupabaseAuth] Erro ao salvar perfil na nuvem:', error.message);
    } catch (e) {
      console.warn('[SupabaseAuth] saveProfile falhou (offline?):', e.message);
    }
  },

  /**
   * Carrega o estado do App da tabela 'dopastudy_profiles'.
   * Retorna null se não houver registro (novo herói).
   */
  async loadProfile() {
    if (!supabaseClient || !this.currentUser) return null;
    try {
      const { data, error } = await supabaseClient
        .from('dopastudy_profiles')
        .select('state_json')
        .eq('user_id', this.currentUser.id)
        .single();
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.warn('[SupabaseAuth] Erro ao carregar perfil:', error.message);
        return null;
      }
      return data?.state_json ?? null;
    } catch (e) {
      console.warn('[SupabaseAuth] loadProfile falhou (offline?):', e.message);
      return null;
    }
  },

  /** Registra listener para mudanças de sessão (login/logout externos) */
  onAuthChange(callback) {
    if (!supabaseClient) return;
    supabaseClient.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  }
};


// ==========================================================================
// 1. GERENCIADOR DE ÁUDIO PROCEDURAL (Web Audio API)
// ==========================================================================
const AudioSynth = {
  ctx: null,

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  playClick() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  },

  playQuestComplete() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.08;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * noteDuration);

      gain.gain.setValueAtTime(0, now + index * noteDuration);
      gain.gain.linearRampToValueAtTime(0.08, now + index * noteDuration + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index + 1.5) * noteDuration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + index * noteDuration);
      osc.stop(now + (index + 2) * noteDuration);
    });
  },

  playLevelUp() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 659.25, 783.99, 1046.50];
    const step = 0.1;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = index === notes.length - 1 ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(freq, now + index * step);

      lfo.frequency.setValueAtTime(8, now + index * step);
      lfoGain.gain.setValueAtTime(freq * 0.015, now + index * step);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0, now + index * step);
      gain.gain.linearRampToValueAtTime(0.08, now + index * step + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (index + 1.2) * step);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      lfo.start(now + index * step);
      osc.start(now + index * step);

      lfo.stop(now + (index + 1.2) * step);
      osc.stop(now + (index + 1.2) * step);
    });
  },

  playMonsterDefeated() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(now + 0.6);
  },

  playWarning() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.setValueAtTime(100, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },

  playCriticalHit() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(now + 0.15);
  }
};

// ==========================================================================
// ==========================================================================
// 2. POOL DE MISSÕES DINÂMICAS & SAGA DE CAMPANHA (ANTI-CHEAT)
// ==========================================================================
const DailyQuestsPool = [
  { name: 'Foco Inicial', desc: 'Completar 1 ciclo de Pomodoro (25 min)', xp: 30, gold: 15, trackingType: 'focus_session_completed', target: 25 },
  { name: 'Sessão de Aço', desc: 'Focar por 40 minutos ininterruptos', xp: 50, gold: 25, trackingType: 'focus_session_completed', target: 40 },
  { name: 'Organização Diária', desc: 'Listar 3 tarefas prioritárias no dia', xp: 15, gold: 10 },
  { name: 'Caçador Iniciante', desc: 'Derrotar 1 monstro na Câmara de Foco', xp: 30, gold: 15, trackingType: 'monsters_defeated', target: 1 },
  { name: 'Pausa Saudável', desc: 'Completar 1 ciclo de pausa (curta ou longa)', xp: 20, gold: 10, trackingType: 'break_completed', target: 1 },
  { name: 'Foco Prolongado', desc: 'Focar por 60 minutos hoje', xp: 60, gold: 35, trackingType: 'focus_minutes_today', target: 60 },
  { name: 'Combo Rápido', desc: 'Atingir um Combo de Foco de 2x', xp: 40, gold: 20, trackingType: 'combo', target: 2 },
  { name: 'Estudo Dinâmico', desc: 'Estudar pelo menos 2 matérias diferentes hoje', xp: 35, gold: 18 },
  { name: 'Leitura Produtiva', desc: 'Ler ou resumir um texto técnico por 20 minutos', xp: 25, gold: 12 },
  { name: 'Hábito Saudável', desc: 'Beber 2 litros de água durante os estudos', xp: 15, gold: 10 }
];

const WeeklyQuestsPool = [
  { name: 'Consistência de Aço', desc: 'Focar por 120 minutos nesta semana', xp: 120, gold: 60, target: 120, trackingType: 'focus_minutes' },
  { name: 'Maratona Cognitiva', desc: 'Focar por 240 minutos nesta semana', xp: 250, gold: 130, target: 240, trackingType: 'focus_minutes' },
  { name: 'Exterminador de Bosses', desc: 'Causar 1000 de dano total acumulado a monstros', xp: 150, gold: 75, target: 1000, trackingType: 'monster_damage' },
  { name: 'Mestre Caçador', desc: 'Derrotar 5 monstros nesta semana', xp: 180, gold: 90, target: 5, trackingType: 'monsters_defeated' },
  { name: 'Persistência Inabalável', desc: 'Manter o foco por 4 dias diferentes nesta semana', xp: 200, gold: 100, target: 4, trackingType: 'active_days' },
  { name: 'Recompensas Merecidas', desc: 'Resgatar 3 recompensas de hábitos na loja', xp: 100, gold: 50, target: 3, trackingType: 'rewards_claimed' },
  { name: 'Combo Lendário', desc: 'Atingir um combo de foco de 4x nesta semana', xp: 220, gold: 110, target: 4, trackingType: 'combo' },
  { name: 'Gacha Explorer', desc: 'Abrir 2 Baús Lendários na Loja Épica', xp: 150, gold: 80, target: 2, trackingType: 'gacha_opened' }
];

const EpicCampaignChain = [
  { stage: 1, name: 'Despertar do Aprendiz', desc: 'Alcançar o Nível 2 no DopaStudy', xp: 150, gold: 80, evalType: 'level', target: 2 },
  { stage: 2, name: 'Primeiras Linhas de Código', desc: 'Acumular 60 minutos totais de foco na Câmara', xp: 200, gold: 100, evalType: 'total_minutes', target: 60 },
  { stage: 3, name: 'Colecionador de Relíquias', desc: 'Comprar seu primeiro item na Loja Épica', xp: 250, gold: 120, evalType: 'items_unlocked', target: 1 },
  { stage: 4, name: 'Aniquilador de Procrastinação', desc: 'Derrotar 5 monstros na Câmara de Foco', xp: 300, gold: 150, evalType: 'monsters_defeated', target: 5 },
  { stage: 5, name: 'Guerreiro Lendário', desc: 'Alcançar o Nível 5', xp: 400, gold: 200, evalType: 'level', target: 5 },
  { stage: 6, name: 'Maratona Mental', desc: 'Acumular 300 minutos totais de foco', xp: 500, gold: 250, evalType: 'total_minutes', target: 300 },
  { stage: 7, name: 'Mestre do Combo Fire', desc: 'Atingir um Combo de Foco consecutivo de 5x', xp: 600, gold: 300, evalType: 'combo', target: 5 },
  { stage: 8, name: 'Modo Deus Ativado', desc: 'Comprar um Tema ou a Skin Lendária do Modo Deus', xp: 1000, gold: 500, evalType: 'god_mode_unlocked', target: 1 },
  { stage: 9, name: 'Monarca do Hiperfoco', desc: 'Acumular 600 minutos totais de foco na Câmara', xp: 1200, gold: 600, evalType: 'total_minutes', target: 600 },
  { stage: 10, name: 'Arquimago do DopaStudy', desc: 'Alcançar o Nível 10 no DopaStudy', xp: 2000, gold: 1000, evalType: 'level', target: 10 }
];

const Monsters = [
  { name: 'Slime da Procrastinação', emoji: '🟢', baseHp: 35, scale: 1.0 },
  { name: 'Duende das Notificações', emoji: '👺', baseHp: 50, scale: 1.15 },
  { name: 'Espectro do Feed Infinito', emoji: '👻', baseHp: 70, scale: 1.3 },
  { name: 'Gorgona dos Vídeos Curtos', emoji: '🐍', baseHp: 90, scale: 1.5 },
  { name: 'Dragão dos Prazos Perdidos', emoji: '🐉', baseHp: 130, scale: 1.8 }
];

// ==========================================================================
// 3. ESTADO GLOBAL DO APLICATIVO (DopaStudy Engine)
// ==========================================================================
const App = {
  state: {
    character: {
      name: '',
      class: '', // 'math', 'writing', 'research', 'coding'
      level: 1,
      xp: 0,
      gold: 50,
      foc: 10,
      con: 10,
      int: 10,
      activeTitle: 'Recruta do Saber',
      activeTheme: 'default',
      activeSkin: 'skin-default',
      equipment: {
        weapon: null,
        armor: null,
        accessory: null
      }
    },
    unlockedEquipment: [], // Equipamentos comprados
    focusCombo: 0, // Combo de foco consecutivas
    quests: [],
    customRewards: [],
    unlockedTitles: ['Recruta do Saber'],
    unlockedSkins: ['skin-default'],
    unlockedThemes: ['default'],
    activeBuffs: {
      doubleXp: 0,
      doubleDamage: 0
    },
    analytics: {
      streak: 0,
      totalFocusMinutes: 0,
      monstersDefeated: 0,
      rewardsClaimed: 0,
      dailyFocusHistory: {}
    },
    lastResets: {
      daily: '',
      weekly: ''
    }
  },

  // Temporizadores
  timer: {
    timeLeft: 0,
    duration: 0,
    intervalId: null,
    mode: 'idle', // 'idle', 'focus', 'short-break', 'long-break'
    pauseIntervalId: null,
    pauseSecondsLeft: 0,
    isCustom: false
  },

  // Contador de segundos contínuos sob foco ativo
  continuousFocusTicks: 0,

  // Monstro Ativo
  activeMonster: {
    name: '',
    emoji: '',
    hp: 0,
    maxHp: 0,
    xpReward: 0,
    goldReward: 0,
    level: 1
  },

  // Itens de Equipamento RPG na Loja Épica
  shopEquipments: [
    { id: 'eq-oculos', name: 'Óculos Cyber-Visão HUD', slot: 'accessory', bonus: 3, bonusType: 'int', cost: 100, emoji: '🕶️', desc: 'Projeta dados cognitivos em tempo real. (+3 INT) | Passiva: +5% chance de crítico a cada tick do timer.' },
    { id: 'eq-catana', name: 'Teclado de Plasma Cyberpunk', slot: 'weapon', bonus: 5, bonusType: 'foc', cost: 200, emoji: '🗡️', desc: 'Injeta plasma nas suas linhas de código. (+5 FOC) | Passiva: +25% DPS contra monstros.' },
    { id: 'eq-jaqueta', name: 'Jaqueta de Couro Synthwave', slot: 'armor', bonus: 5, bonusType: 'con', cost: 250, emoji: '🧥', desc: 'Bloqueia vibrações de procrastinação. (+5 CON) | Passiva: -50% penalidades ao desistir/falhar.' },
    { id: 'eq-drone', name: 'Drone Auxiliar de IA Suprema', slot: 'accessory', bonus: 12, bonusType: 'int', cost: 450, emoji: '🛸', desc: 'Drone flutuante de IA Suprema. (+8 INT, +4 FOC) | Passiva: +2 GP por segundo de foco e -15% custo do Gacha.' },

    { id: 'eq-excalibur', name: 'Teclado Mecânico Excalibur', slot: 'weapon', bonus: 10, bonusType: 'foc', cost: 450, emoji: '⌨️', desc: 'Teclas táteis barulhentas para foco auditivo absoluto. (+10 FOC)' },
    { id: 'eq-livro', name: 'Grimório de Engenharia Semântica', slot: 'weapon', bonus: 8, bonusType: 'int', cost: 380, emoji: '📖', desc: 'Páginas sagradas de conhecimento computacional avançado. (+8 INT)' },
    { id: 'eq-caneta', name: 'Pena Estelar de Caligrafia', slot: 'weapon', bonus: 4, bonusType: 'int', cost: 120, emoji: '🖋️', desc: 'Desliza sobre o papel com precisão intelectual. (+4 INT)' },
    { id: 'eq-laser', name: 'Sabre de Luz Focus Saber', slot: 'weapon', bonus: 15, bonusType: 'foc', cost: 800, emoji: '⚔️', desc: 'Corta distrações com pura energia focalizada. (+15 FOC)' },

    { id: 'eq-escudo', name: 'Abafador Acústico de Silêncio ANC', slot: 'armor', bonus: 8, bonusType: 'con', cost: 350, emoji: '🎧', desc: 'Fones noise-cancelling que isolam ruídos externos. (+8 CON)' },
    { id: 'eq-capa', name: 'Manto da Fluidez Mental (Flow)', slot: 'armor', bonus: 12, bonusType: 'con', cost: 600, emoji: '🥋', desc: 'Sinta o estado de imersão perfeita com esta capa. (+12 CON)' },
    { id: 'eq-armadura', name: 'Exoesqueleto Cognitivo Mark II', slot: 'armor', bonus: 18, bonusType: 'con', cost: 1000, emoji: '🛡️', desc: 'Blindagem total contra preguiça e cansaço físico. (+18 CON)' },

    { id: 'eq-cafe', name: 'Cálice de Café Infinito', slot: 'accessory', bonus: 5, bonusType: 'foc', cost: 180, emoji: '☕', desc: 'Uma xícara mágica que regenera seu foco mental. (+5 FOC)' },
    { id: 'eq-gato', name: 'Gato Cibernético Companheiro', slot: 'accessory', bonus: 12, bonusType: 'int', cost: 650, emoji: '🐱', desc: 'Um pet eletrônico que ronrona algoritmos limpos. (+12 INT)' },
    { id: 'eq-coroa', name: 'Coroa Quântica da Sabedoria', slot: 'accessory', bonus: 20, bonusType: 'int', cost: 1200, emoji: '👑', desc: 'Sincroniza os neurônios em frequências transcendentais. (+20 INT)' },
    { id: 'eq-ampulheta', name: 'Pendente Ampulheta Cósmica', slot: 'accessory', bonus: 6, bonusType: 'con', cost: 280, emoji: '⏳', desc: 'Dobra as leis do tempo para estender sua energia. (+6 CON)' }
  ],

  // Skins do Card (Bordas & Cards)
  shopSkins: [
    { id: 'skin-aura-purple', name: 'Aura Roxa Pulsante', cost: 300, desc: 'Aplica uma aura roxa neon vibrante ao seu card de herói.', class: 'skin-aura-purple' },
    { id: 'skin-vaporwave-pink', name: 'Sunset Vaporwave Retro', cost: 500, desc: 'Gradiente retrô magenta e ciano cintilante nas bordas.', class: 'skin-vaporwave-pink' },
    { id: 'skin-aura-gold', name: 'Aura Dourada Mágica', cost: 600, desc: 'Uma chama dourada emana das bordas do seu perfil.', class: 'skin-aura-gold' },
    { id: 'skin-matrix-green', name: 'Cascata Digital Matrix', cost: 700, desc: 'Linhas verticais de código binário verde caindo no fundo.', class: 'skin-matrix-green' },
    { id: 'skin-fire-red', name: 'Chama Volcânica Rubra', cost: 850, desc: 'Borda incandescente pulsante de alta combustão.', class: 'skin-fire-red' },
    { id: 'skin-cosmic-space', name: 'Fundo Espaço Profundo', cost: 1000, desc: 'Adiciona um tema estrelado animado ao fundo do card.', class: 'skin-cosmic-space' },
    { id: 'skin-god-mode', name: 'Visual Secreto: Modo Deus', cost: 99999, desc: 'Obtido exclusivamente abrindo Baús Lendários. Ativa uma aura flamejante dourada divina.', class: 'skin-god-mode' }
  ],

  // Poções Temporárias na Loja Épica
  shopPotions: [
    { id: 'pot-xp', name: 'Elixir do Aprendizado Acelerado', type: 'doubleXp', cost: 80, emoji: '🧪', duration: 900, desc: 'Concede XP Duplo por 15 minutos de estudo.' },
    { id: 'pot-damage', name: 'Poção da Fúria do Compilador', type: 'doubleDamage', cost: 100, emoji: '⚡', duration: 600, desc: 'Concede Dano Duplo por 10 minutos contra os monstros.' }
  ],

  // Títulos
  shopTitles: [
    { id: 'title-redimido', name: 'O Procrastinador Redimido', cost: 200, desc: 'Para quem superou os piores hábitos.' },
    { id: 'title-devorador', name: 'Devorador de Livros', cost: 450, desc: 'Símbolo de alta capacidade intelectual.' },
    { id: 'title-hiper', name: 'Monge do Hiperfoco', cost: 550, desc: 'Capaz de estudar no meio de qualquer barulho.' },
    { id: 'title-dragao', name: 'Dragão da Consistência', cost: 750, desc: 'Aquele que nunca quebra a corrente de estudos diários.' },
    { id: 'title-mestre', name: 'Mestre do Foco', cost: 850, desc: 'Uma lenda capaz de ignorar qualquer notificação.' },
    { id: 'title-cerebro', name: 'Cérebro Quântico', cost: 1100, desc: 'Entendimento imediato de teorias complexas.' },
    { id: 'title-bugs', name: 'Exterminador de Bugs', cost: 1200, desc: 'Dedicado aos magos dos algoritmos limpos.' },
    { id: 'title-imparavel', name: 'O Imparável', cost: 99999, desc: 'Título lendário obtido apenas nos Baús Gacha.' },
    { id: 'title-silicio', name: 'Cérebro de Silício', cost: 99999, desc: 'Título lendário obtido apenas nos Baús Gacha.' }
  ],

  // Temas de interface
  shopThemes: [
    { id: 'theme-cyberpunk', name: 'Cyberpunk Overdrive', cost: 600, desc: 'Cores quentes rosa neon, ciano e detalhes amarelos cibernéticos.', themeClass: 'cyberpunk' },
    { id: 'theme-vaporwave', name: 'Vaporwave Retrowave', cost: 1000, desc: 'Estética clássica anos 80, tons pastel rosa, azul e roxo.', themeClass: 'vaporwave' }
  ],

  // ============================================================
  // INICIALIZAÇÃO ASSÍNCRONA COM SUPABASE AUTH
  // ============================================================
  async init() {
    // 1. Registra listeners de auth antes de tudo
    this.setupAuthEventListeners();

    // 2. Verifica se há sessão ativa (token armazenado pelo SDK)
    const user = await SupabaseAuth.getSession();

    if (user) {
      // Usuário já autenticado: carrega dados e entra no jogo
      SupabaseAuth.currentUser = user;
      await this.bootGame();
    } else {
      // Sem sessão: exibe a tela de login cyberpunk
      this.showAuthScreen();
    }

    // 3. Reage a mudanças de sessão (ex: login em outra aba, token expirado)
    SupabaseAuth.onAuthChange(async (u) => {
      if (u && !SupabaseAuth.currentUser) {
        SupabaseAuth.currentUser = u;
        await this.bootGame();
      } else if (!u && SupabaseAuth.currentUser) {
        SupabaseAuth.currentUser = null;
        this.resetToAuthScreen();
      }
    });
  },

  /** Fluxo de inicialização do jogo (pós-login) */
  async bootGame() {
    await this.loadState();        // Carrega do cloud (ou LocalStorage como fallback)
    this.setupEventListeners();
    this.checkResets();
    this.setTimerMode('focus');
    this.renderAll();
    this.hideAuthScreen();
    this.renderUserInfo();

    if (!this.state.character.name) {
      this.openModal('intro-modal', false);
    } else {
      this.spawnMonster();
    }
  },

  // ============================================================
  // LOAD STATE — Híbrido: Cloud (Supabase) → LocalStorage fallback
  // ============================================================
  async loadState() {
    let parsed = null;

    // 1. Tenta carregar do Supabase (source-of-truth na nuvem)
    const cloudData = await SupabaseAuth.loadProfile();
    if (cloudData) {
      parsed = cloudData;
      // Atualiza cache local imediatamente
      try { localStorage.setItem('dopastudy_save', JSON.stringify(parsed)); } catch (_) { }
    } else {
      // 2. Fallback: LocalStorage (modo offline ou novo herói)
      const cached = localStorage.getItem('dopastudy_save');
      if (cached) {
        try { parsed = JSON.parse(cached); } catch (e) { console.error('Erro ao parsear save local', e); }
      }
    }

    if (parsed) {
      this.state = {
        ...this.state,
        ...parsed,
        character: { ...this.state.character, ...parsed.character },
        analytics: { ...this.state.analytics, ...parsed.analytics },
        lastResets: { ...this.state.lastResets, ...parsed.lastResets }
      };
    } else {
      // Novo herói: gera missões iniciais e recompensas padrão
      this.state.quests = [];
      this.state.character.campaignStage = 1;
      this.generateDailyQuests();
      this.generateWeeklyQuests();
      this.generateCampaignQuest();
      this.state.customRewards = [
        { id: 'r1', name: 'Pausa para Redes Sociais', desc: 'Liberado: Navegar 10 minutos livremente', cost: 40, isSystem: true },
        { id: 'r2', name: 'Chocolate / Café Premium', desc: 'Desbloqueia: Comer um doce ou café gourmet', cost: 60, isSystem: true },
        { id: 'r3', name: 'Episódio de Série', desc: 'Assistir a 1 episódio de série ou anime', cost: 100, isSystem: true },
        { id: 'r4', name: 'Jogar Videogame (30m)', desc: 'Desbloqueia 30 minutos de gameplay relaxante', cost: 150, isSystem: true }
      ];
    }

    // Higienização para retrocompatibilidade (saves antigos / campos novos)
    if (!this.state.character.equipment) this.state.character.equipment = { weapon: null, armor: null, accessory: null };
    if (!this.state.unlockedEquipment) this.state.unlockedEquipment = [];
    if (this.state.focusCombo === undefined) this.state.focusCombo = 0;
    if (!this.state.unlockedTitles) this.state.unlockedTitles = ['Recruta do Saber'];
    if (!this.state.unlockedSkins) this.state.unlockedSkins = ['skin-default'];
    if (!this.state.unlockedThemes) this.state.unlockedThemes = ['default'];
    if (!this.state.activeBuffs) this.state.activeBuffs = { doubleXp: 0, doubleDamage: 0 };
    if (this.state.character.campaignStage === undefined) this.state.character.campaignStage = 1;

    // Converte saves antigos para o novo sistema dinâmico de missões
    if (!this.state.quests || this.state.quests.length === 0 || !this.state.quests.some(q => q.type === 'campaign')) {
      this.state.quests = [];
      this.generateDailyQuests();
      this.generateWeeklyQuests();
      this.generateCampaignQuest();
    }

    this.applyTheme(this.state.character.activeTheme);
    this.updateComboEffects();
  },

  // ==========================================================================
  // MÉTODOS DE MISSÕES DINÂMICAS DO POOL & SAGA (ANTI-CHEAT)
  // ==========================================================================
  generateDailyQuests() {
    const pool = [...DailyQuestsPool];
    const selected = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const q = pool.splice(idx, 1)[0];
      selected.push({
        id: `d_gen_${Date.now()}_${i}`,
        type: 'daily',
        name: q.name,
        desc: q.desc,
        xp: q.xp,
        gold: q.gold,
        completed: false,
        isSystem: true
      });
    }
    this.state.quests = this.state.quests.filter(q => q.type !== 'daily');
    this.state.quests.push(...selected);
  },

  generateWeeklyQuests() {
    const pool = [...WeeklyQuestsPool];
    const selected = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const q = pool.splice(idx, 1)[0];
      selected.push({
        id: `w_gen_${Date.now()}_${i}`,
        type: 'weekly',
        name: q.name,
        desc: q.desc,
        xp: q.xp,
        gold: q.gold,
        progress: 0,
        target: q.target,
        trackingType: q.trackingType,
        completed: false,
        isSystem: true
      });
    }
    this.state.quests = this.state.quests.filter(q => q.type !== 'weekly');
    this.state.quests.push(...selected);
  },

  generateCampaignQuest() {
    const stage = this.state.character.campaignStage || 1;
    const qData = EpicCampaignChain.find(c => c.stage === stage);

    // Remove qualquer missão de campanha antiga
    this.state.quests = this.state.quests.filter(q => q.type !== 'campaign');

    if (qData) {
      this.state.quests.push({
        id: `c_${stage}`,
        type: 'campaign',
        name: `Saga Etapa ${stage}: ${qData.name}`,
        desc: qData.desc,
        xp: qData.xp,
        gold: qData.gold,
        completed: false,
        isSystem: true,
        evalType: qData.evalType,
        target: qData.target
      });
    }
  },

  triggerWeeklyProgress(type, value) {
    let changed = false;
    this.state.quests.forEach(q => {
      if (q.type === 'weekly' && q.trackingType === type && !q.completed) {
        const oldProgress = q.progress || 0;
        q.progress = Math.min(q.target, oldProgress + value);
        if (q.progress !== oldProgress) changed = true;

        if (q.progress >= q.target && !q.completed) {
          q.completed = true;
          AudioSynth.playQuestComplete();
          this.addXp(q.xp);
          this.addGold(q.gold);
          this.addLog(`✅ Missão Semanal concluída: "${q.name}"! +${q.xp} XP e +${q.gold} GP.`, "victory");
          changed = true;
        }
      }
    });
    if (changed) {
      this.renderQuests();
      this.saveState();
    }
  },

  checkCampaignQuests() {
    const stage = this.state.character.campaignStage || 1;
    const quest = this.state.quests.find(q => q.type === 'campaign' && !q.completed);
    if (!quest) return;

    const qData = EpicCampaignChain.find(c => c.stage === stage);
    if (!qData) return;

    let completed = false;
    if (qData.evalType === 'level') {
      completed = (this.state.character.level >= qData.target);
    } else if (qData.evalType === 'total_minutes') {
      completed = (this.state.analytics.totalFocusMinutes >= qData.target);
    } else if (qData.evalType === 'items_unlocked') {
      const itemsCount = this.state.unlockedEquipment.length;
      completed = (itemsCount >= qData.target);
    } else if (qData.evalType === 'monsters_defeated') {
      completed = (this.state.analytics.monstersDefeated >= qData.target);
    } else if (qData.evalType === 'combo') {
      completed = (this.state.focusCombo >= qData.target);
    } else if (qData.evalType === 'god_mode_unlocked') {
      completed = this.state.unlockedSkins.includes('skin-god-mode') || this.state.unlockedThemes.length > 1;
    }

    if (completed) {
      quest.completed = true;
      AudioSynth.playQuestComplete();
      this.addXp(quest.xp);
      this.addGold(quest.gold);

      this.addLog(`🌟 CAMPANHA ÉPICA ETAPA ${stage} CONCLUÍDA: "${qData.name}"! +${quest.xp} XP e +${quest.gold} GP!`, "victory");
      this.showSplash(`Saga Épica Concluída! 🌟`, `Parabéns! Você concluiu a Etapa ${stage}: <strong>${qData.name}</strong>.<br>Concedido: +${quest.xp} XP e +${quest.gold} GP.<br>A próxima missão da saga foi desbloqueada!`, "⚔️");

      this.state.character.campaignStage++;
      this.saveState();

      // Gera a próxima missão e renderiza
      setTimeout(() => {
        this.generateCampaignQuest();
        this.renderQuests();
        this.renderCharacterCard();
      }, 1000);
    }
  },

  // ============================================================
  // SAVE STATE — Híbrido: LocalStorage instantâneo + Supabase cloud em background
  //
  // Design: fire-and-forget. Todos os 25+ call sites existentes (this.saveState())
  // continuam funcionando sem nenhuma alteração, o gameplay não sofre nenhum lag.
  // ============================================================
  saveState() {
    // 1. LocalStorage: salva IMEDIATAMENTE (zero latência para o gameplay)
    try {
      localStorage.setItem('dopastudy_save', JSON.stringify(this.state));
    } catch (e) {
      console.warn('[saveState] LocalStorage falhou:', e.message);
    }

    // 2. Supabase Cloud: salva em background (fire-and-forget, não bloqueia)
    SupabaseAuth.saveProfile(this.state).catch(e =>
      console.warn('[saveState] Cloud sync falhou silenciosamente:', e?.message)
    );
  },

  // ==========================================================================
  // ATRIBUTOS DINÂMICOS (GETTERS EFETIVOS)
  // ==========================================================================
  getEffectiveStats() {
    const char = this.state.character;
    let focBonus = 0;
    let conBonus = 0;
    let intBonus = 0;

    if (char.equipment) {
      const slots = ['weapon', 'armor', 'accessory'];
      slots.forEach(slot => {
        const itemId = char.equipment[slot];
        if (itemId) {
          const item = this.shopEquipments.find(e => e.id === itemId);
          if (item) {
            if (item.id === 'eq-drone') {
              intBonus += 8;
              focBonus += 4;
            } else {
              if (item.bonusType === 'foc') focBonus += item.bonus;
              else if (item.bonusType === 'con') conBonus += item.bonus;
              else if (item.bonusType === 'int') intBonus += item.bonus;
            }
          }
        }
      });
    }

    return {
      foc: char.foc + focBonus,
      con: char.con + conBonus,
      int: char.int + intBonus
    };
  },

  // ==========================================================================
  // SISTEMA DE MISSÕES & RESETS (Diário e Semanal)
  // ==========================================================================
  checkResets() {
    const todayStr = new Date().toDateString();

    // 1. Reset Diário
    if (this.state.lastResets.daily !== todayStr) {
      this.generateDailyQuests();
      this.addLog("📅 Novo dia iniciado! Uma nova seleção de Missões Diárias foi gerada.", "info");
      this.state.lastResets.daily = todayStr;

      this.checkStreak();
      this.saveState();
    }

    // 2. Reset Semanal
    const currentWeek = this.getWeekNumber(new Date());
    if (this.state.lastResets.weekly !== String(currentWeek)) {
      this.generateWeeklyQuests();
      this.addLog("🗓️ Nova semana iniciada! Novas Missões Semanais foram geradas.", "info");
      this.state.lastResets.weekly = String(currentWeek);
      this.saveState();
    }
  },

  getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  },

  checkStreak() {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayKey = this.formatDateKey(today);
    const yesterdayKey = this.formatDateKey(yesterday);

    const hasFocusToday = (this.state.analytics.dailyFocusHistory[todayKey] || 0) > 0;
    const hasFocusYesterday = (this.state.analytics.dailyFocusHistory[yesterdayKey] || 0) > 0;

    if (!hasFocusYesterday && !hasFocusToday) {
      this.state.analytics.streak = 0;
    }
  },

  incrementStreak() {
    const today = new Date();
    const todayKey = this.formatDateKey(today);

    const hasFocusToday = (this.state.analytics.dailyFocusHistory[todayKey] || 0) > 0;
    if (!hasFocusToday) {
      this.state.analytics.streak += 1;
      this.addLog(`🔥 Streak de dias aumentado! Total: ${this.state.analytics.streak} dias.`, "info");
    }
  },

  // ==========================================================================
  // MONSTROS E BORDAS DE RPG
  // ==========================================================================
  spawnMonster() {
    const level = this.state.character.level;
    const monsterBase = Monsters[Math.floor(Math.random() * Monsters.length)];

    // Inimigos começam fracos e ficam progressivamente mais fortes com o tempo na mesma sessão!
    const sessionDefeats = this.sessionMonsterDefeats || 0;
    const sessionScaling = 1 + sessionDefeats * 0.25;
    const levelMult = (1 + (level - 1) * 0.15) * sessionScaling;
    const maxHp = Math.floor(monsterBase.baseHp * monsterBase.scale * levelMult);

    this.activeMonster = {
      name: monsterBase.name,
      emoji: monsterBase.emoji,
      maxHp: maxHp,
      hp: maxHp,
      xpReward: Math.floor(25 * monsterBase.scale * levelMult),
      goldReward: Math.floor(15 * monsterBase.scale * levelMult),
      level: level + sessionDefeats
    };

    this.renderMonster();
  },

  // Retorna nome do monstro customizado caso o input esteja preenchido
  getMonsterDisplayName() {
    const input = document.getElementById('subject-link-input');
    if (input && input.value.trim() !== '') {
      return `Monstro de: ${input.value.trim()}`;
    }
    return this.activeMonster.name;
  },

  // Morte do monstro a meio do cronômetro (continua sem parar)
  defeatMonsterMidTimer() {
    AudioSynth.playMonsterDefeated();

    // Combo multiplier
    const comboMultiplier = 1 + (this.state.focusCombo * 0.1);
    const doubleXpMultiplier = (this.state.activeBuffs && this.state.activeBuffs.doubleXp > 0) ? 2 : 1;
    const xpGained = Math.round(this.activeMonster.xpReward * comboMultiplier * doubleXpMultiplier);
    const goldGained = Math.round(this.activeMonster.goldReward * comboMultiplier);

    this.addXp(xpGained);
    this.addGold(goldGained);

    const displayName = this.getMonsterDisplayName();
    const buffSuffix = doubleXpMultiplier > 1 ? " [XP DUPLO ATIVO! 🧪]" : "";
    this.addLog(`👾 Derrotaste o ${displayName}! +${xpGained} XP${buffSuffix} e +${goldGained} GP! (Combo x${this.state.focusCombo} 🔥)`, "victory");

    this.state.analytics.monstersDefeated += 1;
    this.sessionMonsterDefeats = (this.sessionMonsterDefeats || 0) + 1;

    // Dispara progresso das novas missões
    this.triggerWeeklyProgress('monsters_defeated', 1);
    this.triggerWeeklyProgress('monster_damage', this.activeMonster.maxHp);
    this.checkCampaignQuests();

    // Animação visual de morte
    const sprite = document.getElementById('monster-sprite');
    if (sprite) {
      sprite.className = 'monster-sprite dead';
    }

    this.saveState();

    // Traz novo monstro automaticamente (será mais forte devido ao sessionMonsterDefeats!)
    setTimeout(() => {
      this.spawnMonster();
    }, 800);
  },

  // ==========================================================================
  // MECÂNICA DO TIMER POMODORO
  // ==========================================================================
  setTimerMode(mode) {
    if (this.timer.intervalId) return;

    this.timer.mode = mode;
    this.timer.isCustom = false;
    this.continuousFocusTicks = 0; // Reseta ticks contínuos

    const modeBtnFocus = document.querySelector('[data-mode="focus"]');
    const modeBtnShort = document.querySelector('[data-mode="short-break"]');
    const modeBtnLong = document.querySelector('[data-mode="long-break"]');

    if (modeBtnFocus && modeBtnShort && modeBtnLong) {
      [modeBtnFocus, modeBtnShort, modeBtnLong].forEach(btn => btn.classList.remove('primary'));

      let minutes = 25;
      if (mode === 'focus') {
        minutes = 25;
        modeBtnFocus.classList.add('primary');
        document.getElementById('timer-mode-label').textContent = "Foco ativo";
        document.getElementById('timer-progress').classList.remove('break-mode');
      } else if (mode === 'short-break') {
        minutes = 5;
        modeBtnShort.classList.add('primary');
        document.getElementById('timer-mode-label').textContent = "Pausa Rápida";
        document.getElementById('timer-progress').classList.add('break-mode');
      } else if (mode === 'long-break') {
        minutes = 15;
        modeBtnLong.classList.add('primary');
        document.getElementById('timer-mode-label').textContent = "Pausa Longa";
        document.getElementById('timer-progress').classList.add('break-mode');
      }

      this.timer.duration = minutes * 60;
      this.timer.timeLeft = this.timer.duration;
    }

    this.renderTimerDisplay();
  },

  startTimer() {
    AudioSynth.playClick();

    // Caso seja modo personalizado de foco
    if (this.timer.mode === 'idle') {
      const customMin = parseInt(document.getElementById('custom-minutes').value) || 25;
      this.timer.mode = 'focus';
      this.timer.duration = customMin * 60;
      this.timer.timeLeft = this.timer.duration;
      this.timer.isCustom = true;
    }

    this.cancelPauseCounter();

    document.getElementById('timer-start').style.display = 'none';
    document.getElementById('timer-pause').style.display = 'inline-flex';
    document.getElementById('timer-pause').disabled = false;
    document.getElementById('timer-reset').disabled = false;

    if (this.timer.mode === 'focus') {
      this.continuousFocusTicks = 0; // Reinicia o contador contínuo

      // Ajusta o HP do monstro para a duração
      const stats = this.getEffectiveStats();
      const dps = 1 + stats.foc * 0.05;
      this.activeMonster.maxHp = Math.ceil(this.timer.duration * dps);
      this.activeMonster.hp = this.activeMonster.maxHp;
      this.activeMonster.xpReward = Math.floor(25 * (this.timer.duration / 1500) * this.state.character.level);
      this.activeMonster.goldReward = Math.floor(15 * (this.timer.duration / 1500) * this.state.character.level);

      this.renderMonster();

      const displayName = this.getMonsterDisplayName();
      this.addLog(`⚔️ Combate iniciado contra o ${displayName}! Mantém o foco!`, "info");

      const sprite = document.getElementById('monster-sprite');
      if (sprite) sprite.className = 'monster-sprite idle';
    } else {
      this.addLog(`☕ Pausa iniciada. Descanse um pouco!`, "info");
    }

    // Corrige erro crítico limpando antes de criar
    if (this.timer.intervalId) clearInterval(this.timer.intervalId);
    this.timer.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  },

  pauseTimer() {
    AudioSynth.playClick();
    if (!this.timer.intervalId) return;

    clearInterval(this.timer.intervalId);
    this.timer.intervalId = null;

    // Regra estrita: pausou zera o timer de críticos ininterruptos
    this.continuousFocusTicks = 0;

    document.getElementById('timer-start').style.display = 'inline-flex';
    document.getElementById('timer-start').textContent = '▶ Retomar';
    document.getElementById('timer-pause').style.display = 'none';

    if (this.timer.mode === 'focus') {
      this.startPauseCounter();
    }
  },

  // Alerta de negligência 60s
  startPauseCounter() {
    const stats = this.getEffectiveStats();
    // Atributo CON estende o buffer inicial de pausa
    this.timer.pauseSecondsLeft = 60 + stats.con * 2;

    const pauseAlert = document.getElementById('pause-alert');
    const counterText = document.getElementById('pause-timer-counter');

    if (pauseAlert && counterText) {
      pauseAlert.style.display = 'flex';
      counterText.textContent = `${this.timer.pauseSecondsLeft}s`;
    }

    this.addLog(`⚠️ CUIDADO! O monstro está se preparando para contra-atacar!`, "penalty");

    if (this.timer.pauseIntervalId) clearInterval(this.timer.pauseIntervalId);
    this.timer.pauseIntervalId = setInterval(() => {
      this.timer.pauseSecondsLeft--;
      if (counterText) counterText.textContent = `${this.timer.pauseSecondsLeft}s`;

      if (this.timer.pauseSecondsLeft % 15 === 0 || this.timer.pauseSecondsLeft <= 5) {
        AudioSynth.playWarning();
      }

      if (this.timer.pauseSecondsLeft <= 0) {
        this.triggerMonsterCounterAttack(true);
      }
    }, 1000);
  },

  cancelPauseCounter() {
    if (this.timer.pauseIntervalId) {
      clearInterval(this.timer.pauseIntervalId);
      this.timer.pauseIntervalId = null;
    }
    const alertEl = document.getElementById('pause-alert');
    if (alertEl) alertEl.style.display = 'none';
  },

  triggerMonsterCounterAttack(wasPaused) {
    this.cancelPauseCounter();
    AudioSynth.playWarning();

    // Penalidade direta reduzida com Jaqueta de Couro Synthwave
    const hasJaqueta = this.state.character.equipment && this.state.character.equipment.armor === 'eq-jaqueta';
    const xpPenalty = hasJaqueta ? 7 : 15;
    this.removeXp(xpPenalty);

    // Reseta Combo de Foco para 0
    this.state.focusCombo = 0;
    this.updateComboEffects();

    const reason = wasPaused ? "excesso de pausa" : "desistência voluntária";
    const jacketSuffix = hasJaqueta ? " (Proteção da Jaqueta Synthwave ativa: -50% penalidade!)" : "";
    this.addLog(`❌ GOLPE CRÍTICO! Perdeste ${xpPenalty} XP${jacketSuffix} e resetaste teu Combo de Foco por ${reason}!`, "penalty");

    const card = document.getElementById('char-card');
    if (card) {
      card.style.animation = 'none';
      setTimeout(() => {
        card.style.animation = 'monsterShake 0.4s ease';
      }, 10);
    }

    this.resetTimerState();
  },

  abortTimer() {
    AudioSynth.playClick();
    const hasJaqueta = this.state.character.equipment && this.state.character.equipment.armor === 'eq-jaqueta';
    const penaltyMsg = hasJaqueta ? "perderá 7 XP (sua Jaqueta Synthwave absorveu 50%!)" : "perderá 15 XP";
    if (confirm(`Se você desistir agora, o monstro causará um golpe crítico, ${penaltyMsg} e o combo de foco. Continuar?`)) {
      this.triggerMonsterCounterAttack(false);
    }
  },

  resetTimerState() {
    clearInterval(this.timer.intervalId);
    this.timer.intervalId = null;
    this.cancelPauseCounter();
    this.continuousFocusTicks = 0;
    this.sessionMonsterDefeats = 0;

    this.timer.mode = 'idle';
    this.timer.timeLeft = 0;
    this.timer.duration = 0;

    const startBtn = document.getElementById('timer-start');
    const pauseBtn = document.getElementById('timer-pause');
    const resetBtn = document.getElementById('timer-reset');

    if (startBtn && pauseBtn && resetBtn) {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = '▶ Iniciar';
      pauseBtn.style.display = 'none';
      pauseBtn.disabled = true;
      resetBtn.disabled = true;
    }

    this.setTimerMode('focus');
    this.spawnMonster();
  },

  // Loop de contagem regressiva com dano contínuo corrigido
  tick() {
    try {
      if (this.timer.timeLeft > 0) {
        this.timer.timeLeft--;
        this.renderTimerDisplay();

        if (this.timer.mode === 'focus') {
          // Decrementa Buffs Temporários
          if (this.state.activeBuffs) {
            if (this.state.activeBuffs.doubleXp > 0) this.state.activeBuffs.doubleXp--;
            if (this.state.activeBuffs.doubleDamage > 0) this.state.activeBuffs.doubleDamage--;
            this.renderBuffsTimeline();

            // Re-renderiza loja se visível para atualizar o tempo ativo restante
            const skinShopTab = document.getElementById('tab-skin-shop');
            if (skinShopTab && skinShopTab.classList.contains('active')) {
              this.renderEpicShop();
            }
          }

          // Incrementa contador contínuo
          this.continuousFocusTicks++;

          // CÁLCULO DE DANO: Dano Efetivo = (FOC Efetivo * Passiva da Arma) * (doubleDamage > 0 ? 2 : 1)
          const stats = this.getEffectiveStats();
          const weaponPassiva = (this.state.character.equipment && this.state.character.equipment.weapon === 'eq-catana') ? 1.25 : 1.0;
          const doubleDamageMult = (this.state.activeBuffs && this.state.activeBuffs.doubleDamage > 0) ? 2 : 1;
          const dps = (stats.foc * weaponPassiva) * doubleDamageMult;

          this.activeMonster.hp = Math.max(0, this.activeMonster.hp - dps);
          this.renderMonster();

          // PASSIVA DO DRONE: +2 GP a cada tick e floatUp text
          const hasDrone = this.state.character.equipment && this.state.character.equipment.accessory === 'eq-drone';
          if (hasDrone) {
            this.addGold(2);
            this.showFloatingText('+2 GP 🪙', 'floating-loot');
          }

          // PASSIVA DOS ÓCULOS HUD: Aumenta em +5% a chance de acerto crítico a cada tick do timer
          const hasOculos = this.state.character.equipment && this.state.character.equipment.accessory === 'eq-oculos';
          const critChance = hasOculos ? 0.05 : 0;
          if (Math.random() < critChance) {
            this.triggerCriticalAttack(dps);
          }

          // Efeito de tremer o sprite
          if (this.timer.timeLeft % 10 === 0) {
            const sprite = document.getElementById('monster-sprite');
            if (sprite) {
              sprite.classList.remove('idle');
              sprite.classList.add('shake');
              setTimeout(() => {
                sprite.classList.remove('shake');
                sprite.classList.add('idle');
              }, 400);
            }
          }

          // Dispara Ataque Crítico a cada 5 minutos (300 ticks) de foco ininterrupto
          if (this.continuousFocusTicks > 0 && this.continuousFocusTicks % 300 === 0) {
            this.triggerCriticalAttack(dps);
          }

          // Se o monstro morrer com o cronômetro ativo
          if (this.activeMonster.hp <= 0) {
            this.defeatMonsterMidTimer();
          }
        }
      } else {
        // Concluiu sessão com sucesso
        this.completeTimerSession();
      }
    } catch (e) {
      console.error("Erro no motor do timer", e);
    }
  },

  // Executa ataque crítico a cada 5 minutos de foco ininterrupto
  triggerCriticalAttack(normalDps) {
    AudioSynth.playCriticalHit();

    const critDamage = normalDps * 15;
    this.activeMonster.hp = Math.max(0, this.activeMonster.hp - critDamage);
    this.renderMonster();

    // Dá ouro imediato
    this.addGold(5);

    const displayName = this.getMonsterDisplayName();
    this.addLog(`💥 ATAQUE CRÍTICO! Causaste ${Math.round(critDamage)} de dano massivo no ${displayName} por manteres foco estável! +5 GP!`, "damage");

    this.showFloatingText('+5 GP 🪙', 'floating-loot');
  },

  showFloatingText(text, className = 'floating-loot') {
    const container = document.getElementById('floating-text-container');
    if (container) {
      const floatEl = document.createElement('div');
      floatEl.className = className;
      floatEl.innerHTML = text;
      floatEl.style.left = `${30 + Math.random() * 40}%`;
      floatEl.style.top = `${20 + Math.random() * 30}%`;

      container.appendChild(floatEl);

      // Limpa após animação CSS acabar
      setTimeout(() => {
        floatEl.remove();
      }, 1200);
    }
  },

  completeTimerSession() {
    clearInterval(this.timer.intervalId);
    this.timer.intervalId = null;
    this.continuousFocusTicks = 0; // Reinicia contador

    if (this.timer.mode === 'focus') {
      const focusMinutes = Math.round(this.timer.duration / 60);

      // Incrementa Combo de Foco
      this.state.focusCombo += 1;
      this.updateComboEffects();
      this.addLog(`🔥 Combo de Foco aumentado! Multiplicador atual: +${this.state.focusCombo * 10}% de GP/XP.`, "victory");

      // Histórico analítico
      this.addFocusAnalytics(focusMinutes);

      // Se ainda sobrou HP, liquida o monstro
      if (this.activeMonster.hp > 0) {
        this.activeMonster.hp = 0;
        this.renderMonster();
        this.defeatMonsterMidTimer();
      }

      this.addLog(`🎉 Ciclo de Foco de ${focusMinutes}m completado! Foco estável.`, "victory");
      this.incrementStreak();

      // Reseta derrotas do monstro ao fim da sessão com sucesso
      this.sessionMonsterDefeats = 0;

      // Dispara missões diárias e semanais
      this.triggerDailyProgress('focus_session_completed', focusMinutes);
      const todayKey = this.formatDateKey(new Date());
      const minutesToday = this.state.analytics.dailyFocusHistory[todayKey] || 0;
      this.triggerDailyProgress('focus_minutes_today', minutesToday);
      this.triggerWeeklyProgress('combo', this.state.focusCombo);
      this.checkCampaignQuests();

      this.saveState();
      this.resetTimerState();
      this.setTimerMode('short-break');
    } else {
      AudioSynth.playQuestComplete();
      this.addLog(`💪 Intervalo concluído! Retornando ao combate de foco.`, "info");

      // Dispara missão diária de descanso saudável
      this.triggerDailyProgress('break_completed', 1);

      this.resetTimerState();
      this.setTimerMode('focus');
    }
  },

  updateComboEffects() {
    const badge = document.getElementById('combo-badge');
    const badgeVal = document.getElementById('combo-value-badge');

    if (badge && badgeVal) {
      if (this.state.focusCombo > 0) {
        badge.classList.add('active');
        badgeVal.textContent = this.state.focusCombo;
      } else {
        badge.classList.remove('active');
      }
    }

    // Injeta aura de chamas na tela no combo >= 2
    if (this.state.focusCombo >= 2) {
      document.body.classList.add('combo-glow-active');
    } else {
      document.body.classList.remove('combo-glow-active');
    }
  },

  // ==========================================================================
  // PROGRESSÃO DE NÍVEL, XP E GOLD
  // ==========================================================================
  getXpRequired(level) {
    return Math.floor(100 * Math.pow(level, 1.25));
  },

  addXp(amount) {
    const stats = this.getEffectiveStats();
    // Buff de intelecto efetivo (+1% XP por ponto)
    const intBonus = 1 + stats.int * 0.01;
    const finalAmount = Math.round(amount * intBonus);

    this.state.character.xp += finalAmount;

    let xpNeeded = this.getXpRequired(this.state.character.level);
    let leveledUp = false;

    while (this.state.character.xp >= xpNeeded) {
      this.state.character.xp -= xpNeeded;
      this.state.character.level++;

      this.state.character.foc += 1;
      this.state.character.con += 1;
      this.state.character.int += 1;

      leveledUp = true;
      xpNeeded = this.getXpRequired(this.state.character.level);
    }

    if (leveledUp) {
      this.triggerLevelUpEffects();
    }

    this.renderCharacterCard();
    this.saveState();
  },

  removeXp(amount) {
    this.state.character.xp = Math.max(0, this.state.character.xp - amount);
    this.renderCharacterCard();
    this.saveState();
  },

  addGold(amount) {
    this.state.character.gold += amount;
    this.renderGold();
    this.saveState();
  },

  deductGold(amount) {
    if (this.state.character.gold >= amount) {
      this.state.character.gold -= amount;
      this.renderGold();
      this.saveState();
      return true;
    }
    return false;
  },

  triggerLevelUpEffects() {
    AudioSynth.playLevelUp();
    this.addLog(`✨ Nível UP! Alcançaste o Nível ${this.state.character.level}! Atributos base elevados.`, "victory");
    this.showSplash("✨ SUBIU DE NÍVEL!", `Você alcançou o Nível ${this.state.character.level}! Seus atributos foram fortificados.`, "🏆");

    // Dispara validação de missões de campanha baseadas no novo nível
    this.checkCampaignQuests();
  },

  // ==========================================================================
  // QUADRO DE MISSÕES
  // ==========================================================================
  addQuest(name, desc, type, targetMinutes = 0) {
    let xp = 20;
    let gold = 10;

    if (type === 'weekly') {
      xp = 100;
      gold = 50;
    } else if (type === 'campaign') {
      xp = 350;
      gold = 180;
    }

    const newQuest = {
      id: 'custom_' + Date.now(),
      type,
      name,
      desc,
      xp,
      gold,
      completed: false
    };

    if (type === 'weekly') {
      newQuest.progress = 0;
      newQuest.target = targetMinutes;
      newQuest.desc += ` (Meta: ${targetMinutes} min)`;
    }

    this.state.quests.push(newQuest);
    this.saveState();
    this.renderQuests();
    this.addLog(`📋 Nova missão: "${name}"`, "info");
  },

  deleteQuest(id) {
    this.state.quests = this.state.quests.filter(q => q.id !== id);
    this.saveState();
    this.renderQuests();
    this.addLog(`🗑️ Missão removida.`, "info");
  },

  toggleQuest(id, checked) {
    const quest = this.state.quests.find(q => q.id === id);
    if (!quest) return;

    // Bloqueia marcação manual para missões semanais ou de campanha automáticas
    if (quest.type === 'weekly' || quest.id.startsWith('c')) {
      AudioSynth.playWarning();
      this.addLog(`⚠️ Missão automática! Complete os objetivos no timer/nível para liberá-la.`, "penalty");
      this.renderQuests();
      return;
    }

    if (checked && !quest.completed) {
      quest.completed = true;
      AudioSynth.playQuestComplete();

      this.addXp(quest.xp);
      this.addGold(quest.gold);

      this.addLog(`✅ Missão completada: "${quest.name}"! +${quest.xp} XP e +${quest.gold} GP.`, "victory");
      this.saveState();

      setTimeout(() => {
        this.renderQuests();
      }, 500);
    } else if (!checked && quest.completed) {
      quest.completed = false;
      this.removeXp(quest.xp);
      this.state.character.gold = Math.max(0, this.state.character.gold - quest.gold);
      this.renderGold();
      this.saveState();
      this.renderQuests();
    }
  },

  triggerDailyProgress(type, value) {
    let changed = false;
    this.state.quests.forEach(q => {
      if (q.type === 'daily' && q.trackingType === type && !q.completed) {
        if (type === 'focus_minutes_today') {
          q.progress = Math.min(q.target, value);
          changed = true;
        } else {
          const oldProgress = q.progress || 0;
          q.progress = Math.min(q.target, oldProgress + value);
          if (q.progress !== oldProgress) changed = true;
        }

        if (q.progress >= q.target && !q.completed) {
          q.completed = true;
          AudioSynth.playQuestComplete();
          this.addXp(q.xp);
          this.addGold(q.gold);
          this.addLog(`✅ Missão Diária concluída: "${q.name}"! +${q.xp} XP e +${q.gold} GP.`, "victory");
          changed = true;
        }
      }
    });
    if (changed) {
      this.renderQuests();
      this.saveState();
    }
  },

  // ==========================================================================
  // ECONOMIA: RECOMPENSAS DE HÁBITOS (TEMPTATION SHOP)
  // ==========================================================================
  addCustomReward(name, desc, cost) {
    const newReward = {
      id: 'rew_' + Date.now(),
      name,
      desc,
      cost: parseInt(cost) || 50,
      isSystem: false
    };

    this.state.customRewards.push(newReward);
    this.saveState();
    this.renderHabitRewards();
    this.addLog(`🛍️ Nova recompensa: "${name}"`, "info");
  },

  deleteReward(id) {
    this.state.customRewards = this.state.customRewards.filter(r => r.id !== id);
    this.saveState();
    this.renderHabitRewards();
    this.addLog(`🗑️ Recompensa removida.`, "info");
  },

  buyReward(id) {
    const reward = this.state.customRewards.find(r => r.id === id);
    if (!reward) return;

    if (this.deductGold(reward.cost)) {
      AudioSynth.playQuestComplete();
      this.state.analytics.rewardsClaimed += 1;
      this.triggerWeeklyProgress('rewards_claimed', 1);
      this.saveState();

      this.addLog(`🛍️ Recompensa comprada: "${reward.name}" por ${reward.cost} GP.`, "victory");
      this.showSplash("Recompensa Liberada! 🎁", `Você comprou e pode usufruir de:<br><strong>${reward.name}</strong><br><span style="font-size:0.85rem;color:var(--text-sub)">${reward.desc}</span>`, "🎉");
    } else {
      AudioSynth.playWarning();
      alert("Ouro insuficiente para resgatar esta recompensa!");
    }
  },

  // ==========================================================================
  // LOJA ÉPICA & GACHA
  // ==========================================================================
  buyEpicItem(type, id, cost) {
    if (this.deductGold(cost)) {
      AudioSynth.playQuestComplete();

      if (type === 'skin') {
        this.state.unlockedSkins.push(id);
        this.addLog(`👑 Skin Desbloqueada: "${this.shopSkins.find(s => s.id === id).name}"!`, "victory");
      } else if (type === 'title') {
        this.state.unlockedTitles.push(id);
        this.addLog(`👑 Título Desbloqueado: "${this.shopTitles.find(t => t.id === id).name}"!`, "victory");
      } else if (type === 'theme') {
        this.state.unlockedThemes.push(id);
        this.addLog(`👑 Tema Desbloqueado: "${this.shopThemes.find(th => th.id === id).name}"!`, "victory");
      } else if (type === 'equipment') {
        this.state.unlockedEquipment.push(id);
        this.addLog(`🗡️ Equipamento Desbloqueado: "${this.shopEquipments.find(eq => eq.id === id).name}"!`, "victory");
      }

      this.saveState();
      this.checkCampaignQuests();
      this.renderEpicShop();
      this.renderCharacterCard();
    } else {
      AudioSynth.playWarning();
      alert("Ouro insuficiente para comprar este item!");
    }
  },

  equipEpicItem(type, id) {
    AudioSynth.playClick();

    if (type === 'skin') {
      this.state.character.activeSkin = id;
      this.addLog(`👑 Skin de Perfil equipada.`, "info");
    } else if (type === 'title') {
      const titleObj = this.shopTitles.find(t => t.id === id);
      this.state.character.activeTitle = titleObj ? titleObj.name : 'Recruta do Saber';
      this.addLog(`👑 Novo título: "${this.state.character.activeTitle}"`, "info");
    } else if (type === 'theme') {
      const themeObj = this.shopThemes.find(th => th.id === id);
      this.state.character.activeTheme = themeObj ? themeObj.themeClass : 'default';
      this.applyTheme(this.state.character.activeTheme);
      this.addLog(`👑 Tema alterado.`, "info");
    } else if (type === 'equipment') {
      const eq = this.shopEquipments.find(e => e.id === id);
      if (eq) {
        const slot = eq.slot;
        const currentEquipped = this.state.character.equipment[slot];

        if (currentEquipped === id) {
          // Desequipa
          this.state.character.equipment[slot] = null;
          this.addLog(`🛡️ Desequipou ${eq.name}.`, "info");
        } else {
          // Equipa
          this.state.character.equipment[slot] = id;
          this.addLog(`🛡️ Equipou ${eq.name} no slot de ${slot === 'weapon' ? 'Arma' : slot === 'armor' ? 'Roupa' : 'Auxiliar'}.`, "info");
        }
      }
    }

    this.saveState();
    this.renderCharacterCard();
    this.renderEpicShop();
  },

  applyTheme(themeName) {
    document.documentElement.setAttribute('data-theme', themeName);
  },

  buyPotion(id, cost) {
    const pot = this.shopPotions.find(p => p.id === id);
    if (!pot) return;

    if (this.deductGold(cost)) {
      AudioSynth.playQuestComplete();

      if (!this.state.activeBuffs) {
        this.state.activeBuffs = { doubleXp: 0, doubleDamage: 0 };
      }
      this.state.activeBuffs[pot.type] = pot.duration;

      this.saveState();
      this.renderEpicShop();
      this.renderBuffsTimeline();

      this.addLog(`🧪 Consumiste ${pot.name}! Efeito "${pot.desc}" ativo!`, "victory");
    } else {
      AudioSynth.playWarning();
      alert("Ouro insuficiente para comprar esta poção!");
    }
  },

  renderBuffsTimeline() {
    const container = document.getElementById('buffs-timeline');
    if (!container) return;

    container.innerHTML = '';

    if (!this.state.activeBuffs) return;

    const doubleXp = this.state.activeBuffs.doubleXp || 0;
    const doubleDamage = this.state.activeBuffs.doubleDamage || 0;

    if (doubleXp > 0) {
      const min = Math.floor(doubleXp / 60);
      const sec = doubleXp % 60;
      const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

      const badge = document.createElement('div');
      badge.className = 'buff-badge xp-buff';
      badge.innerHTML = `<span>🧪 XP Duplo</span> <span class="buff-timer">${formatted}</span>`;
      container.appendChild(badge);
    }

    if (doubleDamage > 0) {
      const min = Math.floor(doubleDamage / 60);
      const sec = doubleDamage % 60;
      const formatted = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

      const badge = document.createElement('div');
      badge.className = 'buff-badge damage-buff';
      badge.innerHTML = `<span>⚡ Dano Duplo</span> <span class="buff-timer">${formatted}</span>`;
      container.appendChild(badge);
    }
  },

  // COMPRA E ROLAGEM DE GACHA DO BAÚ LENDÁRIO
  buyGachaChest() {
    let cost = 120;
    const droneEquipped = this.state.character.equipment && this.state.character.equipment.accessory === 'eq-drone';
    if (droneEquipped) {
      cost = Math.round(120 * 0.85); // 15% de desconto
    }

    if (this.deductGold(cost)) {
      AudioSynth.playClick();

      // Inicia animação visual de Baú no splash modal
      this.openModal('splash-modal');

      const splashIcon = document.getElementById('splash-icon');
      const splashTitle = document.getElementById('splash-title');
      const splashText = document.getElementById('splash-reward-text');

      if (splashIcon && splashTitle && splashText) {
        splashIcon.textContent = '📦';
        splashIcon.classList.add('chest-unboxing');
        splashTitle.textContent = 'Abrindo Baú Lendário...';
        splashText.innerHTML = 'Evocando as forças cognitivas da sorte. Aguarde...';

        // Bloqueia botão de continuar temporariamente
        const closeBtn = document.getElementById('btn-close-splash');
        if (closeBtn) closeBtn.disabled = true;

        setTimeout(() => {
          splashIcon.classList.remove('chest-unboxing');
          if (closeBtn) closeBtn.disabled = false;

          // Sorteio
          const rand = Math.random();
          if (rand < 0.60) {
            // 60% Potion +20 XP
            this.addXp(20);
            AudioSynth.playQuestComplete();
            splashIcon.textContent = '🧪';
            splashTitle.textContent = 'Drop Comum! 🧪';
            splashText.innerHTML = 'Você obteve uma <strong>Poção de Foco</strong>!<br>Concede +20 XP imediatos ao seu herói.';
            this.addLog(`📦 Gacha: Poção de Foco obtida (+20 XP).`, "victory");
          } else if (rand < 0.90) {
            // 30% Rares Title: Imparavel ou Silicio
            const titleId = Math.random() < 0.5 ? 'title-imparavel' : 'title-silicio';
            const titleName = titleId === 'title-imparavel' ? 'O Imparável' : 'Cérebro de Silício';

            if (!this.state.unlockedTitles.includes(titleId)) {
              this.state.unlockedTitles.push(titleId);
            }
            AudioSynth.playLevelUp();
            splashIcon.textContent = '👑';
            splashTitle.textContent = 'Drop Raro! 👑';
            splashText.innerHTML = `Você desbloqueou um título honorífico exclusivo:<br><strong>"${titleName}"</strong><br>Exiba-o no seu card na aba de customização.`;
            this.addLog(`📦 Gacha: Título "${titleName}" obtido.`, "victory");
          } else {
            // 10% God Mode skin
            if (!this.state.unlockedSkins.includes('skin-god-mode')) {
              this.state.unlockedSkins.push('skin-god-mode');
            }
            AudioSynth.playLevelUp();
            splashIcon.textContent = '🔥';
            splashTitle.textContent = 'DROP LENDÁRIO! 🌟';
            splashText.innerHTML = 'Você alcançou o lendário <strong>Modo Deus</strong>!<br>Desbloqueou uma aura de chamas douradas divinas para equipar em seu card.';
            this.addLog(`📦 Gacha: Skin MODO DEUS obtida! 🔥`, "victory");
          }

          this.state.analytics.rewardsClaimed++;
          this.triggerWeeklyProgress('gacha_opened', 1);
          this.checkCampaignQuests();
          this.saveState();
          this.renderAll();
        }, 2200);
      }
    } else {
      AudioSynth.playWarning();
      alert(`Ouro insuficiente para abrir o Baú do Conhecimento Lendário (Preço: ${cost} GP)!`);
    }
  },

  // ==========================================================================
  // DASHBOARD E GRÁFICOS ANALÍTICOS (ANALYTICS ENGINE)
  // ==========================================================================
  addFocusAnalytics(minutes) {
    const todayStr = this.formatDateKey(new Date());

    if (!this.state.analytics.dailyFocusHistory[todayStr]) {
      this.state.analytics.dailyFocusHistory[todayStr] = 0;
    }
    this.state.analytics.dailyFocusHistory[todayStr] += minutes;
    this.state.analytics.totalFocusMinutes += minutes;

    // Dispara progresso das novas missões
    this.triggerWeeklyProgress('focus_minutes', minutes);
    this.triggerWeeklyProgress('active_days', 1);
    this.checkCampaignQuests();
  },

  formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  renderAnalyticsChart() {
    const chartContainer = document.getElementById('analytics-bar-chart');
    if (!chartContainer) return;

    chartContainer.innerHTML = '';

    const days = [];
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const dates = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d);
    }

    const values = dates.map(d => {
      const key = this.formatDateKey(d);
      return this.state.analytics.dailyFocusHistory[key] || 0;
    });

    const maxVal = Math.max(...values, 30);

    dates.forEach((date, index) => {
      const dayLabel = labels[date.getDay()];
      const val = values[index];
      const percent = (val / maxVal) * 100;

      const barCol = document.createElement('div');
      barCol.className = 'chart-bar-col';

      barCol.innerHTML = `
        <div class="chart-bar-container">
          <div class="chart-bar-fill" style="height: ${percent}%">
            ${val > 0 ? `<span class="chart-bar-value">${val}m</span>` : ''}
          </div>
        </div>
        <span class="chart-bar-label">${dayLabel}</span>
      `;

      chartContainer.appendChild(barCol);
    });

    const firstDate = dates[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    const lastDate = dates[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    document.getElementById('chart-date-range').textContent = `${firstDate} - ${lastDate}`;
  },

  // ==========================================================================
  // RENDERIZADORES DE INTERFACE E DOM MUTATIONS
  // ==========================================================================
  renderAll() {
    this.renderCharacterCard();
    this.renderGold();
    this.renderTimerDisplay();
    this.renderQuests();
    this.renderHabitRewards();
    this.renderEpicShop();
    this.renderAnalyticsDashboard();
    this.renderBuffsTimeline();
  },

  renderCharacterCard() {
    const char = this.state.character;
    const stats = this.getEffectiveStats(); // Usa atributos dinâmicos calculados

    // Avatar
    let avatar = '🧙‍♂️';
    let classNameStr = 'Mago da Matemática';

    if (char.class === 'writing') {
      avatar = '🗡️';
      classNameStr = 'Guerreiro da Escrita';
    } else if (char.class === 'research') {
      avatar = '🏹';
      classNameStr = 'Ladino da Pesquisa';
    } else if (char.class === 'coding') {
      avatar = '💻';
      classNameStr = 'Druida do Código';
    }

    document.getElementById('char-avatar').textContent = avatar;
    document.getElementById('char-name').textContent = char.name || 'Herói do Foco';
    document.getElementById('char-title').textContent = char.activeTitle;
    document.getElementById('char-class').textContent = classNameStr;
    document.getElementById('char-level').textContent = char.level;

    // XP Bar
    const xpNeeded = this.getXpRequired(char.level);
    const xpPercent = Math.min(100, (char.xp / xpNeeded) * 100);
    document.getElementById('char-xp-ratio').textContent = `${char.xp} / ${xpNeeded} XP`;
    document.getElementById('char-xp-fill').style.width = `${xpPercent}%`;

    // Atributos eficientes exibidos na interface (Base + Bonus)
    document.getElementById('stat-foc').textContent = stats.foc;
    document.getElementById('stat-con').textContent = stats.con;
    document.getElementById('stat-int').textContent = stats.int;

    // Atualiza Slots de Equipamento Equipados na Sidebar
    this.renderEquippedGearVisuals();

    // Skin do Card
    const cardEl = document.getElementById('char-card');
    cardEl.className = 'char-card glass-panel';

    if (char.activeSkin === 'skin-aura-purple') {
      cardEl.classList.add('skin-aura-purple');
    } else if (char.activeSkin === 'skin-aura-gold') {
      cardEl.classList.add('skin-aura-gold');
    } else if (char.activeSkin === 'skin-cosmic-space') {
      cardEl.classList.add('skin-cosmic-space');
    } else if (char.activeSkin === 'skin-god-mode') {
      cardEl.classList.add('skin-god-mode');
    } else if (char.activeSkin === 'skin-vaporwave-pink') {
      cardEl.classList.add('skin-vaporwave-pink');
    } else if (char.activeSkin === 'skin-matrix-green') {
      cardEl.classList.add('skin-matrix-green');
    } else if (char.activeSkin === 'skin-fire-red') {
      cardEl.classList.add('skin-fire-red');
    } else {
      cardEl.classList.add('skin-default');
    }
  },

  // Renderiza slots visuais de equipamentos equipados no perfil lateral
  renderEquippedGearVisuals() {
    const char = this.state.character;
    const slotWeapon = document.getElementById('slot-weapon');
    const slotArmor = document.getElementById('slot-armor');
    const slotAcc = document.getElementById('slot-accessory');
    const card = document.getElementById('char-card');

    if (!slotWeapon || !slotArmor || !slotAcc) return;

    // Remove classes visuais antigas
    card.classList.remove('has-weapon', 'has-armor', 'equipped-oculos', 'equipped-catana', 'equipped-jaqueta', 'equipped-drone');

    if (char.equipment.weapon) {
      const item = this.shopEquipments.find(e => e.id === char.equipment.weapon);
      if (item) {
        slotWeapon.textContent = item.emoji;
        slotWeapon.classList.add('filled');
        slotWeapon.title = `${item.name} (+${item.bonus} ${item.bonusType.toUpperCase()})`;
        card.classList.add('has-weapon');
        if (item.id === 'eq-catana') {
          card.classList.add('equipped-catana');
        }
      }
    } else {
      slotWeapon.textContent = '⚔️';
      slotWeapon.classList.remove('filled');
      slotWeapon.title = 'Mão vazia (Equipe uma arma)';
    }

    if (char.equipment.armor) {
      const item = this.shopEquipments.find(e => e.id === char.equipment.armor);
      if (item) {
        slotArmor.textContent = item.emoji;
        slotArmor.classList.add('filled');
        slotArmor.title = `${item.name} (+${item.bonus} ${item.bonusType.toUpperCase()})`;
        card.classList.add('has-armor');
        if (item.id === 'eq-jaqueta') {
          card.classList.add('equipped-jaqueta');
        }
      }
    } else {
      slotArmor.textContent = '🛡️';
      slotArmor.classList.remove('filled');
      slotArmor.title = 'Corpo vazio (Equipe uma roupa)';
    }

    if (char.equipment.accessory) {
      const item = this.shopEquipments.find(e => e.id === char.equipment.accessory);
      if (item) {
        slotAcc.textContent = item.emoji;
        slotAcc.classList.add('filled');
        slotAcc.title = `${item.name} (+${item.bonus} ${item.bonusType.toUpperCase()})`;
        if (item.id === 'eq-oculos') {
          card.classList.add('equipped-oculos');
        } else if (item.id === 'eq-drone') {
          card.classList.add('equipped-drone');
        }
      }
    } else {
      slotAcc.textContent = '🦉';
      slotAcc.classList.remove('filled');
      slotAcc.title = 'Auxiliar vazio (Equipe um pet/óculos)';
    }
  },

  renderGold() {
    document.getElementById('gold-value').textContent = this.state.character.gold;
  },

  renderTimerDisplay() {
    const minutes = Math.floor(this.timer.timeLeft / 60);
    const seconds = this.timer.timeLeft % 60;
    document.getElementById('timer-display').textContent =
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const circle = document.getElementById('timer-progress');
    if (circle && this.timer.duration > 0) {
      const dashOffset = 282.7 * (1 - this.timer.timeLeft / this.timer.duration);
      circle.style.strokeDashoffset = dashOffset;
    } else if (circle) {
      circle.style.strokeDashoffset = 0;
    }
  },

  renderMonster() {
    const displayName = this.getMonsterDisplayName();
    document.getElementById('monster-name').textContent = displayName;
    document.getElementById('monster-level').textContent = `Nível ${this.activeMonster.level}`;
    document.getElementById('monster-sprite').textContent = this.activeMonster.emoji;

    const hpPercent = Math.min(100, (this.activeMonster.hp / this.activeMonster.maxHp) * 100);
    document.getElementById('monster-hp-text').textContent = `${Math.ceil(this.activeMonster.hp)} / ${this.activeMonster.maxHp} HP`;
    document.getElementById('monster-hp-fill').style.width = `${hpPercent}%`;

    document.getElementById('monster-reward-xp').textContent = this.activeMonster.xpReward;
    document.getElementById('monster-reward-gold').textContent = this.activeMonster.goldReward;
  },

  renderQuests() {
    const dailyList = document.getElementById('daily-quest-list');
    const weeklyList = document.getElementById('weekly-quest-list');
    const campaignList = document.getElementById('campaign-quest-list');

    dailyList.innerHTML = '';
    weeklyList.innerHTML = '';
    campaignList.innerHTML = '';

    const questGroup = { daily: dailyList, weekly: weeklyList, campaign: campaignList };
    const counts = { daily: 0, weekly: 0, campaign: 0 };

    this.state.quests.forEach(quest => {
      counts[quest.type]++;
      const targetList = questGroup[quest.type];

      const card = document.createElement('div');
      card.className = 'quest-card glass-panel';
      if (quest.completed) card.style.opacity = '0.75';

      const isAuto = quest.type === 'weekly' || quest.id.startsWith('c') || (quest.type === 'daily' && quest.trackingType);

      let progressMarkup = '';
      if (quest.target && quest.target > 0) {
        const percent = Math.min(100, ((quest.progress || 0) / quest.target) * 100);
        const unit = (quest.trackingType && quest.trackingType.includes('minutes')) ? ' min' : '';
        progressMarkup = `
          <div class="quest-progress-block">
            <div class="quest-progress-header">
              <span>Progresso</span>
              <span>${quest.progress || 0} / ${quest.target}${unit}</span>
            </div>
            <div class="quest-progress-bar-bg">
              <div class="quest-progress-bar-fill" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <label class="quest-checkbox-label">
          <input type="checkbox" class="quest-checkbox" data-id="${quest.id}" ${quest.completed ? 'checked' : ''} ${isAuto ? 'disabled style="cursor: not-allowed; opacity: 0.6;" title="Esta missão é avaliada automaticamente pelo sistema"' : ''}>
          <div class="quest-details">
            <span class="quest-name-text">${quest.name}</span>
            <span class="quest-desc-text">${quest.desc}</span>
            ${progressMarkup}
          </div>
        </label>
        <div class="quest-side">
          <div class="quest-rewards">
            <span class="reward-badge xp">+${quest.xp} XP</span>
            <span class="reward-badge gold">+${quest.gold} GP</span>
          </div>
          ${!quest.isSystem ? `
            <button class="quest-delete-btn" data-delete-id="${quest.id}" title="Deletar missão">🗑️</button>
          ` : ''}
        </div>
      `;

      targetList.appendChild(card);
    });

    Object.keys(questGroup).forEach(type => {
      if (counts[type] === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state glass-panel';
        empty.innerHTML = `
          <span class="empty-icon">📂</span>
          <span>Nenhuma missão ativa nesta aba. Crie uma nova missão acima!</span>
        `;
        questGroup[type].appendChild(empty);
      }
    });
  },

  renderHabitRewards() {
    const rewardsList = document.getElementById('habit-rewards-list');
    rewardsList.innerHTML = '';

    if (this.state.customRewards.length === 0) {
      rewardsList.innerHTML = `
        <div class="empty-state glass-panel" style="grid-column: 1/-1">
          <span class="empty-icon">🎁</span>
          <span>Sua loja de hábitos está vazia. Adicione recompensas reais para se motivar!</span>
        </div>
      `;
      return;
    }

    this.state.customRewards.forEach(reward => {
      const card = document.createElement('div');
      card.className = 'shop-card glass-panel';

      card.innerHTML = `
        <div class="shop-card-info">
          <span class="shop-card-tag">Hábito Recompensa</span>
          <span class="shop-card-title">${reward.name}</span>
          <span class="shop-card-desc">${reward.desc}</span>
        </div>
        <div class="shop-card-footer">
          <div class="shop-price">🪙 <span>${reward.cost}</span> GP</div>
          <div class="habit-reward-actions">
            <button class="glass-btn primary buy-reward-btn" data-id="${reward.id}">Resgatar</button>
            ${!reward.isSystem ? `
              <button class="quest-delete-btn delete-reward-btn" data-delete-id="${reward.id}">🗑️</button>
            ` : ''}
          </div>
        </div>
      `;

      rewardsList.appendChild(card);
    });
  },

  renderEpicShop() {
    const listEl = document.getElementById('epic-shop-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    const activeSubCatBtn = document.querySelector('#tab-skin-shop .shop-sections-nav .quest-tab-btn.active');
    const cat = activeSubCatBtn ? activeSubCatBtn.dataset.shopCat : 'equipments';

    // Injeta o Baú de Gacha fixo no topo de qualquer categoria para incentivar as compras com desconto se Drone equipado
    let gachaCost = 120;
    const droneEquipped = this.state.character.equipment && this.state.character.equipment.accessory === 'eq-drone';
    if (droneEquipped) {
      gachaCost = Math.round(120 * 0.85); // 102 GP
    }

    const gachaCard = document.createElement('div');
    gachaCard.className = 'shop-card glass-panel gacha-card';
    gachaCard.innerHTML = `
      <div class="shop-card-info">
        <span class="shop-card-tag" style="color: var(--accent-gold)">🔑 GACHA RARO</span>
        <span class="shop-card-title">Baú do Conhecimento Lendário</span>
        <span class="shop-card-desc">Sorteie XP extra (60%), títulos de prestígio raros (30%) ou o visual lendário super estiloso Modo Deus (10%).</span>
      </div>
      <div class="shop-card-footer">
        <div class="shop-price">🪙 <span>${gachaCost}</span> GP ${droneEquipped ? '<span style="font-size:0.7rem; color:var(--accent-gold);">(-15% 🛸)</span>' : ''}</div>
        <button id="btn-buy-gacha" class="glass-btn primary" style="background: var(--accent-gold); color:#000; font-weight: 700;">Abrir Baú 📦</button>
      </div>
    `;
    listEl.appendChild(gachaCard);

    // Adiciona evento ao botão gacha
    document.getElementById('btn-buy-gacha').addEventListener('click', () => {
      this.buyGachaChest();
    });

    if (cat === 'equipments') {
      this.shopEquipments.forEach(eq => {
        const isUnlocked = this.state.unlockedEquipment.includes(eq.id);
        const isEquipped = this.state.character.equipment[eq.slot] === eq.id;

        const card = document.createElement('div');
        card.className = `shop-card glass-panel ${isUnlocked ? 'unlocked' : ''}`;

        let actionBtnMarkup = '';
        if (isEquipped) {
          actionBtnMarkup = `<button class="glass-btn success equip-eq-btn" data-id="${eq.id}">Desequipar</button>`;
        } else if (isUnlocked) {
          actionBtnMarkup = `<button class="glass-btn primary equip-eq-btn" data-id="${eq.id}">Equipar</button>`;
        } else {
          actionBtnMarkup = `<button class="glass-btn primary buy-eq-btn" data-id="${eq.id}" data-cost="${eq.cost}">Comprar</button>`;
        }

        card.innerHTML = `
          <div class="shop-card-info">
            <span class="shop-card-tag">${eq.slot === 'weapon' ? 'Arma' : eq.slot === 'armor' ? 'Roupa' : 'Acessório / Pet'}</span>
            <span class="shop-card-title">${eq.emoji} ${eq.name}</span>
            <span class="shop-card-desc">${eq.desc}</span>
          </div>
          <div class="shop-card-footer">
            <div class="shop-price">${isUnlocked ? 'Liberado' : `🪙 <span>${eq.cost}</span> GP`}</div>
            ${actionBtnMarkup}
          </div>
        `;
        listEl.appendChild(card);
      });
    } else if (cat === 'skins') {
      this.shopSkins.forEach(skin => {
        const isUnlocked = skin.id === 'skin-default' || this.state.unlockedSkins.includes(skin.id);
        const isActive = this.state.character.activeSkin === skin.id;

        const card = document.createElement('div');
        card.className = `shop-card glass-panel ${isUnlocked && skin.id !== 'skin-default' ? 'unlocked' : ''}`;

        let actionBtnMarkup = '';
        if (isActive) {
          actionBtnMarkup = `<button class="glass-btn success" disabled>Equipado</button>`;
        } else if (isUnlocked) {
          actionBtnMarkup = `<button class="glass-btn primary equip-skin-btn" data-id="${skin.id}">Equipar</button>`;
        } else {
          // Se for god mode e está bloqueado, indica como gacha
          if (skin.id === 'skin-god-mode') {
            actionBtnMarkup = `<button class="glass-btn" disabled style="font-size:0.75rem;">Gacha Exclusivo</button>`;
          } else {
            actionBtnMarkup = `<button class="glass-btn primary buy-skin-btn" data-id="${skin.id}" data-cost="${skin.cost}">Comprar</button>`;
          }
        }

        card.innerHTML = `
          <div class="shop-card-info">
            <span class="shop-card-tag">Aura Cosmética</span>
            <span class="shop-card-title">${skin.name}</span>
            <span class="shop-card-desc">${skin.desc}</span>
          </div>
          <div class="shop-card-footer">
            <div class="shop-price">${isUnlocked ? 'Liberado' : skin.id === 'skin-god-mode' ? 'Raro' : `🪙 <span>${skin.cost}</span> GP`}</div>
            ${actionBtnMarkup}
          </div>
        `;
        listEl.appendChild(card);
      });
    } else if (cat === 'titles') {
      const standardTitle = { id: 'title-recruta', name: 'Recruta do Saber', cost: 0, desc: 'Título inicial do aprendiz de foco.' };
      const allTitles = [standardTitle, ...this.shopTitles];

      allTitles.forEach(title => {
        const isUnlocked = title.cost === 0 || this.state.unlockedTitles.includes(title.id);
        const isActive = this.state.character.activeTitle === title.name;

        const card = document.createElement('div');
        card.className = `shop-card glass-panel ${isUnlocked && title.cost > 0 ? 'unlocked' : ''}`;

        let actionBtnMarkup = '';
        if (isActive) {
          actionBtnMarkup = `<button class="glass-btn success" disabled>Equipado</button>`;
        } else if (isUnlocked) {
          actionBtnMarkup = `<button class="glass-btn primary equip-title-btn" data-id="${title.id}">Exibir</button>`;
        } else {
          if (title.id === 'title-imparavel' || title.id === 'title-silicio') {
            actionBtnMarkup = `<button class="glass-btn" disabled style="font-size:0.75rem;">Gacha Exclusivo</button>`;
          } else {
            actionBtnMarkup = `<button class="glass-btn primary buy-title-btn" data-id="${title.id}" data-cost="${title.cost}">Desbloquear</button>`;
          }
        }

        card.innerHTML = `
          <div class="shop-card-info">
            <span class="shop-card-tag">Título Prestígio</span>
            <span class="shop-card-title">"${title.name}"</span>
            <span class="shop-card-desc">${title.desc}</span>
          </div>
          <div class="shop-card-footer">
            <div class="shop-price">${isUnlocked ? 'Desbloqueado' : (title.id === 'title-imparavel' || title.id === 'title-silicio') ? 'Raro' : `🪙 <span>${title.cost}</span> GP`}</div>
            ${actionBtnMarkup}
          </div>
        `;
        listEl.appendChild(card);
      });
    } else if (cat === 'potions') {
      this.shopPotions.forEach(pot => {
        const card = document.createElement('div');
        card.className = `shop-card glass-panel`;

        const activeSeconds = this.state.activeBuffs ? (this.state.activeBuffs[pot.type] || 0) : 0;
        let actionBtnMarkup = '';
        if (activeSeconds > 0) {
          const minutes = Math.floor(activeSeconds / 60);
          const seconds = activeSeconds % 60;
          const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          actionBtnMarkup = `<button class="glass-btn success" disabled>Ativo (${timeFormatted})</button>`;
        } else {
          actionBtnMarkup = `<button class="glass-btn primary buy-potion-btn" data-id="${pot.id}" data-cost="${pot.cost}">Beber 🧪</button>`;
        }

        card.innerHTML = `
          <div class="shop-card-info">
            <span class="shop-card-tag">Poção Consumível</span>
            <span class="shop-card-title">${pot.emoji} ${pot.name}</span>
            <span class="shop-card-desc">${pot.desc}</span>
          </div>
          <div class="shop-card-footer">
            <div class="shop-price">🪙 <span>${pot.cost}</span> GP</div>
            ${actionBtnMarkup}
          </div>
        `;
        listEl.appendChild(card);
      });
    } else if (cat === 'themes') {
      const standardTheme = { id: 'theme-default', name: 'Padrão Neon Dark', cost: 0, desc: 'O layout clássico escuro com roxo e verde fluorescente.', themeClass: 'default' };
      const allThemes = [standardTheme, ...this.shopThemes];

      allThemes.forEach(theme => {
        const isUnlocked = theme.cost === 0 || this.state.unlockedThemes.includes(theme.id);
        const isActive = this.state.character.activeTheme === theme.themeClass;

        const card = document.createElement('div');
        card.className = `shop-card glass-panel ${isUnlocked && theme.cost > 0 ? 'unlocked' : ''}`;

        let actionBtnMarkup = '';
        if (isActive) {
          actionBtnMarkup = `<button class="glass-btn success" disabled>Equipado</button>`;
        } else if (isUnlocked) {
          actionBtnMarkup = `<button class="glass-btn primary equip-theme-btn" data-id="${theme.id}">Equipar</button>`;
        } else {
          actionBtnMarkup = `<button class="glass-btn primary buy-theme-btn" data-id="${theme.id}" data-cost="${theme.cost}">Comprar</button>`;
        }

        card.innerHTML = `
          <div class="shop-card-info">
            <span class="shop-card-tag">Tema de Interface</span>
            <span class="shop-card-title">${theme.name}</span>
            <span class="shop-card-desc">${theme.desc}</span>
          </div>
          <div class="shop-card-footer">
            <div class="shop-price">${isUnlocked ? 'Desbloqueado' : `🪙 <span>${theme.cost}</span> GP`}</div>
            ${actionBtnMarkup}
          </div>
        `;
        listEl.appendChild(card);
      });
    }
  },

  renderAnalyticsDashboard() {
    document.getElementById('stat-streak-val').textContent = this.state.analytics.streak;
    document.getElementById('stat-total-focus').textContent = `${this.state.analytics.totalFocusMinutes} min`;
    document.getElementById('stat-monsters-killed').textContent = this.state.analytics.monstersDefeated;
    document.getElementById('stat-rewards-bought').textContent = this.state.analytics.rewardsClaimed;
    this.renderAnalyticsChart();
  },

  // ==========================================================================
  // REGISTRO DE EVENTOS (EVENT LISTENERS)
  // ==========================================================================
  setupEventListeners() {
    // 1. Navegação de Abas Principal
    document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        AudioSynth.playClick();

        const clickedItem = e.currentTarget;
        const tabName = clickedItem.dataset.tab;

        document.querySelectorAll('.nav-menu .nav-item').forEach(nav => nav.classList.remove('active'));
        clickedItem.classList.add('active');

        document.querySelectorAll('.view-tab').forEach(tab => tab.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');

        if (tabName === 'analytics') {
          this.renderAnalyticsDashboard();
        } else if (tabName === 'skin-shop') {
          this.renderEpicShop();
        }
      });
    });

    // 2. Seleção de Modos do Timer
    document.querySelectorAll('.timer-modes .timer-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        AudioSynth.playClick();
        const mode = e.currentTarget.dataset.mode;
        this.setTimerMode(mode);
      });
    });

    // 3. Controles do Timer
    document.getElementById('timer-start').addEventListener('click', () => {
      this.startTimer();
    });

    document.getElementById('timer-pause').addEventListener('click', () => {
      this.pauseTimer();
    });

    document.getElementById('timer-reset').addEventListener('click', () => {
      this.abortTimer();
    });

    // 4. Modos da Sub-Aba de Missões
    document.querySelectorAll('#tab-quests .quest-tabs-header .quest-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        AudioSynth.playClick();
        const type = e.currentTarget.dataset.questType;

        document.querySelectorAll('#tab-quests .quest-tabs-header .quest-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        document.querySelectorAll('#tab-quests .quest-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`pane-${type}`).classList.add('active');
      });
    });

    // 5. Modos da Sub-Aba da Loja Épica
    document.querySelectorAll('#tab-skin-shop .shop-sections-nav .quest-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        AudioSynth.playClick();

        document.querySelectorAll('#tab-skin-shop .shop-sections-nav .quest-tab-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this.renderEpicShop();
      });
    });

    // Vinculação de matéria real com atualização em tempo real do sprite header
    const subjectInput = document.getElementById('subject-link-input');
    if (subjectInput) {
      subjectInput.addEventListener('input', () => {
        this.renderMonster();
      });
    }

    // 6. Checkbox de Conclusão de Missão
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('quest-checkbox')) {
        const id = e.target.dataset.id;
        const checked = e.target.checked;
        this.toggleQuest(id, checked);
      }
    });

    // Deletar Missão
    document.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.quest-delete-btn');
      if (deleteBtn) {
        AudioSynth.playClick();
        const qId = deleteBtn.dataset.deleteId;
        if (qId.startsWith('custom_')) {
          this.deleteQuest(qId);
        } else {
          this.deleteReward(qId);
        }
      }
    });

    // 7. Ações de Compra na Loja de Recompensas
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('buy-reward-btn')) {
        const id = e.target.dataset.id;
        this.buyReward(id);
      }
    });

    // 8. Cliques da Loja Épica
    document.addEventListener('click', (e) => {
      // Comprar e Equipar Equipamentos
      if (e.target.classList.contains('buy-eq-btn')) {
        const id = e.target.dataset.id;
        const cost = parseInt(e.target.dataset.cost);
        this.buyEpicItem('equipment', id, cost);
      }
      if (e.target.classList.contains('equip-eq-btn')) {
        const id = e.target.dataset.id;
        this.equipEpicItem('equipment', id);
      }

      // Comprar/Equipar skins
      if (e.target.classList.contains('buy-skin-btn')) {
        const id = e.target.dataset.id;
        const cost = parseInt(e.target.dataset.cost);
        this.buyEpicItem('skin', id, cost);
      }
      if (e.target.classList.contains('equip-skin-btn')) {
        const id = e.target.dataset.id;
        this.equipEpicItem('skin', id);
      }

      // Comprar/Equipar Títulos
      if (e.target.classList.contains('buy-title-btn')) {
        const id = e.target.dataset.id;
        const cost = parseInt(e.target.dataset.cost);
        this.buyEpicItem('title', id, cost);
      }
      if (e.target.classList.contains('equip-title-btn')) {
        const id = e.target.dataset.id;
        this.equipEpicItem('title', id);
      }

      // Comprar/Equipar Temas
      if (e.target.classList.contains('buy-theme-btn')) {
        const id = e.target.dataset.id;
        const cost = parseInt(e.target.dataset.cost);
        this.buyEpicItem('theme', id, cost);
      }
      if (e.target.classList.contains('equip-theme-btn')) {
        const id = e.target.dataset.id;
        this.equipEpicItem('theme', id);
      }

      // Comprar Poções
      if (e.target.classList.contains('buy-potion-btn')) {
        const id = e.target.dataset.id;
        const cost = parseInt(e.target.dataset.cost);
        this.buyPotion(id, cost);
      }
    });

    // Class selection card triggers
    document.querySelectorAll('.class-card').forEach(card => {
      card.addEventListener('click', (e) => {
        AudioSynth.playClick();
        document.querySelectorAll('.class-card').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
      });
    });

    document.getElementById('btn-save-character').addEventListener('click', () => {
      const name = document.getElementById('intro-player-name').value.trim() || 'Estudante Lendário';
      const activeClassCard = document.querySelector('.class-card.active');
      const classId = activeClassCard ? activeClassCard.dataset.class : 'math';

      this.state.character.name = name;
      this.state.character.class = classId;

      if (classId === 'math') {
        this.state.character.foc = 12;
        this.state.character.con = 10;
        this.state.character.int = 10;
      } else if (classId === 'writing') {
        this.state.character.foc = 10;
        this.state.character.con = 12;
        this.state.character.int = 10;
      } else if (classId === 'research') {
        this.state.character.foc = 10;
        this.state.character.con = 10;
        this.state.character.int = 12;
      } else if (classId === 'coding') {
        this.state.character.foc = 11;
        this.state.character.con = 10;
        this.state.character.int = 11;
      }

      this.closeModal('intro-modal');
      this.saveState();
      this.renderAll();
      this.spawnMonster();

      AudioSynth.playLevelUp();
      this.addLog(`✨ Bem-vindo, ${name}! Sua jornada de estudos gamificados começou!`, "victory");
    });

    // Modais
    document.getElementById('open-add-quest-modal').addEventListener('click', () => {
      this.openModal('add-quest-modal');
    });

    document.getElementById('quest-type-select').addEventListener('change', (e) => {
      const isWeekly = e.target.value === 'weekly';
      document.getElementById('weekly-goal-group').style.display = isWeekly ? 'block' : 'none';
    });

    document.getElementById('btn-submit-quest').addEventListener('click', () => {
      const title = document.getElementById('quest-title-input').value.trim();
      const desc = document.getElementById('quest-desc-input').value.trim();
      const type = document.getElementById('quest-type-select').value;
      const targetMinutes = parseInt(document.getElementById('quest-weekly-target').value) || 60;

      if (!title) {
        alert("A missão necessita de um nome!");
        return;
      }

      this.addQuest(title, desc, type, targetMinutes);
      this.closeModal('add-quest-modal');

      document.getElementById('quest-title-input').value = '';
      document.getElementById('quest-desc-input').value = '';
    });

    document.getElementById('open-add-reward-modal').addEventListener('click', () => {
      this.openModal('add-reward-modal');
    });

    document.getElementById('btn-submit-reward').addEventListener('click', () => {
      const name = document.getElementById('reward-name-input').value.trim();
      const desc = document.getElementById('reward-desc-input').value.trim();
      const cost = parseInt(document.getElementById('reward-cost-input').value) || 50;

      if (!name) {
        alert("A recompensa necessita de um nome!");
        return;
      }

      this.addCustomReward(name, desc, cost);
      this.closeModal('add-reward-modal');

      document.getElementById('reward-name-input').value = '';
      document.getElementById('reward-desc-input').value = '';
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        const intro = document.getElementById('intro-modal');
        if (intro && intro.style.display !== 'none') return;

        // Bloqueia fechamento se o gacha ainda estiver abrindo
        const splashIcon = document.getElementById('splash-icon');
        if (splashIcon && splashIcon.classList.contains('chest-unboxing')) return;

        this.closeActiveModals();
      }
    });

    document.querySelectorAll('.modal-close-btn, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        // Bloqueia se gacha abrindo
        const splashIcon = document.getElementById('splash-icon');
        if (splashIcon && splashIcon.classList.contains('chest-unboxing')) return;
        this.closeActiveModals();
      });
    });

    document.getElementById('btn-close-splash').addEventListener('click', () => {
      this.closeModal('splash-modal');
    });
  },

  // ==========================================================================
  // JANELAS MODAIS E INTERAÇÃO
  // ==========================================================================
  openModal(modalId, closable = true) {
    AudioSynth.playClick();

    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('active');

    overlay.querySelectorAll('.modal-content').forEach(m => m.style.display = 'none');

    const target = document.getElementById(modalId);
    target.style.display = 'block';

    overlay.dataset.closable = String(closable);
  },

  closeModal(modalId) {
    AudioSynth.playClick();

    const overlay = document.getElementById('modal-overlay');
    document.getElementById(modalId).style.display = 'none';

    const activeModals = Array.from(overlay.querySelectorAll('.modal-content'))
      .filter(m => m.style.display !== 'none');

    if (activeModals.length === 0) {
      overlay.classList.remove('active');
    }
  },

  closeActiveModals() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay.dataset.closable === 'false') return;

    overlay.querySelectorAll('.modal-content').forEach(m => m.style.display = 'none');
    overlay.classList.remove('active');
  },

  showSplash(title, message, icon = '🎁') {
    const splashIcon = document.getElementById('splash-icon');
    const splashTitle = document.getElementById('splash-title');
    const splashText = document.getElementById('splash-reward-text');

    if (splashIcon && splashTitle && splashText) {
      splashIcon.textContent = icon;
      splashTitle.textContent = title;
      splashText.innerHTML = message;
    }

    this.openModal('splash-modal');
  },

  // ==========================================================================
  // REGISTRO DE EVENTOS (COMBAT LOG ENGINE)
  // ==========================================================================
  addLog(message, type = 'info') {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.textContent = `[${timeStr}] ${message}`;

    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  },

  // ============================================================
  // AUTH SCREEN UI — Show / Hide / Reset
  // ============================================================

  /** Exibe o auth overlay e turva o app */
  showAuthScreen() {
    const screen = document.getElementById('auth-screen');
    const app = document.querySelector('.app-container');
    if (screen) screen.classList.remove('hidden');
    if (app) app.classList.add('auth-blurred');
  },

  /** Esconde o auth overlay e restaura o app */
  hideAuthScreen() {
    const screen = document.getElementById('auth-screen');
    const app = document.querySelector('.app-container');
    if (screen) screen.classList.add('hidden');
    if (app) app.classList.remove('auth-blurred');
  },

  /** Reinicia o estado e volta à tela de login (após logout) */
  resetToAuthScreen() {
    // Limpa cache local
    localStorage.removeItem('dopastudy_save');
    // Para qualquer timer ativo
    if (this.timer.intervalId) {
      clearInterval(this.timer.intervalId);
      this.timer.intervalId = null;
    }
    // Oculta sidebar user info
    const bar = document.getElementById('user-info-bar');
    if (bar) bar.style.display = 'none';
    // Mostra tela de login
    this.showAuthScreen();
  },

  /** Exibe e-mail do jogador + botão de logout na sidebar */
  renderUserInfo() {
    const bar = document.getElementById('user-info-bar');
    const email = document.getElementById('user-email-display');
    if (bar && SupabaseAuth.currentUser) {
      bar.style.display = 'flex';
      if (email) email.textContent = SupabaseAuth.currentUser.email || 'Aventureiro';
    }
  },

  // ============================================================
  // AUTH EVENT LISTENERS — Form login/registro + logout
  // ============================================================
  setupAuthEventListeners() {
    let authMode = 'login'; // 'login' | 'register'

    // --- Troca de aba Login / Registro ---
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        authMode = btn.dataset.authMode;
        document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const submitText = document.getElementById('auth-submit-text');
        if (submitText) {
          submitText.textContent = authMode === 'login' ? '▶ Entrar na Conta' : '✨ Criar Conta RPG';
        }
        // Limpa erros ao trocar de modo
        this._setAuthError('');
      });
    });

    // --- Submit do formulário (login ou registro) ---
    const form = document.getElementById('auth-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email')?.value?.trim();
        const password = document.getElementById('auth-password')?.value;

        if (!email || !password) {
          this._setAuthError('❌ Preencha e-mail e senha para continuar.');
          return;
        }
        if (password.length < 6) {
          this._setAuthError('❌ A senha deve ter ao menos 6 caracteres.');
          return;
        }

        this._setAuthLoading(true);
        this._setAuthError('');

        try {
          if (authMode === 'login') {
            await SupabaseAuth.signIn(email, password);
          } else {
            await SupabaseAuth.signUp(email, password);
          }
          // O bootGame é acionado pelo onAuthChange listener no init()
          // mas chamamos diretamente também para garantir imediatismo:
          await this.bootGame();
        } catch (err) {
          const msg = this._translateAuthError(err.message);
          this._setAuthError(msg);
          this._setAuthLoading(false);
        }
      });
    }

    // --- Botão Logout na sidebar ---
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await SupabaseAuth.signOut();
        this.resetToAuthScreen();
      });
    }
  },

  /** Ativa/desativa o loader e botão de submit */
  _setAuthLoading(active) {
    const btn = document.getElementById('auth-submit');
    const text = document.getElementById('auth-submit-text');
    const loader = document.getElementById('auth-loader');
    if (!btn) return;
    btn.disabled = active;
    if (text) text.style.display = active ? 'none' : 'inline';
    if (loader) loader.style.display = active ? 'inline-block' : 'none';
  },

  /** Exibe / limpa mensagem de erro no form de auth */
  _setAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  },

  /** Traduz mensagens de erro do Supabase para português */
  _translateAuthError(msg = '') {
    if (msg.includes('Invalid login credentials')) return '❌ E-mail ou senha incorretos. Tente novamente.';
    if (msg.includes('Email not confirmed')) return '⚠️ Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
    if (msg.includes('User already registered')) return '❌ Este e-mail já está cadastrado. Faça login!';
    if (msg.includes('Password should be')) return '❌ A senha deve ter ao menos 6 caracteres.';
    if (msg.includes('Unable to validate')) return '❌ Credenciais inválidas. Verifique e tente novamente.';
    return `❌ Erro: ${msg}`;
  }

}; // fim do objeto App

// ============================================================
// BOOT — Dispara a inicialização assíncrona após o DOM carregar
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  App.init().catch(err => console.error('[DopaStudy] Erro crítico na inicialização:', err));
});
