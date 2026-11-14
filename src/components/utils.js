export const COLORS = ['#ff8276', '#73cfff', '#b7a1ff'];

export const OUTCOME_LABELS = {
    collision: 'Столкновение',
    ejection: 'Выброс',
    stable: 'Движение без столкновений',
    unknown: 'Анализ...',
};

export function bodyRadius(mass) {
    return Math.max(6, Math.min(25, 6 + 5 * Math.cbrt(Math.max(mass, 0.0001))));
}

export function cloneBodies(bodies) {
    return bodies.map((b) => ({ ...b }));
}

export function formatNumber(value) {
    if (!Number.isFinite(value)) return '0';
    return String(Number(value.toFixed(4)));
}

export function formatSimTime(seconds) {
    return `${seconds.toFixed(2)} с`;
}
