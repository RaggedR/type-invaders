# Type Invaders

A typing game where alien words fall from the sky and you destroy them by typing. Built as a single HTML file with canvas rendering and a retro CRT aesthetic.

## How to Play

1. Open `index.html` in a browser
2. Press **Space** to start
3. Type the falling letters/words to destroy them before they reach the ground
4. **P** to pause, **N** to skip a level, **Escape** to clear your input buffer

## 21 Levels

Home row -> full keyboard -> words -> numbers -> punctuation -> brackets -> symbols -> expert mode.

## Tests

```
npm install
npm test
```

37 Playwright e2e tests covering gameplay, input handling, scoring, entity cleanup, and stability.

## Known Issues

- The hand placement screen is ugly. We know.
- The overall look and feel needs more work — current palette/aesthetic is a placeholder, not the final vision.
