import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS } from '../src/utils/presets.js';
import { preparePeriodicOrbit, evaluatePeriodicOrbit } from '../src/utils/periodic-orbits.js';
import { totalEnergy, stepSimulation } from '../src/utils/physics.js';
import previews from '../src/utils/orbit-previews.json' with { type: 'json' };

for (const preset of PRESETS.filter((p) => p.period)) {
    test(`${preset.name}: period closes, playback is repeatable and input data stays intact`, () => {
        const initial = structuredClone(preset.bodies);
        const orbit = preparePeriodicOrbit(preset);
        assert.ok(orbit.closureError < 0.003);
        const energy = totalEnergy(initial, 1, 0);
        const state = structuredClone(initial);
        for (let i = 0; i < 100; i++) {
            evaluatePeriodicOrbit(orbit, i * preset.period / 100, state);
            assert.ok(Math.abs(totalEnergy(state, 1, 0) - energy) < 0.0002, `${preset.name}: interpolation energy error`);
        }
        evaluatePeriodicOrbit(orbit, .37 * preset.period, state);
        const repeated = structuredClone(initial);
        evaluatePeriodicOrbit(orbit, 1000.37 * preset.period, repeated);
        repeated.forEach((b, i) => ['x', 'y', 'vx', 'vy'].forEach((key) => assert.ok(Math.abs(b[key] - state[i][key]) < 1e-8)));
        assert.deepEqual(preset.bodies, initial);
        // Switching to free numerical motion must continue from the displayed state.
        const before = structuredClone(state);
        stepSimulation(state, 1, 0, 1e-6, { collisions: false });
        assert.ok(Math.hypot(state[0].x - before[0].x, state[0].y - before[0].y) < 0.001);
    });
}

test('every preset has a preview and catalog names are unique', () => {
    assert.equal(new Set(PRESETS.map((p) => p.name)).size, PRESETS.length);
    for (const p of PRESETS) {
        assert.equal(previews[p.name].length, 3);
        assert.ok(previews[p.name].every((d) => d.startsWith('M') && !d.includes('NaN')));
    }
});
