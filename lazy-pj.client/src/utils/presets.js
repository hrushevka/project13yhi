export const PRESETS = [
    {
        name: 'Восьмёрка',
        g: 1,
        softening: 0,
        dt: 0.0001,
        bodies: [
            { m: 1, x: -0.97000436, y: 0.24308753, vx: 0.46620368, vy: 0.43236573 },
            { m: 1, x: 0.97000436, y: -0.24308753, vx: 0.46620368, vy: 0.43236573 },
            { m: 1, x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 },
        ],
    },
    {
        name: 'Эйлер',
        g: 1,
        softening: 0.001,
        dt: 0.0005,
        bodies: [
            { m: 3, x: 0, y: 1, vx: -0.63034, vy: 0 },
            { m: 1, x: 0, y: -0.83299, vx: 0.52507, vy: 0 },
            // Исправлено: x был 1, заменен на 0, чтобы тела лежали на одной прямой
            { m: 1, x: 0, y: -2.16700, vx: 1.36596, vy: 0 },
        ],
    },
    {
        name: 'Лагранж (3-1-1)',
        g: 1,
        softening: 0.001,
        dt: 0.0005,
        bodies: [
            { m: 3, x: 0, y: 0, vx: 0, vy: 0.8385 },
            { m: 1, x: 2, y: 0, vx: -0.4213, vy: 0.2528 },
            { m: 1, x: 1, y: 1.73205, vx: 0.4213, vy: -0.7577 },
        ],
    },
    {
        name: 'Лагранж (1-1-1)',
        g: 1,
        softening: 0.001,
        dt: 0.0005,
        bodies: [
            { m: 1, x: -0.5, y: -0.288675, vx: 0.5, vy: 0.866025 },
            { m: 1, x: 0.5, y: -0.288675, vx: -0.5, vy: 0.866025 },
            { m: 1, x: 0, y: 0.57735, vx: 0, vy: -1.73205 },
        ],
    },
];

export function detectPreset(bodies, tolerance = 0.01) {
    for (const preset of PRESETS) {
        if (preset.bodies.length !== bodies.length) continue;
        const match = preset.bodies.every((pb, i) => {
            const b = bodies[i];
            return (
                Math.abs(b.m - pb.m) < tolerance && // Добавлена проверка массы
                Math.abs(b.x - pb.x) < tolerance &&
                Math.abs(b.y - pb.y) < tolerance &&
                Math.abs(b.vx - pb.vx) < tolerance &&
                Math.abs(b.vy - pb.vy) < tolerance
            );
        });
        if (match) return preset.name;
    }
    return null;
}