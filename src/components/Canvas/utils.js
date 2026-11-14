export const COLORS = ['#ff4d4d', '#4d6bfe', '#4dff88'];

export const VEL_SCALE = 0.6;

export const OUTCOME_LABELS = {
    collision: 'Столкновение',
    ejection: 'Выброс',
    stable: 'Стабильно',
    unknown: 'Пауза',
};

export function toFloat(value, fallback = 0) {
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(num) ? num : fallback;
}

export function roundFloat(value, digits = 4) {
    const num = toFloat(value, 0);
    const factor = 10 ** digits;
    return Math.round(num * factor) / factor;
}

export function massToRadius(mass) {
    const m = Math.max(0.01, toFloat(mass, 1));
    return Math.max(2, Math.min(80, 10 * Math.sqrt(m)));
}

export function radiusToMass(radius) {
    const r = Math.max(1, Math.min(80, toFloat(radius, 10)));
    return Math.max(0.01, (r / 10) ** 2);
}

export function bodyRadius(mass) {
    return massToRadius(mass);
}

export function cloneBodies(bodies) {
    return bodies.map((b) => ({
        m: toFloat(b.m, 1),
        x: toFloat(b.x, 0),
        y: toFloat(b.y, 0),
        vx: toFloat(b.vx, 0),
        vy: toFloat(b.vy, 0),
    }));
}

export function formatSimTime(seconds) {
    return `${toFloat(seconds, 0).toFixed(2)} с`;
}

export function getVelocityHandleScreenPos(b, sx, sy, k) {
    const tipX = sx + b.vx * VEL_SCALE * k;
    const tipY = sy - b.vy * VEL_SCALE * k;
    const len = Math.hypot(tipX - sx, tipY - sy);
    return {
        x: tipX,
        y: tipY,
        len,
        isZero: len <= 2,
    };
}
