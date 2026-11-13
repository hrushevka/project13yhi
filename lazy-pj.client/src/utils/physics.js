function makeScratch(cap) {
    return {
        cap,
        bx: new Float64Array(cap),
        by: new Float64Array(cap),
        bvx: new Float64Array(cap),
        bvy: new Float64Array(cap),
        bm: new Float64Array(cap),
        tx: new Float64Array(cap),
        ty: new Float64Array(cap),
        tvx2: new Float64Array(cap),
        tvy2: new Float64Array(cap),
        tvx3: new Float64Array(cap),
        tvy3: new Float64Array(cap),
        tvx4: new Float64Array(cap),
        tvy4: new Float64Array(cap),
        k1x: new Float64Array(cap),
        k1y: new Float64Array(cap),
        k2x: new Float64Array(cap),
        k2y: new Float64Array(cap),
        k3x: new Float64Array(cap),
        k3y: new Float64Array(cap),
        k4x: new Float64Array(cap),
        k4y: new Float64Array(cap),
    };
}

let scratch = makeScratch(8);

function ensureScratch(n) {
    if (n > scratch.cap) {
        scratch = makeScratch(n);
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
    const { bx, by, bvx, bvy, bm, tx, ty, tvx2, tvy2, tvx3, tvy3, tvx4, tvy4, k1x, k1y, k2x, k2y, k3x, k3y, k4x, k4y } =
        buf;

    for (let i = 0; i < n; i++) {
        bx[i] = state[i].x;
        by[i] = state[i].y;
        bvx[i] = state[i].vx;
        bvy[i] = state[i].vy;
        bm[i] = state[i].m;
    }

    const eps2 = softening * softening;
    const half = dt * 0.5;
    const sixth = dt / 6;

    for (let s = 0; s < steps; s++) {
        computeAccelerations(n, bx, by, bm, G, eps2, k1x, k1y);
        for (let i = 0; i < n; i++) {
            tx[i] = bx[i] + bvx[i] * half;
            ty[i] = by[i] + bvy[i] * half;
            tvx2[i] = bvx[i] + k1x[i] * half;
            tvy2[i] = bvy[i] + k1y[i] * half;
        }

        computeAccelerations(n, tx, ty, bm, G, eps2, k2x, k2y);
        for (let i = 0; i < n; i++) {
            tx[i] = bx[i] + tvx2[i] * half;
            ty[i] = by[i] + tvy2[i] * half;
            tvx3[i] = bvx[i] + k2x[i] * half;
            tvy3[i] = bvy[i] + k2y[i] * half;
        }

        computeAccelerations(n, tx, ty, bm, G, eps2, k3x, k3y);
        for (let i = 0; i < n; i++) {
            tx[i] = bx[i] + tvx3[i] * dt;
            ty[i] = by[i] + tvy3[i] * dt;
            tvx4[i] = bvx[i] + k3x[i] * dt;
            tvy4[i] = bvy[i] + k3y[i] * dt;
        }

        computeAccelerations(n, tx, ty, bm, G, eps2, k4x, k4y);
        for (let i = 0; i < n; i++) {
            bx[i] += sixth * (bvx[i] + 2 * tvx2[i] + 2 * tvx3[i] + tvx4[i]);
            by[i] += sixth * (bvy[i] + 2 * tvy2[i] + 2 * tvy3[i] + tvy4[i]);
            bvx[i] += sixth * (k1x[i] + 2 * k2x[i] + 2 * k3x[i] + k4x[i]);
            bvy[i] += sixth * (k1y[i] + 2 * k2y[i] + 2 * k3y[i] + k4y[i]);
        }
    }

    for (let i = 0; i < n; i++) {
        state[i].x = bx[i];
        state[i].y = by[i];
        state[i].vx = bvx[i];
        state[i].vy = bvy[i];
    }
}

export function rk4Step(state, G, softening, dt) {
    const next = state.map((b) => ({ ...b }));
    stepBodiesInPlace(next, G, softening, dt, 1);
    return next;
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
    softening: 0.001,
    dt: 0.001,
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
