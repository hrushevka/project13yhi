import test from 'node:test';
import assert from 'node:assert/strict';
import { stepSimulation, PLANET_COLLISION_OPTIONS } from '../src/utils/physics.js';
import { PRESETS } from '../src/utils/presets.js';

test('high-speed planet impacts merge once per pair without debris or repeated events', () => {
    const state = [-1, 0, 1].map((x, i) => ({ id: i, m: 1, r: .09, x, y: 0, vx: -x * 10, vy: 0 }));
    const events = [];
    for (let i = 0; i < 2000; i++) events.push(...stepSimulation(state, 0, 0, .001, { collisions: true, ...PLANET_COLLISION_OPTIONS }).events);
    assert.equal(events.length, 2);
    assert(events.every(e => e.kind === 'merge'));
    assert.equal(state.length, 1);
    assert.equal(state[0].m, 3);
    assert(Math.abs(state[0].vx) < 1e-10);
    assert(!state[0].isDebris);
});

test('stable equal-mass Lagrange orbit runs with collisions enabled without false contacts', () => {
    const preset = PRESETS.find(p => p.solution?.eccentricity === 0 && p.bodies.every(b => b.m === 1) && p.name.includes('Лагранж'));
    const state = structuredClone(preset.bodies).map(b => ({ ...b, r: .09 }));
    for (let i = 0; i < 4000; i++) {
        const result = stepSimulation(state, preset.g, 0, .001, { collisions: true, ...PLANET_COLLISION_OPTIONS });
        assert.equal(result.events.length, 0);
    }
    assert.equal(state.length, 3);
});
