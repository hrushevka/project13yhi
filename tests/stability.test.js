import test from 'node:test';
import assert from 'node:assert/strict';
import { forecastStability } from '../src/utils/stability.js';
import { PRESETS } from '../src/utils/presets.js';

test('stability forecast reacts to gravity and does not mutate the live configuration', () => {
    const bodies = structuredClone(PRESETS[0].bodies).map(b => ({ ...b, r: .09 }));
    const before = structuredClone(bodies);
    const config = { bodies, gravity: 1, softening: 0, collisions: true };
    assert.equal(forecastStability(config).kind, 'stable');
    assert.equal(forecastStability({ ...config, gravity: 0 }).kind, 'unstable');
    assert.deepEqual(bodies, before);
});
test('stability forecast detects contacts and insufficient body counts', () => {
    const bodies = [-1, 1].map(x => ({ m: 1, r: .09, x, y: 0, vx: -x, vy: 0 }));
    assert.match(forecastStability({ bodies, gravity: 0, softening: 0, collisions: true }).text, /столкновение/);
    assert.equal(forecastStability({ bodies: [] }).kind, 'unknown');
});
