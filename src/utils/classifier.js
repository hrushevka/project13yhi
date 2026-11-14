export { totalEnergy } from './physics.js';

// An escape candidate must be far from every companion and receding from their
// centre of mass with positive relative two-cluster energy. This is a diagnostic,
// not a proof of long-term stability of a three-body orbit.
export function classify(bodies, G, softening, hasCollided = false) {
    if (bodies.length === 0) return 'unknown';
    if (bodies.length > 1) {
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            let mass = 0, x = 0, y = 0, vx = 0, vy = 0, minDistance = Infinity;
            for (let j = 0; j < bodies.length; j++) {
                if (i === j) continue;
                const other = bodies[j];
                mass += other.m;
                x += other.m * other.x; y += other.m * other.y;
                vx += other.m * other.vx; vy += other.m * other.vy;
                minDistance = Math.min(minDistance, Math.hypot(b.x - other.x, b.y - other.y));
            }
            const dx = b.x - x / mass, dy = b.y - y / mass;
            const dvx = b.vx - vx / mass, dvy = b.vy - vy / mass;
            const energy = (dvx * dvx + dvy * dvy) / 2 - G * (mass + b.m) / Math.hypot(dx, dy, softening);
            if (minDistance > 50 && dx * dvx + dy * dvy > 0 && energy > 0) return 'ejection';
        }
    }
    if (hasCollided) return 'collision';
    return bodies.length > 1 ? 'stable' : 'unknown';
}
