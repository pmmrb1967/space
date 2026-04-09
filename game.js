/* ============================================================
   SPACE INVADERS — Vanilla JS / Canvas
   ============================================================ */

(function () {
  'use strict';

  // ── DOM refs ──────────────────────────────────────────────
  const canvas         = document.getElementById('gameCanvas');
  const ctx            = canvas.getContext('2d');
  const scoreEl        = document.getElementById('score');
  const levelEl        = document.getElementById('level');
  const livesEl        = document.getElementById('lives');
  const startScreen    = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const victoryScreen  = document.getElementById('victoryScreen');
  const finalScoreEl   = document.getElementById('finalScore');
  const highScoreMsg   = document.getElementById('highScoreMsg');
  const nextLevelEl    = document.getElementById('nextLevel');
  const countdownEl    = document.getElementById('countdown');
  const startBtn       = document.getElementById('startBtn');
  const restartBtn     = document.getElementById('restartBtn');

  // ── Grid / sizing constants ────────────────────────────────
  const COLS       = 11;
  const ROWS       = 5;
  const ALIEN_W    = 36;
  const ALIEN_H    = 26;
  const ALIEN_PADX = 18;
  const ALIEN_PADY = 14;
  const PLAYER_W   = 48;
  const PLAYER_H   = 28;
  const BULLET_W   = 3;
  const BULLET_H   = 14;
  const SHIELD_BLOCK  = 6;
  const SHIELD_COLS   = 8;   // blocks wide per shield
  const SHIELD_ROWS_N = 5;   // blocks tall
  const SHIELD_COUNT  = 4;
  const MYSTERY_W  = 50;
  const MYSTERY_H  = 22;

  // ── Colours ───────────────────────────────────────────────
  const C_GREEN  = '#39ff14';
  const C_CYAN   = '#00f0ff';
  const C_RED    = '#ff3131';
  const C_YELLOW = '#ffe619';
  const C_PURPLE = '#c060ff';
  const C_WHITE  = '#ffffff';
  const C_ORANGE = '#ff8c00';

  // Alien type by row (top → bottom)
  const ALIEN_TYPES = [
    { color: C_PURPLE, pts: 30 },
    { color: C_CYAN,   pts: 20 },
    { color: C_CYAN,   pts: 20 },
    { color: C_GREEN,  pts: 10 },
    { color: C_GREEN,  pts: 10 },
  ];

  // ── State ────────────────────────────────────────────────
  let W, H;
  let state = 'start'; // 'start' | 'playing' | 'gameover' | 'victory'
  let score = 0;
  let highScore = parseInt(localStorage.getItem('si_hs') || '0', 10);
  let lives = 3;
  let level = 1;
  let rafId = null;
  let lastTs = 0;

  // Player object
  let player;
  // Aliens
  let aliens = [];
  let alienDir = 1;
  let alienDescend = false;
  let alienMoveTimer = 0;
  let alienMoveInterval = 500;
  let alienShootTimer = 0;
  let alienShootInterval = 1500;
  // Bullets
  let playerBullet = null;
  let alienBullets = [];
  // Shields
  let shields = [];
  // Mystery ship
  let mystery = null;
  let mysteryTimer = 0;
  let mysteryInterval = 20000;
  // Particles
  let particles = [];
  // Alien animation frame
  let alienFrame = 0;
  let alienFrameTimer = 0;
  // Screen flash
  let flashTimer = 0;
  let flashColor = C_RED;
  // Input keys map
  const keys = {};
  // Animated canvas stars
  let stars = [];
  // Marching sound index
  let marchIdx = 0;

  // ── Web Audio ──────────────────────────────────────────────
  let audioCtx = null;
  function ac() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }
  function tone(freq, type, dur, vol = 0.25, delay = 0) {
    try {
      const a = ac();
      const t = a.currentTime + delay;
      const osc  = a.createOscillator();
      const gain = a.createGain();
      osc.connect(gain);
      gain.connect(a.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    } catch (_) {}
  }
  function sfxShoot()    { tone(900, 'square',   0.07, 0.18); }
  function sfxAlienDie() { tone(220, 'sawtooth', 0.14, 0.3); tone(110, 'square', 0.09, 0.2, 0.07); }
  function sfxPlayerDie(){ tone(160, 'sawtooth', 0.35, 0.4); tone(90, 'square', 0.3, 0.3, 0.12); tone(60, 'sine', 0.3, 0.2, 0.28); }
  function sfxMystery()  { tone(1200,'square', 0.05, 0.4); tone(900,'square', 0.05, 0.4, 0.08); }
  function sfxLevelUp()  { [523,659,784,1047].forEach((f,i) => tone(f,'square',0.14,0.22,i*0.1)); }
  const MARCH_TONES = [160, 130, 100, 130];
  function sfxMarch()    { tone(MARCH_TONES[marchIdx++ % 4], 'square', 0.09, 0.13); }

  // ── Resize ────────────────────────────────────────────────
  function resize() {
    const maxW = Math.min(window.innerWidth, 800);
    const hudH  = document.getElementById('hud').offsetHeight;
    const availH = window.innerHeight - hudH;
    let cw = maxW;
    let ch = Math.floor(cw * 0.75);
    if (ch > availH) { ch = availH; cw = Math.floor(ch / 0.75); }
    canvas.width  = cw;
    canvas.height = ch;
    W = cw; H = ch;
    if (stars.length === 0) initStars();
    if (state === 'playing' && player) {
      player.y = H - PLAYER_H - 12;
      player.x = Math.min(player.x, W - PLAYER_W);
    }
  }
  window.addEventListener('resize', resize);

  // ── Stars ─────────────────────────────────────────────────
  function initStars() {
    stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.3 + 0.3,
      sp: Math.random() * 0.12 + 0.04,
      a: Math.random() * 0.6 + 0.3,
      col: Math.random() > 0.7 ? '#aef' : '#fff',
    }));
  }
  function updateStars(dt) {
    stars.forEach(s => { s.y += s.sp * dt * 0.06; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
  }
  function drawStars() {
    stars.forEach(s => {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.col;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  // ── Player ────────────────────────────────────────────────
  function createPlayer() {
    return {
      x: W / 2 - PLAYER_W / 2,
      y: H - PLAYER_H - 12,
      speed: W * 0.45,
      invincible: false,
      invTimer: 0,
      blinkTimer: 0,
      visible: true,
    };
  }

  function drawPlayer() {
    if (!player.visible) return;
    const { x, y } = player;
    const w = PLAYER_W, h = PLAYER_H;
    const cx = x + w / 2;
    const glow = player.invincible ? C_YELLOW : C_GREEN;

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = C_GREEN;

    // Base
    ctx.fillRect(x, y + h * 0.55, w, h * 0.45);
    // Torso
    ctx.fillRect(x + w * 0.18, y + h * 0.25, w * 0.64, h * 0.36);
    // Cannon
    ctx.fillRect(cx - w * 0.09, y, w * 0.18, h * 0.32);

    // Engine glow
    const pulse = 0.45 + 0.35 * Math.sin(Date.now() / 70);
    ctx.fillStyle = C_CYAN;
    ctx.globalAlpha = pulse;
    ctx.fillRect(cx - w * 0.08, y + h * 0.88, w * 0.16, h * 0.12);

    ctx.restore();
  }

  // ── Aliens ────────────────────────────────────────────────
  function createAliens() {
    aliens = [];
    const totalW = COLS * ALIEN_W + (COLS - 1) * ALIEN_PADX;
    const ox = (W - totalW) / 2;
    const oy = H * 0.12;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        aliens.push({
          x: ox + c * (ALIEN_W + ALIEN_PADX),
          y: oy + r * (ALIEN_H + ALIEN_PADY),
          row: r, col: c,
          alive: true,
          explodeTimer: 0,
        });
      }
    }
    alienDir           = 1;
    alienDescend       = false;
    alienMoveTimer     = 0;
    alienMoveInterval  = Math.max(550 - level * 40, 60);
    alienShootTimer    = 800 + Math.random() * 500;
    alienShootInterval = Math.max(1600 - level * 130, 350);
    mysteryInterval    = 18000 + Math.random() * 10000;
    mysteryTimer       = mysteryInterval;
    mystery            = null;
  }

  function liveAliens() { return aliens.filter(a => a.alive); }

  function alienBounds() {
    const live = liveAliens();
    if (!live.length) return null;
    return {
      minX: Math.min(...live.map(a => a.x)),
      maxX: Math.max(...live.map(a => a.x + ALIEN_W)),
      maxY: Math.max(...live.map(a => a.y + ALIEN_H)),
    };
  }

  function updateAliens(dt) {
    // Frame animation
    alienFrameTimer += dt;
    if (alienFrameTimer >= 500) { alienFrame ^= 1; alienFrameTimer = 0; }

    // Speed up as aliens die
    const aliveRatio = liveAliens().length / (COLS * ROWS);
    const speedFactor = 1 + (1 - aliveRatio) * 2.8;
    const interval = alienMoveInterval / speedFactor;

    alienMoveTimer += dt;
    if (alienMoveTimer >= interval) {
      alienMoveTimer = 0;
      sfxMarch();
      stepAliens();
    }

    // Shooting
    alienShootTimer -= dt;
    if (alienShootTimer <= 0) {
      alienShootTimer = (alienShootInterval / speedFactor) * (0.6 + Math.random() * 0.8);
      fireAlienBullet();
    }

    // Explode timers
    aliens.forEach(a => { if (a.explodeTimer > 0) a.explodeTimer -= dt; });
  }

  function stepAliens() {
    const b = alienBounds();
    if (!b) return;
    if (alienDescend) {
      const stepY = ALIEN_H * 0.6;
      aliens.forEach(a => { if (a.alive) a.y += stepY; });
      alienDir *= -1;
      alienDescend = false;
    } else {
      const stepX = ALIEN_W * 0.5;
      const nextMin = b.minX + alienDir * stepX;
      const nextMax = b.maxX + alienDir * stepX;
      if (nextMin < 4 || nextMax > W - 4) {
        alienDescend = true;
      } else {
        aliens.forEach(a => { if (a.alive) a.x += alienDir * stepX; });
      }
    }
  }

  function fireAlienBullet() {
    const live = liveAliens();
    if (!live.length) return;
    const cols = [...new Set(live.map(a => a.col))];
    const col  = cols[Math.floor(Math.random() * cols.length)];
    const colAliens = live.filter(a => a.col === col);
    const shooter = colAliens.reduce((best, a) => (a.row > best.row ? a : best));
    alienBullets.push({
      x: shooter.x + ALIEN_W / 2 - BULLET_W / 2,
      y: shooter.y + ALIEN_H,
      speed: 180 + level * 25,
      zigzag: Math.random() < 0.35,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // ── Pixel-art alien drawing ────────────────────────────────
  // Each alien type is a tiny bitmap drawn with filled rects.
  // Coordinate grid: 8 cols × 6 rows, centred on (cx, ty).

  function drawAlien(a) {
    if (!a.alive) {
      if (a.explodeTimer > 0) {
        const color = ALIEN_TYPES[a.row].color;
        ctx.save();
        ctx.globalAlpha = a.explodeTimer / 280;
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.floor(ALIEN_W * 1.1)}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('✳', a.x + ALIEN_W / 2, a.y + ALIEN_H * 0.9);
        ctx.restore();
      }
      return;
    }

    const { color } = ALIEN_TYPES[a.row];
    const cx = a.x + ALIEN_W / 2;
    const ty = a.y + 2;
    const s  = ALIEN_W / 14; // unit pixel size

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = 7;
    ctx.fillStyle   = color;

    if (a.row === 0)      drawAlienTop(ctx, cx, ty, s, alienFrame);
    else if (a.row <= 2)  drawAlienMid(ctx, cx, ty, s, alienFrame);
    else                  drawAlienBot(ctx, cx, ty, s, alienFrame);

    ctx.restore();
  }

  // Helper: draw one pixel block at grid position (gc, gr)
  function px(ctx, cx, ty, s, gc, gr) {
    ctx.fillRect(cx + (gc - 3.5) * s * 2, ty + gr * s * 1.8, s * 1.9, s * 1.7);
  }

  function drawAlienTop(ctx, cx, ty, s, f) {
    // UFO / mushroom shape
    [[1,2],[1,5],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],
     [3,0],[3,2],[3,3],[3,4],[3,5],[3,7],
     [4,0],[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7],
     [5,2],[5,3],[5,4],[5,5]].forEach(([r,c]) => px(ctx, cx, ty, s, c, r));
    if (f === 0) { px(ctx, cx, ty, s, 0, 5); px(ctx, cx, ty, s, 7, 5); }
    else         { px(ctx, cx, ty, s, 1, 5); px(ctx, cx, ty, s, 6, 5); px(ctx, cx, ty, s, 0, 6); px(ctx, cx, ty, s, 7, 6); }
  }

  function drawAlienMid(ctx, cx, ty, s, f) {
    // Crab shape
    [[1,3],[1,4],[2,2],[2,3],[2,4],[2,5],
     [3,1],[3,2],[3,3],[3,4],[3,5],[3,6],
     [4,0],[4,2],[4,5],[4,7],
     [5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7]].forEach(([r,c]) => px(ctx, cx, ty, s, c, r));
    if (f === 0) { px(ctx, cx, ty, s, 1, 6); px(ctx, cx, ty, s, 6, 6); }
    else         { px(ctx, cx, ty, s, 0, 5); px(ctx, cx, ty, s, 7, 5); }
  }

  function drawAlienBot(ctx, cx, ty, s, f) {
    // Squid / octopus shape
    [[1,3],[1,4],[2,2],[2,3],[2,4],[2,5],
     [3,1],[3,2],[3,3],[3,4],[3,5],[3,6],
     [4,0],[4,1],[4,3],[4,4],[4,6],[4,7],
     [5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7]].forEach(([r,c]) => px(ctx, cx, ty, s, c, r));
    if (f === 0) { px(ctx, cx, ty, s, 0, 6); px(ctx, cx, ty, s, 7, 6); }
    else         { px(ctx, cx, ty, s, 1, 6); px(ctx, cx, ty, s, 6, 6); }
  }

  // ── Mystery ship ──────────────────────────────────────────
  function spawnMystery() {
    mystery = {
      x: W + MYSTERY_W,
      y: H * 0.07,
      speed: -(W * 0.16),
      pts: [50, 100, 150, 300][Math.floor(Math.random() * 4)],
      exploding: false,
      explodeTimer: 0,
    };
  }

  function updateMystery(dt) {
    mysteryTimer -= dt;
    if (mysteryTimer <= 0 && !mystery) {
      spawnMystery();
      mysteryTimer = mysteryInterval + Math.random() * 8000;
    }
    if (!mystery) return;
    mystery.x += mystery.speed * dt / 1000;
    if (mystery.x + MYSTERY_W < -10) { mystery = null; return; }
    if (mystery.exploding) {
      mystery.explodeTimer -= dt;
      if (mystery.explodeTimer <= 0) mystery = null;
    }
  }

  function drawMystery() {
    if (!mystery) return;
    if (mystery.exploding) {
      ctx.save();
      ctx.globalAlpha = mystery.explodeTimer / 800;
      ctx.fillStyle   = C_RED;
      ctx.font        = `bold ${Math.floor(MYSTERY_W * 0.65)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.fillText(`+${mystery.pts}`, mystery.x + MYSTERY_W / 2, mystery.y + MYSTERY_H);
      ctx.restore();
      return;
    }
    const { x, y } = mystery;
    const w = MYSTERY_W, h = MYSTERY_H;
    ctx.save();
    ctx.shadowColor = C_RED;
    ctx.shadowBlur  = 16;
    ctx.fillStyle   = C_RED;
    // Body ellipse
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h*0.7, w/2, h*0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dome
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h*0.55, w*0.26, h*0.45, 0, Math.PI, 0);
    ctx.fill();
    // Windows
    ctx.fillStyle   = C_YELLOW;
    ctx.globalAlpha = 0.9;
    [-0.3, 0, 0.3].forEach(off => {
      ctx.beginPath();
      ctx.arc(x + w/2 + off * w * 0.32, y + h*0.66, h*0.1, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.restore();
  }

  // ── Shields ───────────────────────────────────────────────
  function createShields() {
    shields = [];
    const sw    = SHIELD_COLS * SHIELD_BLOCK;
    const sh    = SHIELD_ROWS_N * SHIELD_BLOCK;
    const gapX  = (W - SHIELD_COUNT * sw) / (SHIELD_COUNT + 1);
    const baseY = H - PLAYER_H - 12 - sh - 26;

    for (let si = 0; si < SHIELD_COUNT; si++) {
      const ox = gapX + si * (sw + gapX);
      const blocks = [];
      for (let r = 0; r < SHIELD_ROWS_N; r++) {
        for (let c = 0; c < SHIELD_COLS; c++) {
          // Arch notch: remove bottom-centre blocks
          const inNotch = r >= SHIELD_ROWS_N - 2
                       && c >= Math.floor(SHIELD_COLS * 0.3)
                       && c <  Math.ceil(SHIELD_COLS * 0.7);
          if (inNotch) continue;
          blocks.push({ x: ox + c * SHIELD_BLOCK, y: baseY + r * SHIELD_BLOCK, hp: 4 });
        }
      }
      shields.push(blocks);
    }
  }

  function drawShields() {
    ctx.shadowBlur = 5;
    ctx.shadowColor = C_GREEN;
    shields.forEach(shield => {
      shield.forEach(b => {
        if (b.hp <= 0) return;
        ctx.globalAlpha = b.hp / 4;
        ctx.fillStyle   = C_GREEN;
        ctx.fillRect(b.x, b.y, SHIELD_BLOCK, SHIELD_BLOCK);
      });
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }

  function hitsShield(bx, by, bw, bh) {
    let hit = false;
    shields.forEach(shield => {
      shield.forEach(b => {
        if (b.hp <= 0) return;
        if (overlap(bx, by, bw, bh, b.x, b.y, SHIELD_BLOCK, SHIELD_BLOCK)) {
          b.hp--;
          hit = true;
        }
      });
    });
    return hit;
  }

  // ── Bullets ───────────────────────────────────────────────
  function updateBullets(dt) {
    if (playerBullet) {
      playerBullet.y -= playerBullet.speed * dt / 1000;
      if (playerBullet.y + BULLET_H < 0) playerBullet = null;
    }
    alienBullets = alienBullets.filter(b => {
      b.phase += dt * 0.007;
      if (b.zigzag) b.x += Math.sin(b.phase) * 1.4;
      b.y += b.speed * dt / 1000;
      return b.y < H + BULLET_H;
    });
  }

  function drawBullets() {
    if (playerBullet) {
      ctx.save();
      ctx.shadowColor = C_YELLOW;
      ctx.shadowBlur  = 12;
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = 1 - i * 0.28;
        ctx.fillStyle   = i === 0 ? C_WHITE : C_YELLOW;
        ctx.fillRect(playerBullet.x, playerBullet.y + i * 5, BULLET_W, BULLET_H * 0.55);
      }
      ctx.restore();
    }
    ctx.save();
    alienBullets.forEach(b => {
      ctx.shadowColor = C_RED;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = C_RED;
      ctx.globalAlpha = 1;
      ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(b.x - 1, b.y - 2, BULLET_W + 2, BULLET_H + 4);
    });
    ctx.restore();
  }

  // ── Particles ─────────────────────────────────────────────
  function burst(x, y, color, n = 14, spd = 130) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i / n) + Math.random() * 0.6;
      const sp  = spd * (0.5 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 1,
        decay: 0.013 + Math.random() * 0.022,
        r: 2 + Math.random() * 3,
        color,
      });
    }
  }

  function updateParticles(dt) {
    const s = dt / 1000;
    particles = particles.filter(p => {
      p.x  += p.vx * s;
      p.y  += p.vy * s;
      p.vy += 55 * s;
      p.life -= p.decay * dt / 16;
      return p.life > 0;
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 6;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Screen flash ─────────────────────────────────────────
  function flash(color, dur = 200) { flashTimer = dur; flashColor = color; }

  function drawFlash() {
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = (flashTimer / 200) * 0.17;
      ctx.fillStyle   = flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  // ── Collision helper ──────────────────────────────────────
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ── Collision resolution ──────────────────────────────────
  function checkCollisions() {
    const pb = playerBullet;

    // Player bullet vs aliens
    if (pb) {
      for (const a of aliens) {
        if (!a.alive) continue;
        if (overlap(pb.x, pb.y, pb.w || BULLET_W, pb.h || BULLET_H, a.x, a.y, ALIEN_W, ALIEN_H)) {
          a.alive = false;
          a.explodeTimer = 280;
          playerBullet   = null;
          score += ALIEN_TYPES[a.row].pts * level;
          updateHUD();
          sfxAlienDie();
          burst(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, ALIEN_TYPES[a.row].color, 14);
          flash(ALIEN_TYPES[a.row].color, 110);
          break;
        }
      }
    }

    // Player bullet vs mystery
    if (playerBullet && mystery && !mystery.exploding) {
      const pb2 = playerBullet;
      if (overlap(pb2.x, pb2.y, BULLET_W, BULLET_H, mystery.x, mystery.y, MYSTERY_W, MYSTERY_H)) {
        mystery.exploding    = true;
        mystery.explodeTimer = 800;
        playerBullet         = null;
        score += mystery.pts;
        updateHUD();
        sfxMystery();
        burst(mystery.x + MYSTERY_W / 2, mystery.y + MYSTERY_H / 2, C_RED, 22, 160);
        flash(C_RED, 180);
      }
    }

    // Player bullet vs shields
    if (playerBullet) {
      if (hitsShield(playerBullet.x, playerBullet.y, BULLET_W, BULLET_H)) {
        playerBullet = null;
      }
    }

    // Alien bullets vs player
    if (!player.invincible) {
      for (let i = alienBullets.length - 1; i >= 0; i--) {
        const b = alienBullets[i];
        if (overlap(b.x, b.y, BULLET_W, BULLET_H, player.x, player.y, PLAYER_W, PLAYER_H)) {
          alienBullets.splice(i, 1);
          hitPlayer();
          break;
        }
      }
    }

    // Alien bullets vs shields
    for (let i = alienBullets.length - 1; i >= 0; i--) {
      const b = alienBullets[i];
      if (hitsShield(b.x, b.y, BULLET_W, BULLET_H)) {
        alienBullets.splice(i, 1);
      }
    }

    // Aliens reached player row → instant game over
    if (liveAliens().some(a => a.y + ALIEN_H >= player.y)) {
      endGame();
    }
  }

  function hitPlayer() {
    sfxPlayerDie();
    burst(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2, C_GREEN, 20, 140);
    flash(C_RED, 380);
    lives--;
    updateHUD();
    if (lives <= 0) { endGame(); return; }
    player.invincible  = true;
    player.invTimer    = 2500;
    player.blinkTimer  = 0;
    player.visible     = true;
  }

  // ── HUD ──────────────────────────────────────────────────
  function updateHUD() {
    scoreEl.textContent = score.toString().padStart(5, '0');
    levelEl.textContent = level;
    livesEl.innerHTML   = '&#9679;'.repeat(Math.max(0, lives));
  }

  // ── Ground line ───────────────────────────────────────────
  function drawGround() {
    ctx.save();
    ctx.strokeStyle = C_GREEN;
    ctx.lineWidth   = 2;
    ctx.shadowColor = C_GREEN;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    ctx.moveTo(0, H - 6);
    ctx.lineTo(W, H - 6);
    ctx.stroke();
    ctx.restore();
  }

  // ── CRT scanline overlay ──────────────────────────────────
  function drawScanlines() {
    ctx.save();
    ctx.globalAlpha = 0.038;
    ctx.fillStyle   = '#000';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    ctx.restore();
  }

  // ── Game flow ─────────────────────────────────────────────
  function startGame() {
    score = 0; lives = 3; level = 1;
    marchIdx = 0;
    particles = []; alienBullets = []; playerBullet = null;
    updateHUD();
    player = createPlayer();
    createAliens();
    createShields();
    hideOverlays();
    state = 'playing';
  }

  function nextLevel() {
    level++;
    marchIdx = 0;
    particles = []; alienBullets = []; playerBullet = null;
    player = createPlayer();
    createAliens();
    createShields();
    updateHUD();
  }

  function endGame() {
    state = 'gameover';
    finalScoreEl.textContent = score.toString().padStart(5, '0');
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('si_hs', highScore);
      highScoreMsg.classList.remove('hidden');
    } else {
      highScoreMsg.classList.add('hidden');
    }
    gameOverScreen.classList.remove('hidden');
    sfxPlayerDie();
  }

  function showVictory() {
    state = 'victory';
    nextLevelEl.textContent = level + 1;
    victoryScreen.classList.remove('hidden');
    sfxLevelUp();
    let cnt = 3;
    countdownEl.textContent = cnt;
    const id = setInterval(() => {
      cnt--;
      if (cnt <= 0) {
        clearInterval(id);
        victoryScreen.classList.add('hidden');
        nextLevel();
        state = 'playing';
      } else {
        countdownEl.textContent = cnt;
      }
    }, 1000);
  }

  function hideOverlays() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
  }

  // ── Input ─────────────────────────────────────────────────
  window.addEventListener('keydown', e => {
    keys[e.code] = true;

    // Global screen transitions
    if (e.code === 'Enter' || e.code === 'Space') {
      if (state === 'start')    { startGame();   return; }
      if (state === 'gameover') { doRestart();   return; }
    }

    if (state !== 'playing') return;

    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      tryShoot();
    }
    if (['ArrowLeft','ArrowRight','ArrowUp'].includes(e.code)) e.preventDefault();
  });

  window.addEventListener('keyup', e => { keys[e.code] = false; });

  function tryShoot() {
    if (!playerBullet) {
      playerBullet = {
        x: player.x + PLAYER_W / 2 - BULLET_W / 2,
        y: player.y - BULLET_H,
        speed: 540,
      };
      sfxShoot();
    }
  }

  // Touch support
  let touchX = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touchX = e.touches[0].clientX;
    if (state === 'playing') tryShoot();
    if (state === 'start')    startGame();
    if (state === 'gameover') doRestart();
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (state !== 'playing') return;
    const dx = e.touches[0].clientX - touchX;
    touchX = e.touches[0].clientX;
    player.x = Math.max(0, Math.min(W - PLAYER_W, player.x + dx * 1.5));
  }, { passive: false });

  function doRestart() {
    gameOverScreen.classList.add('hidden');
    startGame();
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', doRestart);

  // ── Main loop ─────────────────────────────────────────────
  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(ts - lastTs, 50);
    lastTs = ts;

    ctx.clearRect(0, 0, W, H);
    updateStars(dt);
    drawStars();

    if (state !== 'playing') {
      drawScanlines();
      return;
    }

    update(dt);
    render();
  }

  function update(dt) {
    // Player horizontal movement
    const spd = player.speed * dt / 1000;
    if ((keys['ArrowLeft']  || keys['KeyA']) && player.x > 0)          player.x = Math.max(0, player.x - spd);
    if ((keys['ArrowRight'] || keys['KeyD']) && player.x + PLAYER_W < W) player.x = Math.min(W - PLAYER_W, player.x + spd);

    // Invincibility blink
    if (player.invincible) {
      player.invTimer   -= dt;
      player.blinkTimer += dt;
      if (player.blinkTimer > 100) { player.blinkTimer = 0; player.visible = !player.visible; }
      if (player.invTimer <= 0) { player.invincible = false; player.visible = true; }
    }

    updateAliens(dt);
    updateMystery(dt);
    updateBullets(dt);
    checkCollisions();
    updateParticles(dt);
    if (flashTimer > 0) flashTimer -= dt;

    if (liveAliens().length === 0) showVictory();
  }

  function render() {
    drawGround();
    drawShields();
    drawMystery();
    aliens.forEach(drawAlien);
    drawPlayer();
    drawBullets();
    drawParticles();
    drawFlash();
    drawScanlines();
  }

  // ── Bootstrap ────────────────────────────────────────────
  resize();
  rafId = requestAnimationFrame(loop);

})();
