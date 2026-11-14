import test from 'node:test';
import assert from 'node:assert/strict';
import { stepSimulation, stepBodiesInPlace, stepBodiesVelocityVerlet, totalEnergy, fragmentPair, detectAndResolve, findEarliestContact, FALLBACK_PRESET, toSimBodies } from '../src/utils/physics.js';
import { PRESETS, detectPreset } from '../src/utils/presets.js';
import { evaluateCentralOrbit, centralOrbitPeriod } from '../src/utils/orbits.js';
import { createStats, resetStats } from '../src/utils/stats.js';

const clone = (bodies) => bodies.map((b) => ({ ...b }));
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b} (tolerance ${tolerance})`);
const totals = (bodies) => bodies.reduce((s, b) => [s[0] + b.m, s[1] + b.m * b.vx, s[2] + b.m * b.vy], [0, 0, 0]);
const distances = (bodies) => bodies.flatMap((a, i) => bodies.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
const body = (x, vx, m = 1, r = 0.1) => ({ x, y: 0, vx, vy: 0, m, r });

test('fallback uses the same figure-eight data as the preset buttons', () => {
    assert.deepEqual(toSimBodies(FALLBACK_PRESET.bodies), PRESETS[0].bodies);
    for (const p of PRESETS) assert.equal(detectPreset(p.bodies), p.name);
});

for (const p of PRESETS.filter((p) => !p.period)) {
    test(`${p.name}: finite orbit, energy and momentum conservation`, () => {
        const state = clone(p.bodies).map((b) => ({ ...b, r: 0.05 * Math.cbrt(b.m) }));
        const initial = totalEnergy(state, p.g, p.softening);
        const initialDistances = distances(state);
        const duration = p === PRESETS[0] ? 6.3259 : centralOrbitPeriod(p);
        const count = Math.ceil(duration / p.dt);
        const h = duration / count;
        for (let k = 0; k < count; k++) {
            assert.equal(stepSimulation(state, p.g, p.softening, h, { collisions: false }).events.length, 0);
        }
        near(totalEnergy(state, p.g, p.softening), initial, 1e-5);
        near(totals(state)[1], 0, 1e-10);
        near(totals(state)[2], 0, 1e-10);
        if (p !== PRESETS[0]) distances(state).forEach((d, i) => near(d, initialDistances[i], 0.002));
        else state.forEach((b, i) => {
            near(b.x, p.bodies[i].x, 0.0002);
            near(b.y, p.bodies[i].y, 0.0002);
        });
    });
}

for (const integrator of [stepBodiesInPlace, stepBodiesVelocityVerlet]) {
    test(`${integrator.name}: force matches the reported softened potential`, () => {
        const state = [body(-0.0001, 0, 1, 0), body(0.0001, 0, 1, 0)];
        const dt = 1e-12;
        integrator(state, 1, 0, dt);
        near(state[0].vx / dt, 1 / (0.0002 ** 2), 0.1);
    });
}

test('continuous collision detection catches fast bodies and advances uninvolved bodies once', () => {
    const state = [body(-1, 1000), body(1, -1000), { ...body(10, 3), y: 10 }];
    const result = stepSimulation(state, 0, 0, 0.01);
    assert.equal(result.events.length, 1);
    assert.equal(state.length, 2);
    near(result.events[0].time, 0.0009);
    near(state[0].x, 0);
    near(state[1].x, 10.03);
    near(totals(state)[0], 3);
});

test('multiple contacts use the remaining interval and conserve momentum', () => {
    const state = [body(-1, 1), body(0, 0), body(1, -1)];
    const result = detectAndResolve(state, 2);
    assert.equal(result.events.length, 2);
    assert.equal(state.length, 1);
    near(state[0].x, 0);
    near(state[0].m, 3);
    near(state[0].vx, 0);
});

test('fragmentation retains mass and momentum, uses unique IDs, and avoids overlaps', () => {
    const originals = [body(-0.1, 3, 2), body(0.1, -1, 1)];
    const expected = totals(originals);
    for (const options of [{}, { nDebris: 6, debrisMassFraction: 1 }, { minDebrisMass: 10 }, { nDebris: 1 }, { debrisMassFraction: 0 }]) {
        const state = clone(originals);
        const { debris } = fragmentPair(state, 0, 1, options);
        totals(debris).forEach((v, i) => near(v, expected[i]));
        assert.equal(findEarliestContact(debris, 0), null);
        assert.ok(debris.every((b) => b.m > 0));
    }
});

test('fragment insertion is automatic and does not instantly re-collide', () => {
    const state = [body(-0.1, 3), body(0.1, -3)];
    const result = stepSimulation(state, 0, 0, 0.001, { vFrag: 1, nDebris: 6 });
    assert.equal(result.events.length, 1);
    assert.equal(state.length, 7);
    near(totals(state)[0], 2);
    near(totals(state)[1], 0);
});

test('invalid inputs fail before modifying the state', () => {
    const state = [body(0, 1)];
    for (const dt of [NaN, Infinity, -1]) assert.throws(() => stepSimulation(state, 1, 0, dt), RangeError);
    assert.throws(() => stepSimulation([body(0, 0, -1)], 1, 0, 0.01), RangeError);
    near(state[0].x, 0);
});

test('zero gravity allows coincident point bodies without NaN', () => {
    const state = [body(0, 1, 1, 0), body(0, -1, 1, 0)];
    stepSimulation(state, 0, 0, 0.001);
    near(totalEnergy(state, 0, 0), 1);
});

test('stats measure energy from the reset state', () => {
    const stats = createStats();
    const p = PRESETS[0];
    resetStats(stats, p.bodies, p.g, p.softening, p.dt);
    assert.equal(stats.initialEnergy, totalEnergy(p.bodies, p.g, p.softening));
});

const angularMomentum = (bodies) => bodies.reduce((sum, b) => sum + b.m * (b.x * b.vy - b.y * b.vx), 0);
for (const p of PRESETS.filter((p) => p.solution)) {
    test(`${p.name}: exact solution satisfies Newton acceleration and conserves invariants over 1000 periods`, () => {
        const state = clone(p.bodies);
        const initialEnergy = totalEnergy(state, p.g, 0);
        const initialL = angularMomentum(state);
        const period = centralOrbitPeriod(p);
        evaluateCentralOrbit(p, 0, state);
        state.forEach((b, i) => ['x', 'y', 'vx', 'vy'].forEach((key) => near(b[key], p.bodies[i][key])));
        for (let k = 0; k <= 100; k++) {
            const time = period * (k * 10 + k / 101);
            evaluateCentralOrbit(p, time, state);
            near(totalEnergy(state, p.g, 0), initialEnergy, 1e-10);
            near(angularMomentum(state), initialL, 1e-10);
            const before = clone(state), after = clone(state);
            const h = 1e-5;
            evaluateCentralOrbit(p, time - h, before);
            evaluateCentralOrbit(p, time + h, after);
            state.forEach((a, i) => {
                let ax = 0, ay = 0;
                state.forEach((b, j) => {
                    if (i === j) return;
                    const r = Math.hypot(b.x - a.x, b.y - a.y);
                    ax += p.g * b.m * (b.x - a.x) / r ** 3;
                    ay += p.g * b.m * (b.y - a.y) / r ** 3;
                });
                near((after[i].vx - before[i].vx) / (2 * h), ax, 2e-6);
                near((after[i].vy - before[i].vy) / (2 * h), ay, 2e-6);
                near((after[i].x - before[i].x) / (2 * h), a.vx, 2e-6);
                near((after[i].y - before[i].y) / (2 * h), a.vy, 2e-6);
            });
        }
        evaluateCentralOrbit(p, 1000 * period, state);
        state.forEach((b, i) => ['x', 'y', 'vx', 'vy'].forEach((key) => near(b[key], p.bodies[i][key], 1e-10)));
    });
}

test('figure-eight remains bounded and conserves energy/angular momentum over 100 periods', () => {
    const p = PRESETS[0], state = clone(p.bodies);
    const energy = totalEnergy(state, 1, 0);
    const angular = angularMomentum(state);
    for (let i = 0; i < 632590; i++) {
        stepSimulation(state, 1, 0, 0.001, { collisions: false });
        if (i % 1000 === 0) {
            near(totalEnergy(state, 1, 0), energy, 1e-8);
            near(angularMomentum(state), angular, 1e-10);
            assert.ok(state.every((b) => Math.hypot(b.x, b.y) < 1.2));
        }
    }
});

test('close encounters adapt the integration step without adding artificial softening', () => {
    const state = [body(-0.01, 0, 1, 0), body(0.01, 0, 1, 0)];
    state[0].vy = -5; state[1].vy = 5;
    const energy = totalEnergy(state, 1, 0);
    stepSimulation(state, 1, 0, 0.01, { collisions: false });
    near(totalEnergy(state, 1, 0), energy, 1e-5);
});
import { classify } from '../src/utils/classifier.js';

test('escape detection works even when the bound binary makes total energy negative', () => {
    const state = [body(-0.01, 0, 10, 0), body(0.01, 0, 10, 0), body(100, 3, 1, 0)];
    assert.ok(totalEnergy(state, 1, 0) < 0);
    assert.equal(classify(state, 1, 0), 'ejection');
    const shifted = state.map((b) => ({ ...b, x: b.x + 1000, y: b.y - 40, vx: b.vx + 20, vy: b.vy - 5 }));
    assert.equal(classify(shifted, 1, 0), 'ejection');
});

test('a distant returning body is not labeled as ejected', () => {
    assert.equal(classify([body(0, 0), body(100, -3)], 1, 0), 'stable');
});
