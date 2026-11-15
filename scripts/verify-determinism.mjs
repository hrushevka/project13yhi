import fs from 'node:fs';
import { PRESETS } from '../src/utils/presets.js';
import { stepSimulation } from '../src/utils/physics.js';

const rows = [];
for (const preset of PRESETS) {
    const initial = preset.bodies.map((b,i) => ({ ...b, id: `body-${i}`, r: .09 * Math.cbrt(b.m) }));
    const a = structuredClone(initial), b = structuredClone(initial), reference = structuredClone(initial);
    let repeatError = 0, maxReferenceError = 0, firstAboveTarget = null, error = null, time = 0;
    try {
        for (let tick = 0; tick < 100000; tick++) {
            stepSimulation(a, preset.g, 0, .001, { collisions: false });
            stepSimulation(b, preset.g, 0, .001, { collisions: false });
            stepSimulation(reference, preset.g, 0, .0005, { collisions: false, tolerance: 1e-12 });
            stepSimulation(reference, preset.g, 0, .0005, { collisions: false, tolerance: 1e-12 });
            time = (tick + 1) * .001;
            let difference = 0, scale = 1;
            for (let i = 0; i < a.length; i++) for (const key of ['x','y','vx','vy']) {
                repeatError = Math.max(repeatError, Math.abs(a[i][key] - b[i][key]));
                difference = Math.max(difference, Math.abs(a[i][key] - reference[i][key]));
                scale = Math.max(scale, Math.abs(reference[i][key]));
            }
            const relative = difference / scale;
            maxReferenceError = Math.max(maxReferenceError, relative);
            if (relative >= .00001 && firstAboveTarget === null) firstAboveTarget = time;
        }
    } catch(e) { error = e.message; }
    rows.push({ name: preset.name, time, repeatError, maxReferenceError, firstAboveTarget, error });
    console.log(JSON.stringify(rows.at(-1)));
}
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/determinism.json',JSON.stringify(rows,null,2));
fs.writeFileSync('reports/determinism.md', '# Повторяемость и сходимость, 100 секунд\n\nЧисленное движение точечных масс: коллизии и точные траектории выключены. Два идентичных запуска с шагом 0.001. Контрольный расчёт: шаг 0.0005 и локальный допуск 10⁻¹² вместо 10⁻¹⁰. Сравнение координат и скоростей на каждом тике; нормировка по max(1, максимальный модуль компоненты контрольного состояния). Это оценка сходимости, не доказанная граница физической ошибки.\n\n| Пресет | Ошибка повторения | Макс. отличие от контроля, % | Первое превышение 0.001%, с |\n|---|---:|---:|---:|\n'+rows.map(r=>`| ${r.name} | ${r.repeatError} | ${(100*r.maxReferenceError).toExponential(3)} | ${r.firstAboveTarget ?? 'нет'} |`).join('\n')+'\n');
