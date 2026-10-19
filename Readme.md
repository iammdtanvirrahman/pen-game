# Pen Game (কলম খেলবি?)

A browser recreation of the Bangladeshi school-bench pen game. Take turns flicking your pen with a slingshot drag, knock rival pens off the bench, and keep yours on it. The last pen on the bench wins.

## Run

Open `index.html`. No build step. The page loads Matter.js 0.19.0 from cdnjs, so the first load needs internet; after that it plays offline. To go fully offline, save `matter.min.js` next to `index.html` and point the script tag at it.

## Controls

Press (or touch) your pen and drag backwards. Release to flick the pen the opposite way. A longer drag is a harder flick. `Esc` pauses.

## Rules

Core rules: one pen per player, players take turns, only the active pen can be flicked, the last pen on the bench wins. A pen is out when its centre crosses the bench edge; touching the edge is safe, and the turn is judged only after everything has stopped moving.

Optional house rules (Custom match): AI level, flick strength, aim guide.

## Modes

Quick match (you plus 3 AI), and Custom match: 2 to 6 players, each Human or AI, with a pen design, AI level, flick strength, aim guide and volume. All-human is local pass-and-play. Online multiplayer is not implemented.

## Files

- `rules.js`: pure turn and elimination rules, no DOM or physics
- `game.js`: Matter.js physics, input, AI, rendering, audio, settings and stats
- `index.html`, `style.css`: markup and styles

## Tests

`node --test` runs `rules.test.js` (turn order, simultaneous eliminations, draws, ranks). Physics, input and layout have no automated tests and need a manual pass in a browser.

## Deploy

GitHub Pages: Settings, Pages, Deploy from a branch, `main`, `/(root)`.

## Limitations

- Pens are rounded rectangles in Matter.js; results are not identical across browsers.
- Stats (matches, wins, knock-outs, average rank, favorite pen, best streak) follow player 1 when that player is human.
- Start positions are random, not chosen. Pen designs are assigned in Custom match.
