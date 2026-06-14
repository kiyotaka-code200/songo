'use strict';
/* PLATEAU : 2 rangées × 7 cases  (index 0‑13)
     SUD (J1) : cases 0‑6  numérotées  7 6 5 4 3 2 1  (droite→gauche)
     NORD (J2): cases 7‑13 numérotées  1 2 3 4 5 6 7  (gauche→droite)

   Sens de jeu anti-horaire vu du dessus :
     SUD  : 0→1→2→3→4→5→6  (de gauche à droite pour J1)
     Jonction : 6→13
     NORD : 13→12→11→10→9→8→7  (de droite à gauche pour J2)
     Jonction : 7→0

   "Case 1" de chaque joueur = la case la plus à SA GAUCHE
     J1 : case 1 == index 0  (numéro affiché "7")  ← ATTENTION
          case 7 == index 6  (numéro affiché "1")
     J2 : case 1 == index 13 (numéro affiché "7")
          case 7 == index 7  (numéro affiché "1")

   CAPTURES :
     - Uniquement dans le camp adverse
     - Dernière graine atterrit sur une case adverse : si total 2‑4 → capture
     - SAUF si c'est la "case 1 adverse" (la plus à gauche de l'adversaire)
       ET pas de tour complet (< 14 graines distribuées dans ce coup)
     - Si tour complet (≥14 graines), la case 1 adverse : on prend juste 1 graine
     - Capture en chaîne vers l'arrière tant que 2‑4 graines
       (la case 1 adverse PEUT être prise en chaîne)

   SOLIDARITÉ :
     Camp adverse vide → distribuer AU MOINS 7 graines dans son territoire.
     Si impossible → distribuer le maximum possible.
     Si aucun coup n'atteint le camp adverse → fin de partie.

   INTERDITS :
     1. Interdit de semer 1 ou 2 graines chez l'adversaire via sa "case 7"
        (case 7 = index 6 pour J1, index 7 pour J2)
        Si contraint par solidarité → ces graines reviennent à l'adversaire.
     2. Interdit de vider complètement le camp adverse
        → si ça arrive : aucune prise n'est faite (graines restent).

   FIN DE PARTIE :
     - Solidarité impossible
     - Moins de 10 graines au total sur le plateau
     - Un joueur atteint ≥ 40 graines
   VICTOIRE : ≥ 40 graines ; sinon nul.
   ================================================================ */

/* ----------------------------------------------------------------
   CONSTANTES DE LAYOUT
   ----------------------------------------------------------------
   SENS ANTI-HORAIRE (vu de face, comme l'image) :
     La flèche descend à GAUCHE et monte à DROITE, donc :

     VISUEL DU PLATEAU (gauche → droite) :
       NORD (J2) : idx  7   8   9  10  11  12  13
                  affiché: 7   6   5   4   3   2   1
       SUD  (J1) : idx  6   5   4   3   2   1   0
                  affiché: 1   2   3   4   5   6   7

     SENS DE JEU anti-horaire :
       SUD  : droite→gauche : idx 0←1←2←3←4←5←6
              le joueur SUD distribue depuis sa droite vers sa gauche
              (l'index DÉCROÎT : 6→5→4→3→2→1→0)
       Jonction SUD→NORD côté gauche : 0 → 7
       NORD : gauche→droite : idx 7→8→9→10→11→12→13
              (l'index CROÎT)
       Jonction NORD→SUD côté droite : 13 → 6

     "Case 1" (la plus à SA gauche depuis son point de vue) :
       J1 SUD  : voit sa rangée de droite à gauche → sa gauche = idx 0
       J2 NORD : voit sa rangée de gauche à droite → sa gauche = idx 7

     "Case 7" (la plus à SA droite) :
       J1 SUD  : idx 6   (affiché "1")
       J2 NORD : idx 13  (affiché "1")
   ---------------------------------------------------------------- */
const COLS = 7;
const TOTAL = 14;

// Ordre anti-horaire : SUD droite→gauche, NORD gauche→droite
function nextIdx(cur) {
  // SUD : droite→gauche : 6→5→4→3→2→1→0
  if (cur > 0 && cur <= 6)  return cur - 1;
  // Jonction SUD→NORD côté gauche : 0→7
  if (cur === 0)             return 7;
  // NORD : gauche→droite : 7→8→9→10→11→12→13
  if (cur >= 7 && cur < 13) return cur + 1;
  // Jonction NORD→SUD côté droite : 13→6
  if (cur === 13)            return 6;
  return 0;
}

// Sens inverse (pour remonter la chaîne de captures)
function prevIdx(cur) {
  // SUD : inverse = gauche→droite : 0←1←…←6
  if (cur >= 0 && cur < 6)  return cur + 1;
  // Jonction : 6 vient de 13
  if (cur === 6)             return 13;
  // NORD : inverse = droite→gauche : 13←12←…←7
  if (cur > 7 && cur <= 13) return cur - 1;
  // Jonction : 7 vient de 0
  if (cur === 7)             return 0;
  return 0;
}

// Cases appartenant à chaque joueur
function playerHouses(p) {
  return p === 0
    ? [0, 1, 2, 3, 4, 5, 6]      // SUD
    : [7, 8, 9, 10, 11, 12, 13]; // NORD
}

// "Case 1" de chaque joueur (la plus à SA gauche, premier reçu en anti-horaire)
// J1 SUD  distribue droite→gauche : sa case 1 = idx 0  (affiché "7" visuellement)
// J2 NORD distribue gauche→droite : sa case 1 = idx 7  (affiché "7" visuellement)
function case1(p) { return p === 0 ? 0 : 7; }
// "Case 7" de chaque joueur (la plus à SA droite, dernière avant de passer chez l'adversaire)
// J1 SUD  : idx 6  (affiché "1")
// J2 NORD : idx 13 (affiché "1")
function case7(p) { return p === 0 ? 6 : 13; }

/* ----------------------------------------------------------------
   1. MOTEUR  SongoGame
   ---------------------------------------------------------------- */
class SongoGame {
  constructor(seeds = 5) {
    this.board = Array(TOTAL).fill(seeds);
    this.scores = [0, 0];
    this.currentPlayer = 0;
    this.gameOver = false;
    this.gameOverReason = '';
  }

  clone() {
    const g = new SongoGame(0);
    g.board = [...this.board];
    g.scores = [...this.scores];
    g.currentPlayer = this.currentPlayer;
    g.gameOver = this.gameOver;
    g.gameOverReason = this.gameOverReason;
    return g;
  }

  isOwnHouse(p, i)  { return playerHouses(p).includes(i); }
  isOppHouse(p, i)  { return playerHouses(1 - p).includes(i); }
  isCampEmpty(p)    { return playerHouses(p).every(i => this.board[i] === 0); }
  totalSeeds()      { return this.board.reduce((s, v) => s + v, 0) + this.scores[0] + this.scores[1]; }
  seedsOnBoard()    { return this.board.reduce((s, v) => s + v, 0); }

  /* Calcule le chemin parcouru par les graines depuis idx */
  computePath(idx) {
    const seeds = this.board[idx];
    const skip = seeds > 13; // saut de la case de départ au 1er tour complet
    const path = [];
    let cur = idx, rem = seeds, firstLap = true;
    while (rem > 0) {
      cur = nextIdx(cur);
      if (skip && cur === idx && firstLap) { firstLap = false; continue; }
      path.push(cur);
      rem--;
    }
    return path;
  }

  /* Nombre de graines qui atterriront dans le camp adverse */
  _seedsToOpp(player, idx) {
    const opp = 1 - player;
    return this.computePath(idx).filter(i => this.isOppHouse(opp, i)).length;
  }

  /* Simule un coup et retourne le board résultant (sans captures) */
  _simBoard(idx) {
    const b = [...this.board];
    const path = this.computePath(idx);
    b[idx] = 0;
    path.forEach(i => b[i]++);
    return { b, path };
  }

  /* Vérifie si un coup vide complètement le camp adverse */
  _wouldEmptyOpp(player, idx) {
    const opp = 1 - player;
    const { b, path } = this._simBoard(idx);
    // Simuler les captures
    const lastIdx = path[path.length - 1];
    let cur = lastIdx;
    const captured = new Set();
    while (true) {
      if (!this.isOppHouse(player, cur)) break; // doit être case adverse (opp du joueur)
      // recalcul : isOppHouse(player, cur) = isOwnHouse(opp, cur)
      if (!playerHouses(opp).includes(cur)) break;
      const cnt = b[cur];
      if (cnt >= 2 && cnt <= 4) { captured.add(cur); b[cur] = 0; cur = prevIdx(cur); }
      else break;
    }
    return playerHouses(opp).every(i => b[i] === 0);
  }

  /* Validation d'un coup */
  validateMove(player, idx) {
    if (this.gameOver)                return { valid: false, reason: 'La partie est terminée.' };
    if (player !== this.currentPlayer)return { valid: false, reason: "Ce n'est pas votre tour." };
    if (!this.isOwnHouse(player, idx))return { valid: false, reason: 'Jouez vos propres cases.' };
    if (this.board[idx] === 0)        return { valid: false, reason: 'Cette case est vide.' };

    const opp = 1 - player;

    // ── SOLIDARITÉ ──
    if (this.isCampEmpty(opp)) {
      const seedsToOpp = this._seedsToOpp(player, idx);
      // Chercher si un coup peut envoyer ≥ 7 graines
      const canSend7 = playerHouses(player)
        .some(i => this.board[i] > 0 && this._seedsToOpp(player, i) >= 7);

      if (canSend7 && seedsToOpp < 7) {
        return { valid: false, reason: '⚠ Solidarité : vous devez distribuer au moins 7 graines dans le camp adverse.' };
      }
      if (!canSend7) {
        // Doit maximiser les graines envoyées
        const maxSend = Math.max(...playerHouses(player)
          .filter(i => this.board[i] > 0)
          .map(i => this._seedsToOpp(player, i)));
        if (seedsToOpp < maxSend) {
          return { valid: false, reason: `⚠ Solidarité : jouez un coup qui envoie le maximum (${maxSend}) de graines à l'adversaire.` };
        }
        if (maxSend === 0) {
          return { valid: false, reason: '⚠ Solidarité impossible : aucun coup n\'atteint le camp adverse.' };
        }
      }
    }

    // ── INTERDIT 2 : vider le camp adverse ──
    if (this._wouldEmptyOpp(player, idx)) {
      // Le coup est jouable MAIS sans capture (géré dans applyMove)
      // On l'autorise mais on flag pour annuler les captures
    }

    // ── INTERDIT 1 : case 7 → 1 ou 2 graines chez adversaire ──
    // (géré dans applyMove, pas un blocage mais une redirection)

    return { valid: true, reason: '' };
  }

  /* Application d'un coup — retourne les détails pour l'animation */
  applyMove(player, idx) {
    const opp = 1 - player;
    const path = this.computePath(idx);
    const seeds = this.board[idx];
    const isCase7 = (idx === case7(player));
    const fullTour = seeds >= 14; // tour complet → case 1 adverse spéciale

    this.board[idx] = 0;
    path.forEach(i => this.board[i]++);

    const lastIdx = path[path.length - 1];
    const wouldEmptyOpp = playerHouses(opp).every(i => this.board[i] === 0);

    let captures = [];
    let case7Redirect = 0; // graines renvoyées à l'adversaire (interdit 1)

    if (!wouldEmptyOpp) {
      // ── Captures normales ──
      let cur = lastIdx;
      while (true) {
        if (!playerHouses(opp).includes(cur)) break;
        const cnt = this.board[cur];
        const isCase1Opp = (cur === case1(opp));

        if (isCase1Opp && !fullTour) {
          // Case 1 adverse sans tour complet → pas de capture 2-4
          // mais elle peut être prise en chaîne si on a déjà capturé la case précédente
          // En pratique : si on arrive ici DIRECTEMENT comme last, pas de capture
          // si on arrive en chaîne → on capture
          // La logique : on casse la chaîne ici sauf si on était déjà en chaîne
          if (captures.length === 0) break; // arrivée directe → pas de capture
          // En chaîne : on peut capturer
        }

        if (cnt >= 2 && cnt <= 4) {
          // Vérifier interdit 1 : case 7 du joueur, 1 ou 2 graines dans camp adverse
          if (isCase7 && playerHouses(opp).includes(cur)) {
            const grains = cnt;
            if (grains <= 2) {
              // Ces graines reviennent à l'adversaire (pas de capture)
              case7Redirect += grains;
              this.scores[opp] += grains;
              this.board[cur] = 0;
              cur = prevIdx(cur);
              continue;
            }
          }
          captures.push({ index: cur, seeds: cnt });
          this.scores[player] += cnt;
          this.board[cur] = 0;
          cur = prevIdx(cur);
        } else {
          break;
        }
      }
    }
    // Si wouldEmptyOpp → aucune capture (interdit 2)

    this.currentPlayer = opp;

    // ── Conditions de fin ──
    this._checkEndgame();

    return { path, lastIdx, captures, gameOver: this.gameOver, case7Redirect, wouldEmptyOpp };
  }

  _checkEndgame() {
    const p = this.currentPlayer;
    const opp = 1 - p;
    const total = this.seedsOnBoard();

    // 1. Un joueur ≥ 40 graines
    if (this.scores[0] >= 40 || this.scores[1] >= 40) {
      this._endCollect();
      return;
    }

    // 2. Moins de 10 graines sur le plateau
    if (total < 10) {
      this._endCollect();
      return;
    }

    // 3. Solidarité impossible
    if (this.isCampEmpty(opp)) {
      const canReach = playerHouses(p).some(i =>
        this.board[i] > 0 && this._seedsToOpp(p, i) > 0
      );
      if (!canReach) {
        // Graines restantes reviennent à leur propriétaire
        playerHouses(p).forEach(i => { this.scores[p] += this.board[i]; this.board[i] = 0; });
        this.gameOver = true;
        this.gameOverReason = 'solidarité_impossible';
        return;
      }
    }

    // 4. Joueur courant n'a plus de coups valides
    const moves = this.validMoves(p);
    if (moves.length === 0) {
      this._endCollect();
    }
  }

  _endCollect() {
    // Chaque joueur récupère les graines de son camp
    [0, 1].forEach(p => {
      playerHouses(p).forEach(i => { this.scores[p] += this.board[i]; this.board[i] = 0; });
    });
    this.gameOver = true;
    this.gameOverReason = 'fin_normale';
  }

  validMoves(p) {
    return playerHouses(p).filter(i => this.board[i] > 0 && this.validateMove(p, i).valid);
  }

  winner() {
    if (this.scores[0] >= 40) return 0;
    if (this.scores[1] >= 40) return 1;
    if (this.scores[0] > this.scores[1]) return 0;
    if (this.scores[1] > this.scores[0]) return 1;
    return -1; // nul
  }

  serialize() {
    return JSON.stringify({
      board: this.board, scores: this.scores,
      cur: this.currentPlayer, over: this.gameOver,
      reason: this.gameOverReason
    });
  }

  static deserialize(s) {
    const d = JSON.parse(s);
    const g = new SongoGame(0);
    g.board = d.board; g.scores = d.scores;
    g.currentPlayer = d.cur; g.gameOver = d.over;
    g.gameOverReason = d.reason || '';
    return g;
  }
}

/* ----------------------------------------------------------------
   2. IA  SongoAI
   ---------------------------------------------------------------- */
class SongoAI {
  constructor(level = 'medium') { this.level = level; }

  chooseMove(game, player) {
    const moves = game.validMoves(player);
    if (!moves.length) return null;
    if (this.level === 'easy')   return this._random(moves);
    if (this.level === 'medium') return this._heuristic(game, player, moves);
    return this._minimax(game, player, moves);
  }

  _random(moves) { return moves[Math.floor(Math.random() * moves.length)]; }

  _heuristic(game, player, moves) {
    let best = null, bestScore = -Infinity;
    for (const idx of moves) {
      const g2 = game.clone();
      const r = g2.applyMove(player, idx);
      let score = r.captures.reduce((s, c) => s + c.seeds, 0) * 10;
      score -= g2.scores[1 - player];
      if (r.captures.length > 1) score += 15;
      score += game.board[idx] < 5 ? 2 : 0;
      if (score > bestScore) { bestScore = score; best = idx; }
    }
    return best ?? this._random(moves);
  }

  _minimax(game, player, moves) {
    let best = null, bestScore = -Infinity;
    for (const idx of moves) {
      const g2 = game.clone();
      g2.applyMove(player, idx);
      const score = this._mm(g2, player, 3, -Infinity, Infinity, false);
      if (score > bestScore) { bestScore = score; best = idx; }
    }
    return best ?? this._random(moves);
  }

  _mm(game, maxPlayer, depth, alpha, beta, isMax) {
    if (depth === 0 || game.gameOver)
      return game.scores[maxPlayer] - game.scores[1 - maxPlayer];
    const cur = game.currentPlayer;
    const moves = game.validMoves(cur);
    if (!moves.length)
      return game.scores[maxPlayer] - game.scores[1 - maxPlayer];
    if (isMax) {
      let v = -Infinity;
      for (const m of moves) {
        const g2 = game.clone(); g2.applyMove(cur, m);
        v = Math.max(v, this._mm(g2, maxPlayer, depth - 1, alpha, beta, false));
        alpha = Math.max(alpha, v);
        if (beta <= alpha) break;
      }
      return v;
    } else {
      let v = Infinity;
      for (const m of moves) {
        const g2 = game.clone(); g2.applyMove(cur, m);
        v = Math.min(v, this._mm(g2, maxPlayer, depth - 1, alpha, beta, true));
        beta = Math.min(beta, v);
        if (beta <= alpha) break;
      }
      return v;
    }
  }
}

/* ----------------------------------------------------------------
   3. ANIMATION DE VOL  SeedFlight
   ---------------------------------------------------------------- */
class SeedFlight {
  static fly(fromEl, toEl, duration = 300, arcH = -60) {
    return new Promise(resolve => {
      const fR = fromEl.getBoundingClientRect(), tR = toEl.getBoundingClientRect();
      const x0 = fR.left + fR.width / 2,  y0 = fR.top + fR.height / 2;
      const x2 = tR.left + tR.width / 2,  y2 = tR.top + tR.height / 2;
      const cx = (x0 + x2) / 2, cy = (y0 + y2) / 2 + arcH;
      const colors = ['#E4A84A', '#C8832A', '#D4A017'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const dot = document.createElement('div');
      dot.style.cssText = `position:fixed;width:11px;height:11px;border-radius:50%;background:${color};border:1.5px solid #3A1A00;pointer-events:none;z-index:9999;left:${x0 - 5.5}px;top:${y0 - 5.5}px;will-change:transform,opacity;box-shadow:0 2px 6px rgba(0,0,0,.45);`;
      document.body.appendChild(dot);
      const t0 = performance.now();
      const b = (t, p0, p1, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
      const frame = now => {
        let t = Math.min((now - t0) / duration, 1);
        t = t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const x = b(t, x0, cx, x2), y = b(t, y0, cy, y2);
        const sc = 1 + .4 * Math.sin(Math.PI * t);
        const op = t < .08 ? t / .08 : t > .88 ? (1 - t) / .12 : 1;
        dot.style.left = `${x - 5.5}px`; dot.style.top = `${y - 5.5}px`;
        dot.style.transform = `scale(${sc})`; dot.style.opacity = op;
        if (t < 1) requestAnimationFrame(frame);
        else { dot.remove(); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }
}

/* ----------------------------------------------------------------
   4. SAUVEGARDE
   ---------------------------------------------------------------- */
class SaveManager {
  static KEY = 'songo_save_v5';
  static save(game, meta = {}) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ game: game.serialize(), meta, ts: Date.now() })); }
    catch (e) { console.warn('Save failed', e); }
  }
  static load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return { game: SongoGame.deserialize(d.game), meta: d.meta, ts: d.ts };
    } catch (e) { return null; }
  }
  static clear() { localStorage.removeItem(this.KEY); }
  static exists() { return !!localStorage.getItem(this.KEY); }
}

/* ----------------------------------------------------------------
   5. MULTIJOUEUR  OnlineManager (BroadcastChannel)
   ---------------------------------------------------------------- */
class OnlineManager {
  constructor(roomId, onMessage) {
    this.roomId = roomId;
    this.ch = new BroadcastChannel(`songo_room_${roomId}`);
    this.ch.onmessage = e => onMessage(e.data);
  }
  send(type, payload) { this.ch.postMessage({ type, payload, ts: Date.now() }); }
  close() { this.ch.close(); }
}

/* ----------------------------------------------------------------
   6. CONTRÔLEUR UI  SongoUI
   ---------------------------------------------------------------- */
class SongoUI {
  constructor() {
    this.game         = null;
    this.animating    = false;
    this.mode         = 'pvp';
    this.aiPlayer     = 1;
    this.aiLevel      = 'medium';
    this.ai           = new SongoAI('medium');
    this.playerNames  = ['Joueur 1', 'Joueur 2'];
    this.FLIGHT_MS    = 260;
    this.PAUSE_MS     = 32;
    this.demoTimer    = null;
    this.online       = null;
    this.onlinePlayer = 0;
    this.roomId       = null;

    this._grabEls();
    this._buildModeBar();
    this._bindEvents();
    this._checkSavedGame();
  }

  /* ── DOM ── */
  _grabEls() {
    this.rowP1       = document.getElementById('row-p1');
    this.rowP2       = document.getElementById('row-p2');
    this.statusMsg   = document.getElementById('status-message');
    this.statusInner = document.querySelector('.status-inner');
    this.statusIcon  = document.getElementById('status-icon');
    this.scoreP1     = document.getElementById('score-p1');
    this.scoreP2     = document.getElementById('score-p2');
    this.bannerP1    = document.getElementById('banner-p1');
    this.bannerP2    = document.getElementById('banner-p2');
    this.toastCont   = document.getElementById('toast-container');
    this.modalRules  = document.getElementById('modal-rules');
    this.modalEndgame= document.getElementById('modal-endgame');
    this.modalSetup  = document.getElementById('modal-setup');
    this.modeBar     = document.getElementById('mode-bar');
  }

  /* ── Barre de modes ── */
  _buildModeBar() {
    this.modeBar.innerHTML = `
      <button class="mode-btn active" data-mode="pvp"    title="2 joueurs locaux">⚔ Joueur vs Joueur</button>
      <button class="mode-btn"        data-mode="pve"    title="Affronter l'IA">🤖 vs IA</button>
      <button class="mode-btn"        data-mode="online" title="Multijoueur même PC">🌐 En ligne</button>
      <button class="mode-btn"        data-mode="demo"   title="Regarder l'IA jouer">▶ Démo</button>
    `;
    this.modeBar.querySelectorAll('.mode-btn').forEach(b =>
      b.addEventListener('click', () => this._switchMode(b.dataset.mode))
    );
  }

  /* ── Événements ── */
  _bindEvents() {
    document.getElementById('btn-rules').addEventListener('click',       () => this._openModal(this.modalRules));
    document.getElementById('btn-close-rules').addEventListener('click', () => this._closeModal(this.modalRules));
    document.getElementById('btn-new-game').addEventListener('click',    () => this._openSetup());
    document.getElementById('btn-replay').addEventListener('click',      () => { this._closeModal(this.modalEndgame); this.startGame(); });
    document.getElementById('setup-start').addEventListener('click',     () => this._applySetup());
    document.getElementById('setup-cancel').addEventListener('click',    () => this._closeModal(this.modalSetup));

    this.modalRules.querySelectorAll('.modal-tab').forEach(t =>
      t.addEventListener('click', () => this._switchTab(t))
    );
    [this.modalRules, this.modalEndgame, this.modalSetup].forEach(m =>
      m.addEventListener('click', e => { if (e.target === m) this._closeModal(m); })
    );
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape')
        [this.modalRules, this.modalEndgame, this.modalSetup].forEach(m => { if (!m.hidden) this._closeModal(m); });
    });

    setInterval(() => {
      if (this.game && !this.game.gameOver && this.mode !== 'demo')
        SaveManager.save(this.game, { mode: this.mode, aiLevel: this.aiLevel, names: this.playerNames });
    }, 30000);
  }

  /* ── Mode ── */
  _switchMode(m) {
    this._stopDemo();
    if (this.online) { this.online.close(); this.online = null; }
    this.mode = m;
    this.modeBar.querySelectorAll('.mode-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === m)
    );
    if (m === 'demo') this.startGame();
    else              this._openSetup();
  }

  /* ── Setup modal ── */
  _openSetup() {
    this._stopDemo();
    const s = this.modalSetup;
    s.querySelector('#setup-mode-label').textContent =
      this.mode === 'pvp'    ? 'Joueur vs Joueur' :
      this.mode === 'pve'    ? 'Joueur vs IA' :
      this.mode === 'online' ? 'En ligne (2 onglets)' : 'Démo IA vs IA';
    s.querySelector('#setup-pve-opts').style.display    = this.mode === 'pve'    ? '' : 'none';
    s.querySelector('#setup-online-opts').style.display = this.mode === 'online' ? '' : 'none';
    s.querySelector('#setup-names').style.display       = this.mode === 'demo'   ? 'none' : '';
    this._openModal(s);
  }

  _applySetup() {
    const s = this.modalSetup;
    const n1 = s.querySelector('#setup-name1').value.trim() || 'Joueur 1';
    const n2 = s.querySelector('#setup-name2').value.trim() || 'Joueur 2';
    this.playerNames = [n1, n2];
    document.getElementById('name-p1').textContent  = n1;
    document.getElementById('name-p2').textContent  = n2;
    document.getElementById('avatar-p1').textContent = n1.slice(0, 2).toUpperCase();
    document.getElementById('avatar-p2').textContent = n2.slice(0, 2).toUpperCase();

    if (this.mode === 'pve') {
      this.aiLevel  = s.querySelector('#setup-ai-level').value;
      this.aiPlayer = parseInt(s.querySelector('#setup-ai-side').value);
      this.ai = new SongoAI(this.aiLevel);
    }
    if (this.mode === 'online') {
      const rid = s.querySelector('#setup-room-id').value.trim() ||
        Math.random().toString(36).slice(2, 7).toUpperCase();
      this._initOnline(rid);
    }
    this._closeModal(s);
    this.startGame();
  }

  /* ── En ligne ── */
  _initOnline(roomId) {
    if (this.online) this.online.close();
    this.roomId = roomId;
    const myPlayer = parseInt(this.modalSetup.querySelector('#setup-online-side').value);
    this.onlinePlayer = myPlayer;
    this.online = new OnlineManager(roomId, data => this._onOnlineMessage(data));
    this._showToast(`🌐 Salle : ${roomId} — vous jouez en tant que ${this.playerNames[myPlayer]}`, 'good', 5000);
    document.getElementById('online-room-display').textContent = `Salle : ${roomId}`;
    document.getElementById('online-room-display').style.display = '';
  }

  _onOnlineMessage(data) {
    if (data.type === 'move' && !this.animating) {
      if (this.game.currentPlayer !== this.onlinePlayer) this._playMove(data.payload.idx);
    }
    if (data.type === 'reset') this.startGame(false);
  }

  /* ── Sauvegarde ── */
  _checkSavedGame() {
    if (SaveManager.exists()) {
      const saved = SaveManager.load();
      const ago = Math.round((Date.now() - saved.ts) / 60000);
      const resume = confirm(`Une partie sauvegardée existe (il y a ${ago} min).\nVoulez-vous la reprendre ?`);
      if (resume) {
        this.game = saved.game;
        this.mode = saved.meta.mode || 'pvp';
        this.aiLevel = saved.meta.aiLevel || 'medium';
        this.playerNames = saved.meta.names || ['Joueur 1', 'Joueur 2'];
        this.ai = new SongoAI(this.aiLevel);
        this.modeBar.querySelectorAll('.mode-btn').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === this.mode)
        );
        this._buildBoard();
        this._updateScores();
        this._updateBanners();
        this._setStatus('info', `Partie reprise — Tour de ${this.playerNames[this.game.currentPlayer]}.`);
        if (this.mode === 'pve' && this.game.currentPlayer === this.aiPlayer)
          setTimeout(() => this._triggerAI(), 800);
        return;
      }
    }
    this.startGame();
  }

  /* ── Démarrage ── */
  startGame(broadcast = true) {
    this._stopDemo();
    this.game = new SongoGame();
    this.animating = false;
    SaveManager.clear();
    this._buildBoard();
    this._updateScores();
    this._updateBanners();

    if (this.mode === 'demo') {
      this.playerNames = ['IA Sud', 'IA Nord'];
      this.ai = new SongoAI('medium');
      this._setStatus('info', 'Démo : IA vs IA en cours…');
      this.demoTimer = setTimeout(() => this._demoStep(), 1200);
    } else if (this.mode === 'pve') {
      this._setStatus('info', `Tour de ${this.playerNames[this.game.currentPlayer]} — choisissez une case.`);
      if (this.game.currentPlayer === this.aiPlayer)
        setTimeout(() => this._triggerAI(), 900);
    } else {
      this._setStatus('info', `Tour de ${this.playerNames[this.game.currentPlayer]} — choisissez une case.`);
    }
    if (this.online && broadcast) this.online.send('reset', {});
  }

  /* ── Démo ── */
  _demoStep() {
    if (!this.game || this.game.gameOver || this.mode !== 'demo' || this.animating) return;
    const p = this.game.currentPlayer;
    const idx = this.ai.chooseMove(this.game, p);
    if (idx === null) { this._showEndgame(); return; }
    this.animating = true;
    document.querySelectorAll('.house').forEach(b => b.disabled = true);
    this._getBtnByIdx(idx).classList.add('selected');
    this._playMove(idx, () => {
      if (!this.game.gameOver && this.mode === 'demo')
        this.demoTimer = setTimeout(() => this._demoStep(), 900);
    });
  }
  _stopDemo() { clearTimeout(this.demoTimer); this.demoTimer = null; }

  /* ── IA ── */
  _triggerAI() {
    if (this.animating || !this.game || this.game.gameOver) return;
    if (this.game.currentPlayer !== this.aiPlayer) return;
    const idx = this.ai.chooseMove(this.game, this.aiPlayer);
    if (idx === null) return;
    this.animating = true;
    document.querySelectorAll('.house').forEach(b => b.disabled = true);
    this._getBtnByIdx(idx).classList.add('selected');
    this._setStatus('info', `🤖 L'IA réfléchit…`);
    setTimeout(() => this._playMove(idx), 600);
  }

  /* ── Construction du plateau ──
     SENS ANTI-HORAIRE : flèche descend à gauche, monte à droite.
     SUD distribue droite→gauche ; NORD distribue gauche→droite.

     Rangée SUD  (J1) gauche→droite : idx 0  1  2  3  4  5  6
                       étiquettes   :     1  2  3  4  5  6  7
     Rangée NORD (J2) gauche→droite : idx 7   8   9  10  11  12  13
                       étiquettes   :     7   6   5   4   3   2   1

     Chemin anti-horaire : …→6→5→4→3→2→1→0→7→8→9→10→11→12→13→6→…
  */
  _buildBoard() {
    this.rowP1.innerHTML = '';
    this.rowP2.innerHTML = '';

    // Rangée J1 SUD : idx 0→6 de gauche à droite, étiquettes 1→7
    for (let i = 0; i < 7; i++) {
      const label = (i + 1).toString();
      this.rowP1.appendChild(this._makeHouse(i, 0, label));
    }
    // Rangée J2 NORD : idx 7→13 de gauche à droite, étiquettes 7→1
    for (let i = 7; i <= 13; i++) {
      const label = (14 - i).toString();
      this.rowP2.appendChild(this._makeHouse(i, 1, label));
    }
    this._refreshBoard();
  }

  _makeHouse(idx, owner, label) {
    const btn = document.createElement('button');
    btn.className = 'house';
    btn.dataset.idx   = idx;
    btn.dataset.owner = owner;
    btn.setAttribute('role', 'gridcell');

    const iEl = document.createElement('span'); iEl.className = 'house-index'; iEl.textContent = label;
    const cEl = document.createElement('span'); cEl.className = 'house-count';
    const sEl = document.createElement('div');  sEl.className = 'seeds-visual';
    btn.append(iEl, cEl, sEl);
    btn.addEventListener('click', () => this._onHouseClick(idx, owner));
    return btn;
  }

  /* ── Rafraîchissement ── */
  _refreshBoard() {
    const valid  = this.game.validMoves(this.game.currentPlayer);
    const isDemo = this.mode === 'demo';

    document.querySelectorAll('.house').forEach(btn => {
      const idx   = +btn.dataset.idx;
      const owner = +btn.dataset.owner;
      const cnt   = this.game.board[idx];

      this._setHouseCount(btn, cnt);
      btn.classList.remove('playable', 'forbidden', 'empty', 'selected');
      btn.disabled = this.animating || isDemo;

      if (cnt === 0) btn.classList.add('empty');
      else if (owner === this.game.currentPlayer && !this.animating && !isDemo)
        btn.classList.add(valid.includes(idx) ? 'playable' : 'forbidden');

      btn.setAttribute('aria-label', `Case ${btn.querySelector('.house-index').textContent} — ${cnt} graine${cnt !== 1 ? 's' : ''}`);
    });

    this.rowP1.classList.toggle('active-row', this.game.currentPlayer === 0);
    this.rowP2.classList.toggle('active-row', this.game.currentPlayer === 1);
  }

  _setHouseCount(btn, cnt) {
    btn.querySelector('.house-count').textContent = cnt > 0 ? cnt : '·';
    const sEl = btn.querySelector('.seeds-visual');
    sEl.innerHTML = '';
    for (let d = 0; d < Math.min(cnt, 9); d++) {
      const dot = document.createElement('span');
      dot.className = 'seed-dot';
      dot.style.animationDelay = `${d * 20}ms`;
      sEl.appendChild(dot);
    }
  }

  /* ── Clic joueur ── */
  _onHouseClick(idx, owner) {
    if (this.animating || this.game.gameOver || this.mode === 'demo') return;
    if (this.mode === 'online' && this.game.currentPlayer !== this.onlinePlayer) {
      this._showToast("Ce n'est pas votre tour (attendez l'autre onglet).", 'warn'); return;
    }
    if (owner !== this.game.currentPlayer) {
      this._showToast('Ce ne sont pas vos cases.', 'warn'); return;
    }
    const { valid, reason } = this.game.validateMove(this.game.currentPlayer, idx);
    if (!valid) { this._setStatus('warn', reason); this._showToast(reason, 'warn'); return; }

    document.querySelectorAll('.house').forEach(b => {
      b.classList.remove('selected', 'playable', 'forbidden'); b.disabled = true;
    });
    this._getBtnByIdx(idx).classList.add('selected');
    this.animating = true;
    if (this.online) this.online.send('move', { idx });
    this._playMove(idx);
  }

  /* ── Animation de vol + application ── */
  async _playMove(fromIdx, onDone) {
    const player = this.game.currentPlayer;
    const path   = this.game.computePath(fromIdx);
    const display = [...this.game.board];
    display[fromIdx] = 0;
    this._updateHouseDisplay(fromIdx, 0);
    const fromBtn = this._getBtnByIdx(fromIdx);
    const flights = [];

    for (let step = 0; step < path.length; step++) {
      const target    = path[step];
      const targetBtn = this._getBtnByIdx(target);
      const fR = fromBtn.getBoundingClientRect(), tR = targetBtn ? targetBtn.getBoundingClientRect() : fR;
      const dx = tR.left - fR.left, dy = tR.top - fR.top;
      const arc = -(Math.min(95, 32 + Math.sqrt(dx * dx + dy * dy) * 0.19));
      const fp = SeedFlight.fly(fromBtn, targetBtn, this.FLIGHT_MS, arc);
      flights.push(fp);
      fp.then(() => { display[target]++; this._updateHouseDisplay(target, display[target], true); });
      await this._sleep(this.PAUSE_MS);
    }

    await Promise.all(flights);
    await this._sleep(160);

    const result = this.game.applyMove(player, fromIdx);

    // Feedback interdit 2 (vider adverse)
    if (result.wouldEmptyOpp) {
      this._showToast('⚠ Interdit : vider le camp adverse — aucune capture effectuée.', 'warn', 4000);
    }

    // Feedback interdit 1 (case 7 → 1-2 graines)
    if (result.case7Redirect > 0) {
      this._showToast(`⚠ Interdit (case 7) : ${result.case7Redirect} graine(s) renvoyée(s) à l'adversaire.`, 'warn', 4000);
    }

    for (const cap of result.captures) {
      await this._sleep(250);
      this._flashCapture(cap.index);
      this._updateHouseDisplay(cap.index, 0);
      this._showToast(`✦ Capture ! +${cap.seeds} (case ${this._getBtnByIdx(cap.index)?.querySelector('.house-index')?.textContent || cap.index})`, 'good');
    }
    if (result.captures.length > 1) {
      const tot = result.captures.reduce((s, c) => s + c.seeds, 0);
      this._setStatus('good', `Capture en chaîne ! ${tot} graine${tot > 1 ? 's' : ''} capturée${tot > 1 ? 's' : ''}.`);
    }

    this._updateScores();
    SaveManager.save(this.game, { mode: this.mode, aiLevel: this.aiLevel, names: this.playerNames });

    if (result.gameOver) {
      await this._sleep(400); this._showEndgame();
    } else {
      const nxt = this.playerNames[this.game.currentPlayer];
      if (!result.captures.length)
        this._setStatus('info', `Tour de ${nxt} — choisissez une case.`);
      else
        setTimeout(() => this._setStatus('info', `Tour de ${nxt} — choisissez une case.`), 1800);
    }

    this.animating = false;
    this._updateBanners();
    this._refreshBoard();

    if (!result.gameOver && this.mode === 'pve' && this.game.currentPlayer === this.aiPlayer)
      setTimeout(() => this._triggerAI(), 700);

    if (onDone) onDone();
  }

  /* ── Affichage case ── */
  _updateHouseDisplay(idx, cnt, flash = false) {
    const btn = this._getBtnByIdx(idx); if (!btn) return;
    this._setHouseCount(btn, cnt); btn.classList.toggle('empty', cnt === 0);
    if (flash) {
      btn.classList.remove('landing'); void btn.offsetWidth; btn.classList.add('landing');
      setTimeout(() => btn.classList.remove('landing'), 450);
    }
  }
  _flashCapture(idx) {
    const btn = this._getBtnByIdx(idx); if (!btn) return;
    btn.classList.remove('captured'); void btn.offsetWidth; btn.classList.add('captured');
    setTimeout(() => btn.classList.remove('captured'), 700);
  }

  /* ── Scores / Banners ── */
  _updateScores() {
    this._animScore(this.scoreP1, this.game.scores[0]);
    this._animScore(this.scoreP2, this.game.scores[1]);
  }
  _animScore(el, val) {
    if (parseInt(el.textContent) !== val) {
      el.textContent = val;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      setTimeout(() => el.classList.remove('bump'), 400);
    }
  }
  _updateBanners() {
    this.bannerP1.classList.toggle('active-player', this.game.currentPlayer === 0);
    this.bannerP2.classList.toggle('active-player', this.game.currentPlayer === 1);
  }

  /* ── Statut ── */
  _setStatus(type, msg) {
    this.statusMsg.textContent = msg;
    this.statusInner.className = 'status-inner' + (type !== 'info' ? ` status-${type}` : '');
    const ic = {
      info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
      warn: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      good: '<polyline points="20 6 9 17 4 12"/>'
    };
    this.statusIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic[type] || ic.info}</svg>`;
  }

  /* ── Toasts ── */
  _showToast(msg, type = 'info', dur = 3000) {
    const t = document.createElement('div');
    t.className = `toast${type === 'warn' ? ' toast-warn' : type === 'good' ? ' toast-good' : ''}`;
    t.textContent = msg;
    this.toastCont.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast-out');
      setTimeout(() => t.remove(), 350);
    }, dur);
  }

  /* ── Modals ── */
  _openModal(m)  { m.hidden = false; }
  _closeModal(m) { m.hidden = true; }
  _switchTab(tab) {
    const id = tab.dataset.tab;
    this.modalRules.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    this.modalRules.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${id}`).classList.add('active');
  }

  /* ── Fin de partie ── */
  _showEndgame() {
    SaveManager.clear();
    const s = this.game.scores, w = this.game.winner();
    document.getElementById('eg-name-p1').textContent  = this.playerNames[0];
    document.getElementById('eg-name-p2').textContent  = this.playerNames[1];
    document.getElementById('eg-score-p1').textContent = s[0];
    document.getElementById('eg-score-p2').textContent = s[1];
    let winMsg;
    if (w === -1) {
      winMsg = 'Égalité parfaite — match nul !';
    } else {
      winMsg = `${this.playerNames[w]} remporte la partie avec ${s[w]} graines !`;
    }
    document.getElementById('endgame-winner').textContent = winMsg;
    this._openModal(this.modalEndgame);
  }

  /* ── Utilitaires ── */
  _getBtnByIdx(idx) { return document.querySelector(`.house[data-idx="${idx}"]`); }
  _sleep(ms)        { return new Promise(r => setTimeout(r, ms)); }
}

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', () => { window.songoUI = new SongoUI(); });