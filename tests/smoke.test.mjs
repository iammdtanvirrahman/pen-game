import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(root, "index.html"), "utf8");
const manifestText = readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
const worker = readFileSync(path.join(root, "sw.js"), "utf8");
const manifest = JSON.parse(manifestText);
const inlineScript = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/gi)]
  .map((match) => match[1])
  .find((code) => code.includes("const {Engine,Bodies,Body,Composite,Events}=Matter"));

test("main game script parses without syntax errors", () => {
  assert.ok(inlineScript, "inline app script exists");
  assert.doesNotThrow(() => new Script(inlineScript, { filename: "index.html inline app" }));
});

test("service worker parses without syntax errors", () => {
  assert.doesNotThrow(() => new Script(worker, { filename: "sw.js" }));
});

test("PWA manifest is valid and scoped to the app", () => {
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.src === "./icon.svg"));
  assert.match(html, /rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /serviceWorker\.register\('\.\/sw\.js'\)/);
});

test("online lobby supports explicit reconnect and bounded waits", () => {
  assert.match(inlineScript, /function netReconnect\(\)/);
  assert.match(inlineScript, /data-a='reconnectOnline'/);
  assert.match(inlineScript, /setTimeout\([\s\S]*?20000\)/);
});

test("guest actions and host snapshots are validated", () => {
  assert.match(inlineScript, /Number\.isSafeInteger\(\+s\.seq\)/);
  assert.match(inlineScript, /Math\.abs\(\+message\.dirX\)<=1\.01/);
  assert.match(inlineScript, /s\.game\.pl\.length!==2/);
});

test("online matches advertise the host-selected rules", () => {
  assert.match(inlineScript, /clock:NET\.clock,clutter:NET\.clutter/);
  assert.match(inlineScript, /Room rules:/);
  assert.match(inlineScript, /PENS\.slice\(0,BUILTIN\)/);
});

test("offline shell fallback exists but does not pretend online is offline", () => {
  assert.match(worker, /caches\.match\(key\)/);
  assert.match(worker, /peerjs/i);
  assert.match(worker, /Online multiplayer still requires the internet/);
});
