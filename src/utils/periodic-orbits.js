import { stepSimulation } from './physics.js';

const cache = new Map();

// A sampled numerical period, not an exact analytical solution. Retain the
// measured closure error instead of changing the forces to force a closed orbit.
export function preparePeriodicOrbit(preset) {
    if (cache.has(preset)) return cache.get(preset);
    const count = Math.ceil(preset.period / 0.001);
    const h = preset.period / count;
    const state = preset.bodies.map((b) => ({ ...b }));
    const frames = [];
    let extent = 0;
    for (let i = 0; i <= count; i++) {
        frames.push(state.map(({ x, y, vx, vy }) => ({ x, y, vx, vy })));
        extent = Math.max(extent, ...state.map((b) => Math.hypot(b.x, b.y)));
        if (i < count) {
            const substeps = Math.ceil(h / 0.0001);
            for (let j = 0; j < substeps; j++) stepSimulation(state, preset.g, preset.softening, h / substeps, { collisions: false });
        }
    }
    const closureError = Math.max(...state.flatMap((b, i) => ['x', 'y', 'vx', 'vy'].map((key) => Math.abs(b[key] - preset.bodies[i][key]))));
    if (!Number.isFinite(closureError) || closureError > 0.003) throw new Error('The orbit does not close within the catalog tolerance.');
    const orbit = { frames, h, period: preset.period, extent, closureError };
    if (cache.size >= 4) cache.delete(cache.keys().next().value);
    cache.set(preset, orbit);
    return orbit;
}

export function evaluatePeriodicOrbit(orbit, time, state) {
    const phase = ((time % orbit.period) + orbit.period) % orbit.period;
    const index = Math.min(orbit.frames.length - 2, Math.floor(phase / orbit.h));
    const remainder = Math.max(0, phase - index * orbit.h);
    state.forEach((b, i) => Object.assign(b, orbit.frames[index][i]));
    // Integrate the short remainder: interpolating fast close encounters can
    // produce inconsistent velocities and large artificial energy changes.
    const steps = Math.ceil(remainder / 0.0001);
    for (let i = 0; i < steps; i++) stepSimulation(state, 1, 0, remainder / steps, { collisions: false });
}
