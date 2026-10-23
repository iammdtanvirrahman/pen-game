# Pen Game (কলম খেলবি?) — Version 5.0

A mobile-first browser recreation of the Bangladeshi school-bench pen game. Flick a pen with a slingshot drag, knock rival pens off the bench, and survive.

## What is included

- Local pass-and-play matches for 2–6 players.
- Practice against AI and a quick-match mode.
- Pen selection, settings, local statistics, sound, vibration and fullscreen controls.
- Two-player online rooms using PeerJS/WebRTC, room codes, shareable invite links and QR codes.
- Host-selected series length, shot clock and bench-obstacle rules.
- Explicit reconnect attempt when a guest connection drops, plus connection timeouts and basic incoming-message/snapshot validation.
- PWA manifest, SVG app icon and a service worker that caches the app shell and attempts to cache the pinned game libraries.
- A Node.js smoke-test suite and GitHub Actions workflow.

## Run locally

Open `index.html` in a modern browser. The project has no build step. Matter.js, PeerJS and QRCode.js are loaded from pinned CDN URLs; the first online launch therefore needs internet access.

For install prompts, a service worker, and reliable online-room links, host the branch on HTTPS (for example, GitHub Pages). If using the PWA offline, open the hosted app online at least once and then reopen/reload it while online so the service worker can install and cache its shell and available libraries.

## Controls

Touch or press your pen, drag backwards to aim, then release to flick it forward. Drag distance controls power. `Esc` pauses when the browser delivers that key.

## Online play

1. Both players open the same HTTPS-hosted app on separate devices.
2. The host chooses the online options and taps **Create room**.
3. Share the invite link, QR code or room code with the other player.
4. The guest chooses a built-in pen and joins. The host starts the match.

The host's match rules apply to both players. Online play exposes the six built-in pens so both devices use matching artwork; custom uploaded pen skins remain local-only. If a guest disconnects, reconnect can work only while the original host room is still alive. When the host closes the page or loses the peer session, the host must create a new room.

## Validation

Run the static test suite with Node.js 20 or newer:

```sh
node --test tests/smoke.test.mjs
```

GitHub Actions runs this suite for pushes and pull requests targeting the `5.0` branch. These are syntax and static smoke tests; they are not a substitute for exercising two real Android devices across different networks.

## Known limitations

- Online rooms depend on the public PeerJS signalling service and available WebRTC connectivity. A custom TURN relay, managed signalling backend, durable rooms, accounts, friends, matchmaking, rankings and tournaments are not included.
- The host is authoritative for ordinary gameplay, but this is still a peer-to-peer game, not a cheat-proof server-authoritative service.
- A reconnect does not restore a disconnected match's physics state; the host can invite the guest back and start a new match.
- Offline mode applies to the cached local app and local gameplay. Online rooms, sharing and signalling still require internet.
- Real-device playtests, browser compatibility checks and performance checks must still be performed before calling this production-ready.

## Deployment

In GitHub, open **Settings → Pages**, choose **Deploy from a branch**, select `5.0` and the root folder, and save. Keep the `index.html`, `manifest.webmanifest`, `icon.svg` and `sw.js` files at the repository root so the relative PWA paths remain in scope.
