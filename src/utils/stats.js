import { totalEnergy } from './physics.js';

export function createStats() {
    return {
        elapsed: 0,
        firstCollisionTime: null,
        lastCollisionTime: null,
        merges: 0,
        fragments: 0,
        debrisCount: 0,
        distanceHistory: [],
        events: [],
        avgDistance: 0,
        minDistance: Infinity,
        maxDistance: 0,
        avgDistanceSamples: 0,
        initialEnergy: null,
        currentEnergy: null,
        initialBodyCount: 0,
        currentBodyCount: 0,
        maxBodyCount: 0,
        avgSpeed: 0,
        maxSpeed: 0,
        avgSpeedSamples: 0,
        G: 1,
        softening: 0,
        dt: 0.0001,
    };
}

export function resetStats(stats, bodies, G, softening, dt) {
    Object.assign(stats, createStats());
    stats.G = G;
    stats.softening = softening;
    stats.dt = dt;
    stats.initialEnergy = totalEnergy(bodies, G, softening);
    stats.currentEnergy = stats.initialEnergy;
    stats.initialBodyCount = bodies.length;
    stats.currentBodyCount = bodies.length;
    stats.maxBodyCount = bodies.length;
}

function pairDistances(bodies) {
    const pairs = [];
    for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
            const dx = bodies[j].x - bodies[i].x;
            const dy = bodies[j].y - bodies[i].y;
            pairs.push({ i, j, d: Math.hypot(dx, dy) });
        }
    }
    return pairs;
}

export function sampleStats(stats, bodies, t, energy, events = []) {
    stats.elapsed = t;
    stats.currentBodyCount = bodies.length;
    stats.maxBodyCount = Math.max(stats.maxBodyCount, bodies.length);

    if (stats.initialEnergy === null) stats.initialEnergy = energy;
    stats.currentEnergy = energy;

    const pairs = pairDistances(bodies);
    if (pairs.length > 0) {
        let sum = 0, min = Infinity, max = 0;
        for (const p of pairs) {
            sum += p.d;
            if (p.d < min) min = p.d;
            if (p.d > max) max = p.d;
        }
        const avg = sum / pairs.length;
        if (!stats.distanceHistory.length || t - stats.distanceHistory.at(-1).t >= .1 - 1e-9) {
            stats.distanceHistory.push({ t, avg, min, max });
            if (stats.distanceHistory.length > 300) stats.distanceHistory.shift();
        }

        stats.avgDistance += avg;
        stats.avgDistanceSamples += 1;
        if (min < stats.minDistance) stats.minDistance = min;
        if (max > stats.maxDistance) stats.maxDistance = max;
    }

    if (bodies.length > 0) {
        let speedSum = 0, speedMax = 0;
        for (const b of bodies) {
            const s = Math.hypot(b.vx, b.vy);
            speedSum += s;
            if (s > speedMax) speedMax = s;
        }
        stats.avgSpeed += speedSum / bodies.length;
        stats.avgSpeedSamples += 1;
        if (speedMax > stats.maxSpeed) stats.maxSpeed = speedMax;
    }

    for (const ev of events) {
        stats.events = [...stats.events, { kind: ev.kind, time: t - stats.dt + (ev.time ?? stats.dt) }].slice(-10);
        if (ev.kind === 'merge') {
            stats.merges += 1;
            stats.lastCollisionTime = t - stats.dt + (ev.time ?? stats.dt);
            if (stats.firstCollisionTime === null) stats.firstCollisionTime = stats.lastCollisionTime;
        } else if (ev.kind === 'fragment') {
            stats.fragments += 1;
            stats.lastCollisionTime = t;
            if (stats.firstCollisionTime === null) stats.firstCollisionTime = stats.lastCollisionTime;
            if (ev.debris) stats.debrisCount += ev.debris.filter((b) => b.isDebris).length;
        }
    }
}

export function liveMetrics(bodies, initialBodies) {
    const pairs = [];
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i], b = bodies[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const radialSpeed = distance > 0 ? (dx * (b.vx - a.vx) + dy * (b.vy - a.vy)) / distance : 0;
        pairs.push({ label: `${i + 1}–${j + 1}`, distance, gap: distance - (a.r ?? 0) - (b.r ?? 0), radialSpeed });
    }
    pairs.sort((a, b) => a.gap - b.gap);
    const extent = bs => Math.max(0, ...pairDistances(bs).map(p => p.d));
    const size = extent(bodies), initialSize = extent(initialBodies);
    return { pairs, size, sizeRatio: initialSize > 0 ? size / initialSize : null,
        speeds: bodies.map((b, i) => ({ label: i + 1, speed: Math.hypot(b.vx, b.vy) })) };
}

export function getSummary(stats) {
    return {
        elapsed: stats.elapsed,
        avgDistance: stats.avgDistanceSamples > 0 ? stats.avgDistance / stats.avgDistanceSamples : 0,
        minDistance: Number.isFinite(stats.minDistance) ? stats.minDistance : 0,
        maxDistance: stats.maxDistance,
        avgSpeed: stats.avgSpeedSamples > 0 ? stats.avgSpeed / stats.avgSpeedSamples : 0,
        maxSpeed: stats.maxSpeed,
        merges: stats.merges,
        fragments: stats.fragments,
        debrisCount: stats.debrisCount,
        firstCollisionTime: stats.firstCollisionTime,
        lastCollisionTime: stats.lastCollisionTime,
        bodyCount: stats.currentBodyCount,
        initialBodyCount: stats.initialBodyCount,
        maxBodyCount: stats.maxBodyCount,
        energy: stats.currentEnergy,
        initialEnergy: stats.initialEnergy,
        energyDrift:
            stats.initialEnergy !== null && stats.currentEnergy !== null
                ? stats.currentEnergy - stats.initialEnergy
                : 0,
    };
}
