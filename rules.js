/* Pure turn/elimination rules. No DOM, no physics, so it can be unit-tested and reused by a future online mode. */
(function (root, make) { const R = make(); if (typeof module !== 'undefined') module.exports = R; else root.Rules = R; })(this, () => ({
  // Index of the next living player after `cur`, or -1 if nobody is alive.
  nextTurn(players, cur) {
    for (let i = 1; i <= players.length; i++) { const k = (cur + i) % players.length; if (players[k].alive) return k; }
    return -1;
  },
  // Eliminate `outIds` together. Everyone out in the same resolution shares one rank.
  resolve(players, outIds) {
    const before = players.filter(p => p.alive).length;
    outIds.forEach(i => { players[i].alive = false; });
    const left = players.filter(p => p.alive);
    return { over: left.length <= 1, winner: left.length === 1 ? players.indexOf(left[0]) : -1, draw: before > 0 && left.length === 0 };
  },
  // Finishing rank for pens that go out together (1 = best).
  rank(aliveBefore, outCount) { return aliveBefore - outCount + 1; }
}));
