export { FALLBACK_PRESET } from './presets.js';

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
            const r2 = dx * dx + dy * dy + eps2;
            if (G === 0) continue;
            if (r2 === 0) throw new RangeError('Coincident point masses require softening or collision radii.');
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

export function classifyContact(A, B, opts = {}) {
    const { vFrag = Infinity, qMin = 0 } = opts;

    const dx = B.x - A.x, dy = B.y - A.y;
    const d = Math.hypot(dx, dy) || 1e-12;
    const nx = dx / d, ny = dy / d;

    const rvx = B.vx - A.vx, rvy = B.vy - A.vy;
    const vn = d <= 1e-12 ? Math.hypot(rvx, rvy) : Math.max(0, -(rvx * nx + rvy * ny));

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
    A.r = Math.cbrt((A.r || 0) ** 3 + (B.r || 0) ** 3);

    bodies.splice(j, 1);
    return { id: A.id, m: M };
}

let fragmentId = 0;

export function fragmentPair(bodies, i, j, opts = {}) {
    const A = bodies[i], B = bodies[j];
    const M = A.m + B.m;
    const cx = (A.m * A.x + B.m * B.x) / M;
    const cy = (A.m * A.y + B.m * B.y) / M;
    const cvx = (A.m * A.vx + B.m * B.vx) / M;
    const cvy = (A.m * A.vy + B.m * B.vy) / M;
    const fraction = Math.max(0, Math.min(1, opts.debrisMassFraction ?? 0.5));
    const minMass = Math.max(1e-12, opts.minDebrisMass ?? 1e-4);
    const count = Math.min(64, Math.max(0, Math.floor(opts.nDebris ?? 8)), Math.floor(M * fraction / minMass));
    // Too little mass to form a symmetric cloud: retain it in one remnant.
    const debrisMass = count >= 2 ? M * fraction : 0;
    const radius = Math.cbrt((A.r || 0) ** 3 + (B.r || 0) ** 3);
    const debris = [];
    if (debrisMass > 0) {
        const m = debrisMass / count;
        const r = radius * Math.cbrt(m / M);
        const remnantRadius = radius * Math.cbrt(1 - fraction);
        const ring = Math.max(1e-6, 1.01 * (remnantRadius + r), 1.01 * r / Math.sin(Math.PI / count));
        // Ejection kinetic energy cannot exceed the impact's relative kinetic energy.
        const relativeSpeed = Math.hypot(B.vx - A.vx, B.vy - A.vy);
        const speed = Math.min(Math.max(0, opts.spread ?? 0.5), relativeSpeed * Math.sqrt(A.m * B.m / (M * debrisMass)));
        for (let k = 0; k < count; k++) {
            const angle = 2 * Math.PI * k / count;
            debris.push({
                id: 'debris-' + (++fragmentId), m, r, isDebris: true,
                x: cx + ring * Math.cos(angle), y: cy + ring * Math.sin(angle),
                vx: cvx + speed * Math.cos(angle), vy: cvy + speed * Math.sin(angle),
            });
        }
    }
    if (M > debrisMass) {
        debris.push({
            id: A.id, m: M - debrisMass, r: radius * Math.cbrt(1 - debrisMass / M),
            x: cx, y: cy, vx: cvx, vy: cvy,
        });
    }
    bodies.splice(Math.max(i, j), 1);
    bodies.splice(Math.min(i, j), 1);
    return { debris, gas: { x: cx, y: cy, vx: cvx, vy: cvy, mass: 0, life: 1.5, radius } };
}

// Advance the entire system through the drift interval, resolving contacts in time order.
// Fragment insertion is owned here; onEvent is a notification only.
export function detectAndResolve(bodies, dt, opts = {}) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Collision interval must be finite and nonnegative.');
    const events = [];
    let remaining = dt;
    const maxEvents = Math.max(0, Math.floor(opts.maxEvents ?? 64));
    const drift = (t) => {
        for (const b of bodies) { b.x += b.vx * t; b.y += b.vy * t; }
    };
    while (events.length < maxEvents) {
        const hit = findEarliestContact(bodies, remaining);
        if (!hit) break;
        drift(hit.t);
        remaining = Math.max(0, remaining - hit.t);
        const A = bodies[hit.i], B = bodies[hit.j];
        const cls = classifyContact(A, B, opts);
        let ev;
        if (cls.kind === 'merge') {
            const res = mergePair(bodies, hit.i, hit.j);
            ev = { ...cls, ...res, x: A.x, y: A.y };
        } else {
            const res = fragmentPair(bodies, hit.i, hit.j, opts);
            bodies.push(...res.debris);
            ev = { ...cls, ...res };
        }
        ev.time = dt - remaining;
        events.push(ev);
        opts.onEvent?.(ev);
    }
    // Never silently drift through unresolved contacts after the event budget.
    if (events.length === maxEvents && findEarliestContact(bodies, remaining)) {
        throw new RangeError('Collision event limit exceeded; reduce the time step.');
    }
    drift(remaining);
    return { events };
}

function validateStep(state, G, softening, dt) {
    if (!Number.isFinite(G) || G < 0 || !Number.isFinite(softening) || softening < 0 || !Number.isFinite(dt)) {
        throw new RangeError('Invalid gravity, softening, or time step.');
    }
    if (!isStateFinite(state)) throw new RangeError('Bodies must have finite coordinates and positive masses.');
}

// Kick-drift-kick Verlet with continuous linear collision detection during drift.
export function stepSimulation(state, G, softening, dt, opts = {}) {
    validateStep(state, G, softening, dt);
    if (dt < 0 || dt > 1) throw new RangeError('Simulation time step must be between zero and one.');
    if (dt === 0 || state.length === 0) return { events: [] };
    if (opts.collisions === false) {
        // Fourth-order symplectic integration, subdivided near close encounters.
        let remaining = dt;
        let count = 0;
        while (remaining > 1e-14) {
            let h = Math.min(remaining, 0.002);
            for (let i = 0; i < state.length; i++) {
                for (let j = i + 1; j < state.length; j++) {
                    const a = state[i], b = state[j];
                    const r = Math.hypot(a.x - b.x, a.y - b.y, softening);
                    const v = Math.hypot(a.vx - b.vx, a.vy - b.vy);
                    if (G > 0) {
                        h = Math.min(h, 0.02 * Math.sqrt(r ** 3 / (G * (a.m + b.m))));
                        if (v > 0) h = Math.min(h, 0.02 * r / v);
                    }
                }
            }
            if (!(h > 1e-14) || ++count > 10000) throw new RangeError('Too close to a point-mass collision. Enable collisions or increase softening.');
            stepBodiesInPlace(state, G, softening, h);
            remaining = Math.max(0, remaining - h);
        }
        return { events: [] };
    }
    const steps = Math.ceil(dt / 0.001);
    if (steps > 1000) throw new RangeError('Time step is too large.');
    const h = dt / steps;
    const events = [];
    const kick = () => {
        const n = state.length;
        const { bx, by, bax, bay } = ensureScratch(n);
        const masses = state.map((b, i) => { bx[i] = b.x; by[i] = b.y; return b.m; });
        computeAccelerations(n, bx, by, masses, G, softening * softening, bax, bay);
        state.forEach((b, i) => { b.vx += bax[i] * h / 2; b.vy += bay[i] * h / 2; });
    };
    for (let k = 0; k < steps; k++) {
        // Resolve initial overlaps before evaluating a possibly singular force.
        events.push(...detectAndResolve(state, 0, opts).events.map((ev) => ({ ...ev, time: k * h })));
        kick();
        events.push(...detectAndResolve(state, h, opts).events.map((ev) => ({ ...ev, time: k * h + ev.time })));
        kick();
    }
    return { events };
}

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
        (b) => Number.isFinite(b.m) && b.m > 0 && (b.r === undefined || (Number.isFinite(b.r) && b.r >= 0)) && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy)
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
            if (G !== 0) potential -= (G * b.m * state[j].m) / r;
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