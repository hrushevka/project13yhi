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
 * Классификация исхода.
 * @param {Array} bodies — текущее состояние тел
 * @param {number} G — гравитационная постоянная
 * @param {number} softening — сглаживание
 * @param {boolean} hasCollided — флаг, было ли реальное слияние/распад (merge/fragment)
 */
export function classify(bodies, G, softening, hasCollided = false) {
    if (bodies.length === 0) return 'unknown';

    // 1. Если было реальное столкновение (merge или fragment), ставим 'collision'
    if (hasCollided) {
        // Но проверяем, не вылетели ли осколки за пределы с положительной энергией
        const energy = totalEnergy(bodies, G, softening);
        let hasEjected = false;
        for (const b of bodies) {
            if (Math.hypot(b.x, b.y) > ESCAPE_DIST && energy > 0) {
                hasEjected = true;
                break;
            }
        }
        return hasEjected ? 'ejection' : 'collision';
    }

    // 2. Если тела просто пролетают близко, но не было слияния — это 'stable'
    if (bodies.length === 1) return 'unknown';

    // 3. Проверяем выброс (тела улетели далеко и энергия положительная)
    const energy = totalEnergy(bodies, G, softening);
    for (const b of bodies) {
        if (Math.hypot(b.x, b.y) > ESCAPE_DIST && energy > 0) return 'ejection';
    }

    // 4. Во всех остальных случаях — стабильная орбита
    return 'stable';
}