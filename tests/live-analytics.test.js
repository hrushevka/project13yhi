import test from 'node:test';
import assert from 'node:assert/strict';
import { liveMetrics, createStats, resetStats, sampleStats } from '../src/utils/stats.js';
import { PRESETS } from '../src/utils/presets.js';
import { evaluateCentralOrbit } from '../src/utils/orbits.js';

test('live analytics measures surface gaps and approach instead of mean historical speed', () => {
    const bodies = [{ m: 1, x: 0, y: 0, vx: 1, vy: 0, r: .1 }, { m: 1, x: 1, y: 0, vx: -1, vy: 0, r: .2 }];
    const live = liveMetrics(bodies, bodies);
    assert.ok(Math.abs(live.pairs[0].gap - .7) < 1e-12);
    assert.equal(live.pairs[0].radialSpeed, -2);
    assert.equal(live.sizeRatio, 1);
    assert.deepEqual(liveMetrics([], []).pairs, []);
});
test('distance chart keeps approximately 30 model seconds at millisecond steps', () => {
    const bodies = [{ m: 1, x: 0, y: 0, vx: 0, vy: 0 }, { m: 1, x: 1, y: 0, vx: 0, vy: 0 }];
    const stats = createStats();
    resetStats(stats, bodies, 1, 0, .001);
    for (let i = 0; i < 40000; i++) sampleStats(stats, bodies, i * .001, -1);
    assert.equal(stats.distanceHistory.length, 300);
    assert.ok(stats.distanceHistory.at(-1).t - stats.distanceHistory[0].t > 29.8);
});
for (const preset of PRESETS.filter(p => p.solution)) {
    test(`${preset.name}: exact trajectory keeps physical radii separate for 500 seconds`, () => {
        const state = preset.bodies.map(b => ({ ...b, r: Math.max(.01, .09 * Math.cbrt(b.m)) }));
        for (let k = 0; k <= 50000; k++) {
            evaluateCentralOrbit(preset, k * .01, state);
            for (let i = 0; i < state.length; i++) for (let j = i + 1; j < state.length; j++) {
                assert.ok(Math.hypot(state[i].x - state[j].x, state[i].y - state[j].y) > state[i].r + state[j].r);
            }
        }
    });
}
