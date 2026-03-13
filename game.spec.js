// @ts-check
const { test, expect } = require('@playwright/test');

// ─── Helpers ────────────────────────────────────────────

/** Load the game and wait for it to be ready */
async function loadGame(page) {
  await page.goto(`file://${__dirname}/index.html`);
  // Wait for the game object to exist
  await page.waitForFunction(() => typeof game !== 'undefined');
}

/** Read a property from the game engine */
function gameState(page) {
  return page.evaluate(() => ({
    state: game.state,
    score: game.score,
    lives: game.lives,
    invaderCount: game.entities.invaders.filter(i => i.alive).length,
    laserCount: game.entities.lasers.length,
    particleCount: game.entities.particles.length,
    level: game.levelManager.current,
    kills: game.levelManager.kills,
    buffer: game.inputManager.buffer,
    turretX: game.turret.x,
    turretTargetX: game.turret.targetX,
  }));
}

/** Spawn a specific invader at a known position */
function spawnInvader(page, text, x, y, speed = 0.4) {
  return page.evaluate(({ text, x, y, speed }) => {
    const inv = createInvader(text, x, speed);
    inv.y = y;
    game.entities.invaders.push(inv);
    return true;
  }, { text, x, y, speed });
}

/** Advance N animation frames */
async function tick(page, frames = 1) {
  for (let i = 0; i < frames; i++) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  }
}

/** Start a game from the title screen (title → hands → levelUp → playing) */
async function startGame(page) {
  await page.keyboard.press('Space'); // title → hands
  await tick(page, 2);
  await page.keyboard.press('Space'); // hands → levelUp
  await tick(page, 2);
  // Wait for levelUp timer to expire (or force it)
  await page.evaluate(() => { game.levelUpTimer = 0; });
  await tick(page, 2);
}


// ═══════════════════════════════════════════════════════════
//  TITLE SCREEN
// ═══════════════════════════════════════════════════════════

test.describe('Title screen', () => {
  test('game starts on the title screen', async ({ page }) => {
    await loadGame(page);
    const s = await gameState(page);
    expect(s.state).toBe('title');
  });

  test('pressing Space goes to hand placement screen', async ({ page }) => {
    await loadGame(page);
    await page.keyboard.press('Space');
    await tick(page, 2);
    const s = await gameState(page);
    expect(s.state).toBe('hands');
  });

  test('pressing Space twice then waiting starts the game', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    const s = await gameState(page);
    expect(s.state).toBe('playing');
    expect(s.score).toBe(0);
    expect(s.lives).toBe(3);
  });

  test('typing letters on title screen does not start the game', async ({ page }) => {
    await loadGame(page);
    await page.keyboard.press('a');
    await tick(page, 2);
    const s = await gameState(page);
    expect(s.state).toBe('title');
  });
});


// ═══════════════════════════════════════════════════════════
//  TYPING AND KILLING INVADERS
// ═══════════════════════════════════════════════════════════

test.describe('Typing to kill invaders', () => {
  test('typing a single-char invader kills it', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    // Clear any auto-spawned invaders and inject our own
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'a', 400, 200);

    await page.keyboard.press('a');
    await tick(page, 2);

    const s = await gameState(page);
    expect(s.invaderCount).toBe(0);
    expect(s.score).toBeGreaterThan(0);
  });

  test('typing a multi-char invader requires the full word', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'cat', 400, 200);

    // Type partial — invader should still be alive
    await page.keyboard.press('c');
    await tick(page, 1);
    let s = await gameState(page);
    expect(s.invaderCount).toBe(1);
    expect(s.buffer).toBe('c');

    await page.keyboard.press('a');
    await tick(page, 1);
    s = await gameState(page);
    expect(s.invaderCount).toBe(1);
    expect(s.buffer).toBe('ca');

    // Complete the word
    await page.keyboard.press('t');
    await tick(page, 2);
    s = await gameState(page);
    expect(s.invaderCount).toBe(0);
    expect(s.score).toBeGreaterThan(0);
    expect(s.buffer).toBe('');
  });

  test('killing an invader creates a laser', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'f', 400, 200);

    await page.keyboard.press('f');
    await tick(page, 1);

    const s = await gameState(page);
    expect(s.laserCount).toBeGreaterThan(0);
  });

  test('killing an invader creates particles', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'j', 400, 200);

    await page.keyboard.press('j');
    await tick(page, 1);

    const s = await gameState(page);
    expect(s.particleCount).toBeGreaterThan(0);
  });

  test('with duplicate texts, the lowest (most dangerous) invader is killed', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    // Spawn two 'a' invaders — one high, one low
    await spawnInvader(page, 'a', 400, 100); // high (safe)
    await spawnInvader(page, 'a', 400, 400); // low (dangerous)

    await page.keyboard.press('a');
    await tick(page, 2);

    // The low one should be dead, high one alive
    const remaining = await page.evaluate(() =>
      game.entities.invaders.filter(i => i.alive).map(i => i.y)
    );
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toBeLessThan(200); // the high one survived
  });
});


// ═══════════════════════════════════════════════════════════
//  MISTYPING
// ═══════════════════════════════════════════════════════════

test.describe('Mistyping', () => {
  test('typing a wrong letter clears the buffer', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'abc', 400, 200);

    await page.keyboard.press('x');
    await tick(page, 1);

    const s = await gameState(page);
    expect(s.buffer).toBe('');
  });

  test('mistyping triggers a red flash', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'abc', 400, 200);

    await page.keyboard.press('x');
    const flash = await page.evaluate(() => game.flashTimer);
    expect(flash).toBeGreaterThan(0);
  });

  test('partial match then wrong letter clears the buffer', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'dog', 400, 200);

    await page.keyboard.press('d');
    await page.keyboard.press('o');
    let s = await gameState(page);
    expect(s.buffer).toBe('do');

    // 'x' doesn't continue any match
    await page.keyboard.press('x');
    s = await gameState(page);
    expect(s.buffer).toBe('');
  });
});


// ═══════════════════════════════════════════════════════════
//  BUFFER CONTROLS (Escape, Backspace)
// ═══════════════════════════════════════════════════════════

test.describe('Buffer controls', () => {
  test('Escape exits to title screen', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    await page.keyboard.press('Escape');
    const s = await gameState(page);
    expect(s.state).toBe('title');
  });

  test('Backspace removes the last character', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'hello', 400, 200);

    await page.keyboard.press('h');
    await page.keyboard.press('e');
    await page.keyboard.press('Backspace');
    const s = await gameState(page);
    expect(s.buffer).toBe('h');
  });

  test('Backspace on empty buffer does nothing', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    await page.keyboard.press('Backspace');
    const s = await gameState(page);
    expect(s.buffer).toBe('');
    expect(s.state).toBe('playing');
  });

  test('Escape from paused state exits to title', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.keyboard.press('Space'); // pause
    await page.keyboard.press('Escape');
    const s = await gameState(page);
    expect(s.state).toBe('title');
  });
});


// ═══════════════════════════════════════════════════════════
//  INVADER REACHING GROUND — LIFE LOSS
// ═══════════════════════════════════════════════════════════

test.describe('Ground collision', () => {
  test('invader reaching the ground costs a life', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    // Place invader just above ground — it will cross on next update
    await spawnInvader(page, 'z', 400, 540, 10);
    await tick(page, 3);

    const s = await gameState(page);
    expect(s.lives).toBe(2);
    expect(s.invaderCount).toBe(0);
  });

  test('losing all lives triggers game over', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.lives = 1; // one life left
    });

    await spawnInvader(page, 'z', 400, 540, 10);
    await tick(page, 3);

    const s = await gameState(page);
    expect(s.state).toBe('gameOver');
  });

  test('game over screen returns to title on Space', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.lives = 1;
    });
    await spawnInvader(page, 'z', 400, 540, 10);
    await tick(page, 3);

    // Now on game over screen
    await page.keyboard.press('Space');
    await tick(page, 2);
    const s = await gameState(page);
    expect(s.state).toBe('title');
  });
});


// ═══════════════════════════════════════════════════════════
//  LEVEL PROGRESSION
// ═══════════════════════════════════════════════════════════

test.describe('Level progression', () => {
  test('killing 12 invaders advances to the next level', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    // Set kills to 11 (one away from advancing)
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.levelManager.kills = 11;
    });

    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');
    await tick(page, 2);

    const s = await gameState(page);
    expect(s.state).toBe('levelUp');
    expect(s.level).toBe(1);
  });

  test('level-up screen transitions back to playing', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.state = 'levelUp';
      game.levelUpTimer = 3; // very short
    });

    await tick(page, 10);
    const s = await gameState(page);
    expect(s.state).toBe('playing');
  });

  test('remaining invaders are cleared when level-up ends', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.state = 'levelUp';
      game.levelUpTimer = 3;
    });
    // There might be auto-spawned invaders
    await spawnInvader(page, 'leftover', 400, 200);

    await tick(page, 10);
    const s = await gameState(page);
    expect(s.invaderCount).toBe(0);
  });

  test('keystrokes are ignored during level-up screen', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.state = 'levelUp';
      game.levelUpTimer = 100;
    });

    await page.keyboard.press('a');
    await page.keyboard.press('b');
    const s = await gameState(page);
    expect(s.buffer).toBe('');
  });
});


// ═══════════════════════════════════════════════════════════
//  TURRET TRACKING
// ═══════════════════════════════════════════════════════════

test.describe('Turret behavior', () => {
  test('turret snaps to target on kill', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    // Spawn invader at known x
    await spawnInvader(page, 'k', 600, 200);

    await page.keyboard.press('k');
    await tick(page, 1);

    const s = await gameState(page);
    // Turret should have snapped near x=600
    expect(s.turretX).toBeGreaterThan(550);
  });

  test('turret tracks toward partially matched invader', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.turret.x = 100;
      game.turret.targetX = 100;
    });

    await spawnInvader(page, 'far', 600, 200);

    await page.keyboard.press('f');
    await tick(page, 1);

    const s = await gameState(page);
    // targetX should be near the invader's center (x=600 + some offset)
    expect(s.turretTargetX).toBeGreaterThan(500);
  });
});


// ═══════════════════════════════════════════════════════════
//  ENTITY CLEANUP (no memory leaks)
// ═══════════════════════════════════════════════════════════

test.describe('Entity cleanup', () => {
  test('dead invaders are removed from the entity list', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');
    await tick(page, 5);

    const total = await page.evaluate(() => game.entities.invaders.length);
    expect(total).toBe(0);
  });

  test('lasers fade and are cleaned up', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');

    // Laser exists right after kill
    await tick(page, 1);
    let count = await page.evaluate(() => game.entities.lasers.length);
    expect(count).toBeGreaterThan(0);

    // After enough frames (~13 at 0.08 decay), laser should be gone
    await tick(page, 20);
    count = await page.evaluate(() => game.entities.lasers.length);
    expect(count).toBe(0);
  });

  test('particles eventually die and are cleaned up', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');
    await tick(page, 2);

    let count = await page.evaluate(() => game.entities.particles.length);
    expect(count).toBeGreaterThan(0);

    // Particles decay over ~50-65 frames
    await tick(page, 80);
    count = await page.evaluate(() => game.entities.particles.length);
    expect(count).toBe(0);
  });
});


// ═══════════════════════════════════════════════════════════
//  SCORING
// ═══════════════════════════════════════════════════════════

test.describe('Scoring', () => {
  test('score increases based on text length and level', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    // Level 0: score = text.length * 10 * (0 + 1) = 10
    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');
    await tick(page, 2);

    const s = await gameState(page);
    expect(s.score).toBe(10); // 1 char * 10 * level 1
  });

  test('longer words score more points', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });

    await spawnInvader(page, 'abcde', 400, 200);
    await page.keyboard.press('a');
    await page.keyboard.press('b');
    await page.keyboard.press('c');
    await page.keyboard.press('d');
    await page.keyboard.press('e');
    await tick(page, 2);

    const s = await gameState(page);
    expect(s.score).toBe(50); // 5 chars * 10 * level 1
  });

  test('higher levels multiply score', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => {
      game.entities.invaders = [];
      game.levelManager.current = 4; // level 5
    });

    await spawnInvader(page, 'a', 400, 200);
    await page.keyboard.press('a');
    await tick(page, 2);

    const s = await gameState(page);
    expect(s.score).toBe(50); // 1 char * 10 * level 5
  });
});


// ═══════════════════════════════════════════════════════════
//  NO CONSOLE ERRORS
// ═══════════════════════════════════════════════════════════

test.describe('Stability', () => {
  test('no console errors during a play session', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);
    await startGame(page);

    // Play for a bit — type some random keys, let invaders spawn
    const keys = 'asdfghjkl';
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press(keys[i % keys.length]);
      await tick(page, 5);
    }

    expect(errors).toHaveLength(0);
  });

  test('no errors when spamming Backspace and rapid typing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await loadGame(page);
    await startGame(page);

    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('a');
      await page.keyboard.press('s');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
      await page.keyboard.press('Backspace');
    }
    await tick(page, 5);

    expect(errors).toHaveLength(0);
  });
});


// ═══════════════════════════════════════════════════════════
//  PAUSE
// ═══════════════════════════════════════════════════════════

test.describe('Pause', () => {
  test('pressing Space pauses the game', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    await page.keyboard.press('Space');
    const s = await gameState(page);
    expect(s.state).toBe('paused');
  });

  test('pressing Space again resumes', async ({ page }) => {
    await loadGame(page);
    await startGame(page);

    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    const s = await gameState(page);
    expect(s.state).toBe('playing');
  });

  test('invaders do not move while paused', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'test', 400, 200);

    await page.keyboard.press('Space');
    const yBefore = await page.evaluate(() => game.entities.invaders[0].y);
    await tick(page, 10);
    const yAfter = await page.evaluate(() => game.entities.invaders[0].y);

    expect(yAfter).toBe(yBefore);
  });

  test('typing is ignored while paused', async ({ page }) => {
    await loadGame(page);
    await startGame(page);
    await page.evaluate(() => { game.entities.invaders = []; });
    await spawnInvader(page, 'test', 400, 200);

    await page.keyboard.press('Space');
    await page.keyboard.press('t');
    const s = await gameState(page);
    expect(s.buffer).toBe('');
  });
});
