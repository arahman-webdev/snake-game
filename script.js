(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const highEl = document.getElementById('highscore');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-sub');

  const GRID = 20;
  const CELL = canvas.width / GRID;
  const BASE_SPEED = 140; // ms per tick
  const MIN_SPEED = 55;
  const FOODS_PER_LEVEL = 5;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  let snake, dir, dirQueue, food, bonus, score, level, eaten;
  let state = 'idle'; // idle | running | paused | over
  let lastTick = 0;
  let soundOn = true;
  let highScore = 0;

  try {
    highScore = parseInt(localStorage.getItem('retroSnakeHigh'), 10) || 0;
  } catch (e) { /* storage unavailable */ }
  highEl.textContent = highScore;

  // ---------- Sound (tiny 8-bit beeps via WebAudio) ----------
  let audioCtx = null;
  function beep(freq, duration = 0.08, type = 'square', volume = 0.08) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* audio unavailable */ }
  }

  const sfx = {
    eat: () => beep(660, 0.07),
    bonus: () => { beep(880, 0.06); setTimeout(() => beep(1320, 0.08), 60); },
    level: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.08), i * 80)),
    die: () => [400, 300, 200, 120].forEach((f, i) => setTimeout(() => beep(f, 0.15, 'sawtooth'), i * 120)),
    start: () => [262, 392, 523].forEach((f, i) => setTimeout(() => beep(f, 0.07), i * 70)),
  };

  // ---------- Game setup ----------
  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    dir = DIRS.right;
    dirQueue = [];
    score = 0;
    level = 1;
    eaten = 0;
    bonus = null;
    food = randomFreeCell();
    updateHud();
  }

  function randomFreeCell() {
    let cell;
    do {
      cell = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
    } while (
      snake.some(s => s.x === cell.x && s.y === cell.y) ||
      (food && food.x === cell.x && food.y === cell.y) ||
      (bonus && bonus.x === cell.x && bonus.y === cell.y)
    );
    return cell;
  }

  function speed() {
    return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * 12);
  }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    highEl.textContent = highScore;
  }

  // ---------- State transitions ----------
  function showOverlay(title, sub, blink = false) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayTitle.classList.toggle('blink', blink);
    overlay.classList.remove('hidden');
  }

  function start() {
    reset();
    state = 'running';
    overlay.classList.add('hidden');
    lastTick = performance.now();
    sfx.start();
  }

  function togglePause() {
    if (state === 'running') {
      state = 'paused';
      showOverlay('PAUSED', 'PRESS SPACE TO RESUME', true);
    } else if (state === 'paused') {
      state = 'running';
      overlay.classList.add('hidden');
      lastTick = performance.now();
    }
  }

  function gameOver() {
    state = 'over';
    sfx.die();
    let sub = `SCORE ${score}\n\nPRESS SPACE TO PLAY AGAIN`;
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('retroSnakeHigh', highScore); } catch (e) { /* ignore */ }
      sub = `NEW HIGH SCORE! ${score}\n\nPRESS SPACE TO PLAY AGAIN`;
    }
    updateHud();
    showOverlay('GAME OVER', sub);
    overlaySub.style.whiteSpace = 'pre-line';
  }

  // ---------- Input ----------
  function queueDirection(name) {
    const next = DIRS[name];
    if (!next) return;
    const last = dirQueue.length ? dirQueue[dirQueue.length - 1] : dir;
    // Ignore reversals and duplicates
    if (next.x === -last.x && next.y === -last.y) return;
    if (next.x === last.x && next.y === last.y) return;
    if (dirQueue.length < 3) dirQueue.push(next);
  }

  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  document.addEventListener('keydown', e => {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      if (state === 'running') queueDirection(KEYMAP[e.code]);
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (state === 'idle' || state === 'over') start();
      else togglePause();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      togglePause();
    } else if (e.code === 'KeyM') {
      soundOn = !soundOn;
    }
  });

  overlay.addEventListener('click', () => {
    if (state === 'idle' || state === 'over') start();
    else if (state === 'paused') togglePause();
  });

  document.querySelectorAll('.dpad button').forEach(btn => {
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (state === 'idle' || state === 'over') start();
      else if (state === 'running') queueDirection(btn.dataset.dir);
    });
  });

  // Swipe controls on the canvas
  let touchStart = null;
  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  canvas.addEventListener('touchend', e => {
    if (!touchStart || state !== 'running') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    queueDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    touchStart = null;
  }, { passive: true });

  // ---------- Update ----------
  function tick() {
    if (dirQueue.length) dir = dirQueue.shift();

    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID) {
      return gameOver();
    }

    const willEat = head.x === food.x && head.y === food.y;
    // Self collision (tail moves away unless we're growing)
    const body = willEat ? snake : snake.slice(0, -1);
    if (body.some(s => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    if (willEat) {
      score += 10 * level;
      eaten++;
      sfx.eat();
      food = randomFreeCell();
      if (eaten % FOODS_PER_LEVEL === 0) {
        level++;
        sfx.level();
      }
      // Occasionally spawn a timed bonus
      if (!bonus && Math.random() < 0.25) {
        bonus = { ...randomFreeCell(), ttl: 40 };
      }
    } else {
      snake.pop();
    }

    if (bonus) {
      if (head.x === bonus.x && head.y === bonus.y) {
        score += 50 * level;
        sfx.bonus();
        bonus = null;
      } else if (--bonus.ttl <= 0) {
        bonus = null;
      }
    }

    updateHud();
  }

  // ---------- Render ----------
  function drawGrid() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(57, 255, 20, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL + 0.5, 0);
      ctx.lineTo(i * CELL + 0.5, canvas.height);
      ctx.moveTo(0, i * CELL + 0.5);
      ctx.lineTo(canvas.width, i * CELL + 0.5);
      ctx.stroke();
    }
  }

  function drawCell(x, y, color, glow, inset = 1) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    ctx.fillRect(x * CELL + inset, y * CELL + inset, CELL - inset * 2, CELL - inset * 2);
    ctx.shadowBlur = 0;
  }

  function drawSnake() {
    snake.forEach((seg, i) => {
      const t = i / snake.length;
      const g = Math.round(255 - t * 120);
      drawCell(seg.x, seg.y, i === 0 ? '#b6ff9e' : `rgb(57, ${g}, 20)`, '#39ff14');
    });

    // Eyes
    const h = snake[0];
    ctx.fillStyle = '#000';
    const cx = h.x * CELL + CELL / 2;
    const cy = h.y * CELL + CELL / 2;
    const off = CELL / 4;
    const px = dir.y !== 0 ? off : 0;
    const py = dir.x !== 0 ? off : 0;
    const fx = dir.x * off * 0.6;
    const fy = dir.y * off * 0.6;
    ctx.fillRect(cx - px + fx - 2, cy - py + fy - 2, 4, 4);
    ctx.fillRect(cx + px + fx - 2, cy + py + fy - 2, 4, 4);
  }

  function drawFood(now) {
    const pulse = 1 + Math.sin(now / 150) * 1.5;
    drawCell(food.x, food.y, '#ff2e88', '#ff2e88', 2 + pulse);

    if (bonus) {
      // Blink faster as it's about to expire
      const visible = bonus.ttl > 12 || Math.floor(now / 100) % 2 === 0;
      if (visible) drawCell(bonus.x, bonus.y, '#ffe600', '#ffe600', 1);
    }
  }

  function draw(now) {
    drawGrid();
    drawFood(now);
    drawSnake();
  }

  // ---------- Loop ----------
  function loop(now) {
    if (state === 'running' && now - lastTick >= speed()) {
      lastTick = now;
      tick();
    }
    draw(now);
    requestAnimationFrame(loop);
  }

  reset();
  requestAnimationFrame(loop);
})();
