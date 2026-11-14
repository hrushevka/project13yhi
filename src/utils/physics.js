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
            // Защита от деления на 0 и гравитационного "отскока"
            const r2 = dx * dx + dy * dy + Math.max(eps2, 1e-6);
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

export function stepBodiesInPlace(state, G, softening, dt) {
    const n = state.length;
    if (n === 0 || dt === 0) return;

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

    leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W1 * dt);
    leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W0 * dt);
    leapfrogStep(n, bx, by, bvx, bvy, bax, bay, masses, G, eps2, YOSHIDA_W1 * dt);

    for (let i = 0; i < n; i++) {
        state[i].x = bx[i];
        state[i].y = by[i];
        state[i].vx = bvx[i];
        state[i].vy = bvy[i];
    }
}

export function stepBodiesVelocityVerlet(state, G, softening, dt) {
    const n = state.length;
    if (n === 0 || dt === 0) return;

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

    for (let i = 0; i < n; i++) {
        state[i].x = bx[i];
        state[i].y = by[i];
        state[i].vx = bvx[i];
        state[i].vy = bvy[i];
    }
}

export function findEarliestContact(bodies, dt) {
    let best = null;
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const A = bodies[i], B = bodies[j];
            const R = (A.r || 0) + (B.r || 0);
            if (R <= 0) continue;

            const dx = B.x - A.x, dy = B.y - A.y;
            const dvx = B.vx - A.vx, dvy = B.vy - A.vy;

            const a = dvx * dvx + dvy * dvy;
            const b = 2 * (dx * dvx + dy * dvy);
            const c = dx * dx + dy * dy - R * R;

            if (c <= 0) {
                if (!best || 0 < best.t) best = { i, j, t: 0 };
                continue;
            }
            if (a === 0) continue;
            const disc = b * b - 4 * a * c;
            if (disc < 0) continue;

            const sq = Math.sqrt(disc);
            const t1 = (-b - sq) / (2 * a);
            const t2 = (-b + sq) / (2 * a);
            let t = null;
            if (t1 >= 0 && t1 <= dt) t = t1;
            else if (t2 >= 0 && t2 <= dt) t = t2;
            if (t === null) continue;

            if (!best || t < best.t) best = { i, j, t };
        }
    }
    return best;
}

export function classifyContact(A, B, opts) {
    const { vFrag = Infinity, qMin = 0 } = opts;

    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 1e-12;
    const nx = dx / d, ny = dy / d;

    const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
    const vn = Math.abs(rvx * nx + rvy * ny);

    const q = Math.min(A.m, B.m) / Math.max(A.m, B.m);

    const hard = vn >= vFrag && q >= qMin;
    return { kind: hard ? 'fragment' : 'merge', vn, q };
}

export function mergePair(bodies, i, j) {
    const A = bodies[i], B = bodies[j];
    const M = A.m + B.m;

    A.x = (A.m * A.x + B.m * B.x) / M;
    A.y = (A.m * A.y + B.m * B.y) / M;
    A.vx = (A.m * A.vx + B.m * B.vx) / M;
    A.vy = (A.m * A.vy + B.m * B.vy) / M;
    A.m = M;
    A.r = Math.sqrt((A.r || 0) ** 2 + (B.r || 0) ** 2);

    bodies.splice(j, 1);
    return { id: A.id, m: M };
}

export function fragmentPair(bodies, i, j, opts) {
    const A = bodies[i], B = bodies[j];
    const {
        nDebris = 8,
        spread = 0.5,
        debrisMassFraction = 0.5,
        minDebrisMass = 1e-4,
    } = opts;

    const M = A.m + B.m;
    const cx = (A.m * A.x + B.m * B.x) / M;
    const cy = (A.m * A.y + B.m * B.y) / M;
    const cvx = (A.m * A.vx + B.m * B.vx) / M;
    const cvy = (A.m * A.vy + B.m * B.vy) / M;

    const debris = [];
    const mTotalDebris = M * debrisMassFraction;
    const mEach = Math.max(minDebrisMass, mTotalDebris / nDebris);

    for (let k = 0; k < nDebris; k++) {
        const ang = (2 * Math.PI * k) / nDebris + Math.random() * 0.4;
        const sp = spread * (0.5 + Math.random());
        debris.push({
            id: `debris-${Date.now()}-${k}`,
            x: cx + Math.cos(ang) * (A.r || 0) * 0.5,
            y: cy + Math.sin(ang) * (A.r || 0) * 0.5,
            vx: cvx + Math.cos(ang) * sp,
            vy: cvy + Math.sin(ang) * sp,
            m: mEach,
            r: Math.cbrt(mEach) * 0.1,
            isDebris: true,
        });
    }

    const hi = Math.max(i, j), lo = Math.min(i, j);
    bodies.splice(hi, 1);
    bodies.splice(lo, 1);

    const gas = {
        x: cx, y: cy,
        vx: cvx, vy: cvy,
        mass: M * (1 - debrisMassFraction),
        life: 1.5,
        radius: (A.r || 0) + (B.r || 0),
    };

    return { debris, gas };
}

export function detectAndResolve(bodies, dt, opts = {}) {
    const {
        maxEvents = 8,
        onEvent = () => {},
    } = opts;

    const events = [];
    let guard = 0;

    while (guard++ < maxEvents) {
        const hit = findEarliestContact(bodies, dt);
        if (!hit) break;

        const { i, j, t } = hit;

        if (t > 1e-12) {
            bodies[i].x += bodies[i].vx * t;
            bodies[i].y += bodies[i].vy * t;
            bodies[j].x += bodies[j].vx * t;
            bodies[j].y += bodies[j].vy * t;
        }

        const A = bodies[i], B = bodies[j];
        const cls = classifyContact(A, B, opts);

        if (cls.kind === 'merge') {
            const res = mergePair(bodies, i, j);
            const ev = { kind: 'merge', ...cls, ...res, x: A.x, y: A.y };
            events.push(ev);
            onEvent(ev);
            // ВАЖНО: ВЫХОДИМ, так как массив изменился
            break;
        }

        const res = fragmentPair(bodies, i, j, opts);
        const ev = { kind: 'fragment', ...cls, ...res };
        events.push(ev);
        onEvent(ev);
        break;
    }

    return { events };
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

export function recenterToCM(state) {
    let totalMass = 0;
    let cx = 0, cy = 0, vx = 0, vy = 0;
    for (const b of state) {
        totalMass += b.m;
        cx += b.m * b.x;
        cy += b.m * b.y;
        vx += b.m * b.vx;
        vy += b.m * b.vy;
    }
    if (totalMass === 0) return;
    cx /= totalMass;
    cy /= totalMass;
    vx /= totalMass;
    vy /= totalMass;
    for (const b of state) {
        b.x -= cx;
        b.y -= cy;
        b.vx -= vx;
        b.vy -= vy;
    }
}