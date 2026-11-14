// Rebuild visual previews from the same equations used by the live simulator.
import fs from 'node:fs';
import { PRESETS } from '../src/utils/presets.js';
import { preparePeriodicOrbit } from '../src/utils/periodic-orbits.js';
import { evaluateCentralOrbit, centralOrbitPeriod } from '../src/utils/orbits.js';
const previews = {};
for (const preset of PRESETS) {
    let frames;
    if (preset.solution) {
        const state = structuredClone(preset.bodies);
        frames = Array.from({ length: 501 }, (_, i) => {
            evaluateCentralOrbit(preset, centralOrbitPeriod(preset) * i / 500, state);
            return structuredClone(state);
        });
    } else {
        const orbit = preparePeriodicOrbit(preset.period ? preset : { ...preset, period: 6.32591398 });
        if (preset.period) { preset.extent = orbit.extent; preset.closureError = orbit.closureError; }
        frames = orbit.frames.filter((_, i) => i % Math.max(1, Math.floor(orbit.frames.length / 500)) === 0);
    }
    const extent = Math.max(...frames.flatMap((frame) => frame.map((b) => Math.max(Math.abs(b.x), Math.abs(b.y))))) * 1.1;
    previews[preset.name] = preset.bodies.map((_, i) => frames.map((frame, j) =>
        `${j ? 'L' : 'M'}${(50 + frame[i].x / extent * 45).toFixed(2)},${(50 - frame[i].y / extent * 45).toFixed(2)}`).join(''));
}
fs.writeFileSync(new URL('../src/utils/orbit-previews.json', import.meta.url), JSON.stringify(previews));
fs.writeFileSync(new URL('../src/utils/named-orbits.json', import.meta.url), JSON.stringify(PRESETS.filter((p) => p.period), null, 2) + '\n');
console.log(`Generated ${Object.keys(previews).length} orbit previews.`);
