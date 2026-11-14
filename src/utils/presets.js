import namedOrbits from './named-orbits.json' with { type: 'json' };

// Circular central configurations rotate about their mass-weighted centre.
function rotatingBodies(points, omega) {
    const mass = points.reduce((sum, b) => sum + b.m, 0);
    const cx = points.reduce((sum, b) => sum + b.m * b.x, 0) / mass;
    const cy = points.reduce((sum, b) => sum + b.m * b.y, 0) / mass;
    return points.map(({ m, x, y }) => ({
        m, x: x - cx, y: y - cy,
        vx: -omega * (y - cy), vy: omega * (x - cx),
    }));
}

const softening = 0;
function lagrange(name, masses, eccentricity = 0) {
    const totalMass = masses.reduce((sum, m) => sum + m, 0);
    // Equilateral triangle of side one, including Plummer softening.
    const omega = Math.sqrt(totalMass / (1 + softening ** 2) ** 1.5);
    return {
        name, group: 'Классические', g: 1, softening, dt: 0.001,
        solution: { omega, eccentricity },
        description: 'Равносторонний треугольник вращается вокруг общего центра масс.',
        bodies: rotatingBodies([
            { m: masses[0], x: -0.5, y: 0 },
            { m: masses[1], x: 0.5, y: 0 },
            { m: masses[2], x: 0, y: Math.sqrt(3) / 2 },
        ], omega * Math.sqrt(1 + eccentricity)),
    };
}

export const PRESETS = [
    {
        name: 'Восьмёрка', group: 'Хореографии', g: 1, softening: 0, dt: 0.001,
        description: 'Три равные массы следуют по одной восьмёрке. Численное решение уравнений Ньютона.',
        bodies: [
            { m: 1, x: -0.97000436, y: 0.24308753, vx: 0.466203685, vy: 0.43236573 },
            { m: 1, x: 0.97000436, y: -0.24308753, vx: 0.466203685, vy: 0.43236573 },
            { m: 1, x: 0, y: 0, vx: -0.93240737, vy: -0.86473146 },
        ],
    },
    {
        name: 'Эйлер', group: 'Классические', g: 1, softening, dt: 0.001,
        solution: { omega: Math.sqrt(3.25), eccentricity: 0 },
        description: 'Три тела остаются на одной вращающейся прямой.',
        bodies: rotatingBodies([
            { m: 1, x: -1, y: 0 },
            { m: 3, x: 0, y: 0 },
            { m: 1, x: 1, y: 0 },
        ], Math.sqrt(3 / (1 + softening ** 2) ** 1.5 + 2 / (4 + softening ** 2) ** 1.5)),
    },
    lagrange('Лагранж (3-1-1)', [3, 1, 1]),
    lagrange('Лагранж (1-1-1)', [1, 1, 1]),
    lagrange('Лагранж: эллипсы (1-2-3)', [1, 2, 3], 0.5),
    lagrange('Лагранж: овалы (1-1-1)', [1, 1, 1], 0.35),
    lagrange('Лагранж: вытянутые эллипсы', [3, 1, 1], 0.65),
    {
        name: 'Эйлер: эллипсы', group: 'Классические', g: 1, softening: 0, dt: 0.001,
        solution: { omega: Math.sqrt(3.25), eccentricity: 0.5 },
        description: 'Два тела движутся по эллипсам, сохраняя прямую через центральное тело.',
        bodies: rotatingBodies([{ m: 1, x: -1, y: 0 }, { m: 3, x: 0, y: 0 }, { m: 1, x: 1, y: 0 }], Math.sqrt(3.25 * 1.5)),
    },
    ...namedOrbits,
];

export const FALLBACK_PRESET = {
    id: 0, title: PRESETS[0].name,
    description: 'Демо-конфигурация Шенсине–Монтгомери',
    bodies: PRESETS[0].bodies.map((b) => ({
        mass: b.m, positionX: b.x, positionY: b.y, velocityX: b.vx, velocityY: b.vy,
    })),
    g: PRESETS[0].g, softening: PRESETS[0].softening, dt: PRESETS[0].dt,
    outcome: 'figure8', authorName: 'Cosmos lab', authorId: 0, canEdit: false,
};

export function detectPreset(bodies, tolerance = 0.01) {
    for (const preset of PRESETS) {
        if (preset.bodies.length !== bodies.length) continue;
        if (preset.bodies.every((pb, i) =>
            ['m', 'x', 'y', 'vx', 'vy'].every((key) => Math.abs(bodies[i][key] - pb[key]) <= tolerance)
        )) return preset.name;
    }
    return null;
}
