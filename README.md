# Space Invaders

A classic Space Invaders arcade game built with vanilla HTML, CSS, and JavaScript — no dependencies, no build step, just open and play.

## Features

- 11×5 alien grid with three alien types worth different point values
- Mystery ship that flies across the top for bonus points
- Destructible shields that erode when hit by bullets
- Multiple waves with increasing difficulty (aliens move and shoot faster each level)
- Web Audio API sound effects (shooting, explosions, alien march, level-up fanfare)
- Animated starfield background with parallax scrolling stars
- High score saved to `localStorage`
- Fully responsive canvas that adapts to any screen size
- Start, Game Over, and Wave Clear screens

## Scoring

| Alien type | Points |
|------------|--------|
| Top row (purple) | 30 |
| Middle rows (cyan) | 20 |
| Bottom rows (green) | 10 |
| Mystery ship | varies |

## Controls

| Key | Action |
|-----|--------|
| `←` / `→` | Move left / right |
| `Space` | Fire |
| `Enter` | Start / Restart |

## How to run

No installation or build step is required.

```bash
# Clone the repository
git clone <repo-url>
cd space

# Open directly in your browser
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or use any static file server:

```bash
npx serve .
# then open http://localhost:3000
```

## Project structure

```
space/
├── index.html   # Game markup and overlay screens
├── style.css    # Retro neon styling and layout
└── game.js      # All game logic (canvas rendering, physics, audio)
```

## Tech stack

- **HTML5 Canvas** — rendering
- **Web Audio API** — procedural sound effects
- **CSS custom properties + animations** — neon glow UI
- **localStorage** — high score persistence
