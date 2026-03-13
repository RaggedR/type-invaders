# Type Invaders — Design Brief

## What Is It

A typing tutor game where letters and words fall from the sky like Space Invaders. You type them to destroy them before they hit the ground. 21 levels progressing from home row keys through full keyboard, words, numbers, and symbols. Single HTML file, runs in any browser.

## What's Built

The game is fully functional. All mechanics work, 37 automated tests pass. The code is cleanly separated — all visual code lives in one `Renderer` component (~450 lines) that you can edit without touching game logic.

**Play it**: open `index.html` in a browser.

## What Needs Design Help

### 1. Hand Placement Screen
**Current state**: An embedded PNG of hands on a color-coded keyboard, shown before the game starts. It looks like a stock image dropped onto a black background.

**What it needs**: A cohesive tutorial screen that teaches finger placement while fitting the game's retro aesthetic. Could be pixel art, stylized illustration, animated diagram — whatever works. The key constraint: it needs to show which finger presses which key using color coding.

**Finger-to-color mapping** (currently used on the keyboard diagram):
- Orange = left pinky (A, Q, Z, 1, `)
- Red = ring fingers (S, W, X, 2 / L, O, ., 9)
- Green = middle fingers (D, E, C, 3 / K, I, ,, 8)
- Blue = index fingers (F, G, R, T, V, B, 4, 5 / J, H, U, Y, N, M, 6, 7)
- Yellow = right pinky (;, ', P, [, ], \, /, 0, -, =)
- Purple = thumbs (spacebar)

### 2. Level-Up Screen
**Current state**: Shows the level name, a scaled-down keyboard diagram with active keys colored and new keys pulsing white, and a speed bar. Functional but not visually exciting.

**What it needs**: Something that makes level transitions feel like an achievement. The keyboard diagram showing new keys is educationally important — but the presentation could be more engaging.

### 3. Title Screen
**Current state**: Green CRT text with a 3-column level select grid. Clean but generic.

**What it needs**: A title screen that makes you want to play. The level select grid works well mechanically but could look better.

### 4. In-Game Polish
**Current state**: Green invaders fall down, turret at bottom shoots laser beams, particles explode on kill. CRT scanlines and vignette overlay. It works but feels flat.

**Ideas that might help**:
- Better explosion/kill effects (screen shake? more particles?)
- Visual feedback when you're on a streak
- Invader styling (they're just text right now — could they look more alien?)
- Color variety (everything is green)
- Sound design (there is no audio at all currently)

### 5. Overall Aesthetic
The game uses "Press Start 2P" pixel font and a CRT monitor theme (scanlines, vignette, green phosphor glow). This could be leaned into harder or replaced with something else entirely. The retro direction feels right for a typing game but the execution is amateur.

## Technical Constraints

- **Single HTML file** — everything must be in `index.html` (inline CSS, inline JS, embedded images as base64 data URIs)
- **Canvas rendering** — all visuals are drawn to a 800x600 canvas using the 2D API. No HTML elements for game content
- **No build step** — no bundler, no framework, no npm dependencies for the game itself (Playwright is dev-only for testing)
- **Images**: can be embedded as base64 data URIs (current hand placement PNG is ~200KB encoded). SVGs can also be embedded
- **Font**: Google Fonts "Press Start 2P" loaded via stylesheet link

## Where to Edit

All visual code is in the `createRenderer(ctx)` function, roughly lines 445–900 of `index.html`:

- `_drawKeyboard()` — the color-coded keyboard diagram (used on level-up screen)
- `_drawHands()` — hand placement screen
- `_drawTitle()` — title screen with level select
- `_drawLevelUp()` — level transition screen
- `_drawGameOver()` — game over screen
- `drawHUD()` — in-game score, lives, level, input buffer
- `drawEntity()` — how invaders, lasers, and particles look
- `drawGround()` — the ground line
- `drawStars()` — background star field
- `drawTurret()` — the player's cannon at the bottom

The CSS at the top of the file controls the CRT effects (scanlines, vignette).

## Running Tests After Changes

```bash
npm install        # first time only
npm test           # 37 e2e tests — make sure nothing breaks
```

Tests check behavior (can you kill invaders, do levels advance, does scoring work) not visual appearance, so cosmetic changes won't break them. But don't rename the `game` global variable or the `create*` factory functions — tests depend on those.
