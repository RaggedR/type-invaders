# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Type Invaders — a typing tutor game built as a **single HTML file** (`index.html`, ~1300 lines). Canvas-only rendering with a warm pixel-art aesthetic (WIP — not finalized). No build step, no bundler, no framework.

## Commands

```bash
npm test                                    # Run all 37 Playwright e2e tests
npx playwright test game.spec.js --grep "title"  # Run tests matching a pattern
open index.html                             # Launch in browser (macOS)
```

## Architecture

Everything lives in `index.html` inside a single `<script>` tag. Functional style — five components as factory functions returning plain objects, no classes.

### Components (in source order)

1. **Entity System** (~line 98) — `createInvader()`, `createLaser()`, `createParticle()`, `createTurret()`. Each entity has `update()` and `render(ctx)`. Invaders have `text`, `matched`, `speed`. Lasers/particles have `life` that fades to 0.

2. **LevelManager** (~line 279) — 21 level definitions with `keys`, `speed`, `spawnRate`, `words` flag. Owns the difficulty curve. `generateText()` produces random combos or picks from the word list. `recordKill()` returns true when the level advances (12 kills per level).

3. **InputManager** (~line 364) — Handles keystrokes and returns **action descriptors** (`{type: 'kill'|'partial'|'miss'|'clear'|'backspace'|'ignore'}`). Never mutates game state directly. Matching logic: buffer is checked against all alive invaders, full match picks the lowest (most dangerous) one.

4. **Renderer** (~line 445) — Owns the canvas context. `_drawKeyboard(topY, activeKeys, scale, newKeys)` is reusable — draws the color-coded keyboard with optional active/new key highlighting. `_drawHands()` shows an embedded PNG (base64 data URI, ~200KB). Screens: title, hands, levelUp, gameOver.

5. **Engine** (~line 966) — Game loop and state machine: `title → hands → levelUp → playing ↔ paused → gameOver`. `_onKey()` dispatches input. `update()` handles spawning, entity updates, ground collision, cleanup. `handleAction()` processes InputManager results (kill → laser + explosion, miss → flash).

### Key Design Decisions

- **Action descriptor pattern**: InputManager returns data, Engine acts on it. This separation means input logic is testable without canvas.
- **Canvas-only rendering**: No HTML overlays. Avoids coordinate misalignment between CSS and canvas.
- **Font metrics**: Press Start 2P has advance width ratio of exactly 1.0 (not 0.6 like Courier). `CHAR_RATIO = 1.0` constant used for all text width calculations.
- **Font-load gating**: Game bootstrap is wrapped in `Promise.race([fontReady, timeout])` to avoid rendering with fallback font.
- **Embedded hand placement image**: `HANDS_IMG` is a base64 PNG data URI loaded at startup, drawn onto the canvas. Keeps the single-file constraint.

### State Machine

```
title (level select grid, arrow keys navigate)
  → Space → hands (reference image)
  → Space → levelUp (keyboard with new keys pulsing)
  → timer → playing
  → Escape → title
  → P → paused → P → playing
  → kill 12 → levelUp → playing
  → lives=0 → gameOver → Space → title
```

### Controls During Play

- **Escape**: Exit to title screen
- **P**: Pause/resume
- **N**: Skip to next level
- **Backspace**: Delete last typed character
- Typing matches against falling invaders' text; full match kills the lowest matching invader

## Tests

`game.spec.js` — 37 Playwright e2e tests. Key helpers:

- `startGame(page)` — presses Space twice, forces levelUp timer to 0 (title → hands → levelUp → playing)
- `spawnInvader(page, text, x, y, speed)` — injects a known invader via `page.evaluate()`
- `gameState(page)` — reads state, score, lives, buffer, turret position etc.
- `tick(page, frames)` — advances N animation frames

Tests use `page.evaluate()` to inject known state and read results. The `game` variable is globally accessible for testing.

## Speed Calibration

Fall distance is 555px at 60fps. `speed` is px/frame. Speed 1.0 ≈ 9.3s fall time. Speeds are calibrated against WPM benchmarks: level 1 targets beginners (~25 WPM), expert targets 50-60 WPM, master targets 70+ WPM. When introducing unfamiliar keys (numbers, symbols), speed drops back to allow muscle memory development.
