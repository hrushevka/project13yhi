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

    computeAccelerations(n, bx, by, state.map(b => b.m), G, eps2, bax, bay);

    for (let s = 0; s < steps; s++) {
        for (let i = 0; i < n; i++) {
            bx[i] += bvx[i] * dt + 0.5 * bax[i] * dt * dt;
            by[i] += bvy[i] * dt + 0.5 * bay[i] * dt * dt;
            bvx[i] += 0.5 * bax[i] * dt;
            bvy[i] += 0.5 * bay[i] * dt;
        }

        const masses = state.map(b => b.m);
        computeAccelerations(n, bx, by, masses, G, eps2, bax, bay);

        for (let i = 0; i < n; i++) {
            bvx[i] += 0.5 * bax[i] * dt;
            bvy[i] += 0.5 * bay[i] * dt;
        }
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