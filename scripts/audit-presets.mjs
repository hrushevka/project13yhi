import fs from 'node:fs';
import { PRESETS } from '../src/utils/presets.js';
import { stepSimulation, totalEnergy, PLANET_COLLISION_OPTIONS } from '../src/utils/physics.js';
import { classify } from '../src/utils/classifier.js';

const duration = 100;
const rows = [];
for (const preset of PRESETS) {
    const runs = [];
    for (const mode of [{ collisions: true, dt: .001 }, { collisions: true, dt: .0005 }, { collisions: false, dt: .001 }, { collisions: false, dt: .001, perturbation: 1e-8 }]) {
        const state = preset.bodies.map((b, id) => ({ ...b, id, r: Math.max(.01, .09 * Math.cbrt(b.m)) }));
        if (mode.perturbation) {
            state[0].vx += mode.perturbation;
            state[1].vx -= mode.perturbation * state[0].m / state[1].m;
        }
        const initialEnergy = totalEnergy(state, preset.g, preset.softening ?? 0);
        let firstCollision = null, firstEjection = null, radiusOverlap = null, error = null;
        let minDistance = Infinity, maxDistance = 0, maxEnergyError = 0, elapsed = 0;
        try {
            for (let k = 0; k < Math.round(duration / mode.dt); k++) {
                const result = stepSimulation(state, preset.g, preset.softening ?? 0, mode.dt, { ...PLANET_COLLISION_OPTIONS, collisions: mode.collisions });
                elapsed = (k + 1) * mode.dt;
                if (result.events.length && firstCollision === null) firstCollision = k * mode.dt + result.events[0].time;
                if (firstCollision === null) maxEnergyError = Math.max(maxEnergyError, Math.abs(totalEnergy(state, preset.g, preset.softening ?? 0) - initialEnergy) / Math.max(Math.abs(initialEnergy), 1e-12));
                for (let i = 0; i < state.length; i++) for (let j = i + 1; j < state.length; j++) {
                    const distance = Math.hypot(state[i].x - state[j].x, state[i].y - state[j].y);
                    minDistance = Math.min(minDistance, distance);
                    maxDistance = Math.max(maxDistance, distance);
                    if (radiusOverlap === null && distance <= state[i].r + state[j].r) radiusOverlap = elapsed;
                }
                if (k % 100 === 0 && firstEjection === null && classify(state, preset.g, preset.softening ?? 0) === 'ejection') firstEjection = elapsed;
            }
        } catch (e) { error = e.message; }
        runs.push({ ...mode, elapsed, firstCollision, firstEjection, radiusOverlap, minDistance, maxDistance, maxEnergyError, error });
    }
    rows.push({ name: preset.name, runs });
    console.log(JSON.stringify(rows.at(-1)));
}
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/preset-audit.json', JSON.stringify({ duration, method: 'Numerical integration only; no exact solutions or periodic replay. Planet radii match UI. Energy error excludes steps after the first merger. Ejection uses the app classifier; no event is not proof of stability.', rows }, null, 2));
const outcome = r => r.error ? 'Ошибка' : [r.firstCollision !== null ? `контакт ${r.firstCollision.toFixed(2)} с` : '', r.firstEjection !== null ? `вылет ${r.firstEjection.toFixed(2)} с` : ''].filter(Boolean).join('; ') || 'без событий';
const table = rows.map(({ name, runs: r }) => `| ${name} | ${outcome(r[0])} | ${outcome(r[1])} | ${outcome(r[2])} | ${outcome(r[3])} | ${r[2].maxEnergyError.toExponential(2)} |`).join('\n');
fs.writeFileSync('reports/preset-audit.md', `# Численная проверка пресетов: 100 секунд\n\nКаждый прогон выполнен до 100 с, включая движение после слияний. Точные решения и повтор периода отключены. Радиусы: max(0.01, 0.09 × ∛m), как в интерфейсе. Возмущение: Δvx = 10⁻⁸ с компенсацией импульса вторым телом.\n\n| Пресет | Коллизии, шаг 0.001 | Коллизии, шаг 0.0005 | Без коллизий | Без коллизий + возмущение | Макс. относительная ошибка E без коллизий |\n|---|---|---|---|---|---|\n${table}\n\n«Без событий» означает отсутствие контакта/вылета по диагностике приложения на этом интервале, а не доказанную устойчивость. При отключённых коллизиях тела могут проходить сквозь радиусы друг друга: первое такое пересечение и диапазон расстояний сохранены в JSON. Время распада чувствительных орбит зависит от шага и возмущения.\n`);
