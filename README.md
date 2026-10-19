# কলম খেলবি? — Pen Battle

A small, Bengali-first browser game inspired by the pen-flick game played on school benches in Bangladesh.

## Play locally

Open `index.html` in a modern browser. No build step, package installation, or external dependency is required.

## How to play

1. Click **খেলা শুরু করো**.
2. Press or touch your red pen on the wooden bench.
3. Drag backwards from the direction you want the pen to move, then release to flick it.
4. Knock rival pens off the bench while keeping yours in bounds. The last pen remaining wins.

Keyboard is not required; mouse, touch, and pen input are handled through Pointer Events.

## Publish with GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch `main`, folder `/(root)`, then save.
4. Wait for the Pages URL to appear in that settings section.

## Features

- Bengali interface and responsive layout
- Canvas game arena with wood-grain styling
- Drag-to-flick controls for mouse and touchscreen
- Four pens: player plus three AI opponents
- Pen collision, friction, knock-outs, win/lose state, rematch
- No build tools or external libraries

This is a local single-player prototype; online multiplayer is not included yet.

Repository: https://github.com/iammdtanvirrahman/pen-game
