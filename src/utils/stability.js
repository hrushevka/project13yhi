import { stepSimulation, PLANET_COLLISION_OPTIONS } from './physics.js';
import { classify } from './classifier.js';


export function forecastStability({ bodies, gravity, softening, collisions }) {
    if (bodies.length < 2) return { kind: 'unknown', text: 'Для оценки нужны хотя бы два тела' };
    const state = bodies.map(b => ({ ...b }));
    const extent = () => Math.max(...state.flatMap((a, i) => state.slice(i + 1).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
    const initialExtent = Math.max(extent(), .001);
    try {
        for (let i = 0; i < 5000; i++) {
            const result = stepSimulation(state, gravity, softening, .002, { collisions, ...PLANET_COLLISION_OPTIONS });
            if (result.events.length) return { kind: 'unstable', text: `Ожидается столкновение через ≈${((i + 1) * .002).toFixed(2)} с` };
            if (i % 50 === 0 && (classify(state, gravity, softening) === 'ejection' || extent() > initialExtent * 4)) {
                return { kind: 'unstable', text: 'Риск разлёта: расстояния быстро растут' };
            }
        }
        return { kind: 'stable', text: 'Признаков неустойчивости на ближайшие 10 с нет' };
    } catch {
        return { kind: 'unknown', text: 'Оценка не определена: слишком тесное сближение' };
    }
}
