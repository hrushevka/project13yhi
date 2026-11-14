const MIN_DIST = 0.15;
const ESCAPE_DIST = 50;

export function totalEnergy(bodies, G, softening) {
    let kinetic = 0;
    let potential = 0;
    const eps2 = softening * softening;

    for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        kinetic += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy);
        for (let j = i + 1; j < bodies.length; j++) {
            const dx = bodies[j].x - b.x;
            const dy = bodies[j].y - b.y;
            const r = Math.sqrt(dx * dx + dy * dy + eps2);
            potential -= (G * b.m * bodies[j].m) / r;
        }
    }
    return kinetic + potential;
}

/**
 * Исход по текущему состоянию.
 * @param {Array} bodies
 * @param {number} G
 * @param {number} softening
 * @param {boolean} hasCollided — было ли слияние/распад за сессию
 */
export function classify(bodies, G, softening, hasCollided = false) {
    if (bodies.length === 0) return 'unknown';

    if (hasCollided) {
        if (bodies.length === 1) return 'collision';
        const energy = totalEnergy(bodies, G, softening);
        for (const b of bodies) {
            if (Math.hypot(b.x, b.y) > ESCAPE_DIST && energy > 0) return 'ejection';
        }
        return 'collision';
    }

    if (bodies.length === 1) return 'unknown';

    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const dx = bodies[j].x - bodies[i].x;
            const dy = bodies[j].y - bodies[i].y;
            if (Math.hypot(dx, dy) < MIN_DIST) return 'collision';
        }
    }

    const energy = totalEnergy(bodies, G, softening);
    for (const b of bodies) {
        if (Math.hypot(b.x, b.y) > ESCAPE_DIST && energy > 0) return 'ejection';
    }

    return 'stable';
}