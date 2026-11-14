let scratch = {
    bx: new Float64Array(8),
    by: new Float64Array(8),
    bvx: new Float64Array(8),
    bvy: new Float64Array(8),
    bax: new Float64Array(8),
    bay: new Float64Array(8),
};

function ensureScratch(n) {
    if (n > scratch.bx.length) {
        const cap = Math.max(n, 8);
        scratch = {
            bx: new Float64Array(cap),
            by: new Float64Array(cap),
            bvx: new Float64Array(cap),
            bvy: new Float64Array(cap),
            bax: new Float64Array(cap),
            bay: new Float64Array(cap),
        };
    }
    return scratch;
}

function computeAccelerations(n, px, py, pm, G, eps2, ax, ay) {
    for (let i = 0; i < n; i++) {
        ax[i] = 0;
        ay[i] = 0;
    }
    for (let i = 0; i < n; i++) {
        const xi = px[i];
        const yi = py[i];
        const mi = pm[i];
        for (let j = i + 1; j < n; j++) {
            const dx = px[j] - xi;
            const dy = py[j] - yi;
            const r2 = dx * dx + dy * dy + eps2;
            const inv = 1 / (r2 * Math.sqrt(r2));
            const fi = G * pm[j] * inv;
            const fj = G * mi * inv;
            ax[i] += dx * fi;
            ay[i] += dy * fi;
            ax[j] -= dx * fj;
            ay[j] -= dy * fj;
        }
    }
}

const YOSHIDA_W1 = 1 / (2 - Math.cbrt(2));
const YOSHIDA_W0 = -Math.cbrt(2) / (2 - Math.cbrt(2));

function leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, dt) {
    const halfDt = 0.5 * dt;
    for (let i = 0; i < n; i++) {
        bvx[i] += bax[i] * halfDt;
        bvy[i] += bay[i] * halfDt;
        bx[i] += bvx[i] * dt;
        by[i] += bvy[i] * dt;
    }
    computeAccelerations(n, bx, by, masses, G, eps2, bax, bay);
    for (let i = 0; i < n; i++) {
        bvx[i] += bax[i] * halfDt;
        bvy[i] += bay[i] * halfDt;
    }
}

export function minPairTimescale(state, G, softening) {
    const n = state.length;
    if (n < 2 || G <= 0) return Infinity;
    const eps2 = softening * softening;
    let minTau = Infinity;
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = state[j].x - state[i].x;
            const dy = state[j].y - state[i].y;
            const r2 = dx * dx + dy * dy + eps2;
            const mSum = state[i].m + state[j].m;
            if (mSum <= 0) continue;
            const tau = Math.sqrt((r2 * Math.sqrt(r2)) / (G * mSum));
            if (tau < minTau) minTau = tau;
        }
    }
    return minTau;
}

export function computeEffectiveDt(state, G, softening, baseDt) {
    const tau = minPairTimescale(state, G, softening);
    if (!Number.isFinite(tau) || tau <= 0) return baseDt;
    const safe = 0.04 * tau;
    if (safe <= 0) return baseDt;
    return Math.min(baseDt, safe);
}

export function stepBodiesInPlace(state, G, softening, dt, steps = 1) {
    const n = state.length;
    if (n === 0 || steps <= 0 || dt === 0) return;

    const buf = ensureScratch(n);
    const { bx, by, bvx, bvy, bax, bay } = buf;

    for (let i = 0; i < n; i++) {
        bx[i] = state[i].x;
        by[i] = state[i].y;
        bvx[i] = state[i].vx;
        bvy[i] = state[i].vy;
    }

    const eps2 = softening * softening;
    const masses = new Float64Array(n);
    for (let i = 0; i < n; i++) masses[i] = state[i].m;

    computeAccelerations(n, bx, by, masses, G, eps2, bax, bay);

    for (let s = 0; s < steps; s++) {
        leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W1 * dt);
        leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W0 * dt);
        leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W1 * dt);
    }

    for (let i = 0; i < n; i++) {
        state[i].x = bx[i];
        state[i].y = by[i];
        state[i].vx = bvx[i];
        state[i].vy = bvy[i];
    }
}

export const FALLBACK_PRESET = {
    id: 0,
    title: 'Восьмёрка',
    description: 'Демо-конфигурация Шенсине–Монтгомери',
    bodies: [
        { mass: 1, positionX: -0.97000436, positionY: 0.24308753, velocityX: 0.46620368, velocityY: 0.43236573 },
        { mass: 1, positionX: 0.97000436, positionY: -0.24308753, velocityX: 0.46620368, velocityY: 0.43236573 },
        { mass: 1, positionX: 0, positionY: 0, velocityX: -0.93240737, velocityY: -0.86473146 },
    ],
    g: 1,
    softening: 0,
    dt: 0.0001,
    outcome: 'figure8',
    authorName: 'Cosmos lab',
    authorId: 0,
    canEdit: false,
};

export function toSimBodies(bodies) {
    return bodies.map((b) => ({
        m: b.mass,
        x: b.positionX,
        y: b.positionY,
        vx: b.velocityX,
        vy: b.velocityY,
    }));
}

export function isStateFinite(state) {
    return state.every(
        (b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy)
    );
}

export function totalEnergy(state, G, softening) {
    let kinetic = 0;
    let potential = 0;
    const eps2 = softening * softening;
    for (let i = 0; i < state.length; i++) {
        const b = state[i];
        kinetic += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
        for (let j = i + 1; j < state.length; j++) {
            const dx = state[j].x - b.x;
            const dy = state[j].y - b.y;
            const r = Math.sqrt(dx * dx + dy * dy + eps2);
            potential -= (G * b.m * state[j].m) / r;
        }
    }
    return kinetic + potential;
}

export function runDeterministic(state, G, softening, baseDt, totalTime, sampleDt) {
    const result = { samples: [], finalState: state.map((b) => ({ ...b })), finalTime: 0 };
    let t = 0;
    let nextSample = 0;
    let local = state.map((b) => ({ ...b }));
    let safety = 0;
    while (t < totalTime - 1e-12 && safety < 10_000_000) {
        const H = computeEffectiveDt(local, G, softening, baseDt);
        if (t + H > nextSample - 1e-12) {
            result.samples.push({
                t: nextSample,
                state: local.map((b) => ({ ...b })),
            });
            nextSample += sampleDt;
        }
        stepBodiesInPlace(local, G, softening, H, 1);
        t += H;
        safety++;
    }
    result.finalState = local;
    result.finalTime = t;
    return result;
}