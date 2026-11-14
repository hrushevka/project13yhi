// Exact homographic Newtonian solutions. Initial positions are at periapsis.
// For e=0 this reduces to uniform rotation; e>0 follows Kepler's equation.
export function evaluateCentralOrbit(preset, time, state) {
    const { omega, eccentricity: e = 0 } = preset.solution;
    const n = omega * (1 - e) ** 1.5;
    const mean = ((n * time) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    let E = mean;
    for (let i = 0; i < 20; i++) {
        const delta = (E - e * Math.sin(E) - mean) / (1 - e * Math.cos(E));
        E -= delta;
        if (Math.abs(delta) < 1e-14) break;
    }
    const scale = 1 / (1 - e);
    const root = Math.sqrt(1 - e * e);
    const cos = Math.cos(E), sin = Math.sin(E);
    const u = scale * (cos - e), v = scale * root * sin;
    const rate = n / (1 - e * cos);
    const du = -scale * sin * rate, dv = scale * root * cos * rate;
    preset.bodies.forEach((b, i) => {
        state[i].x = u * b.x - v * b.y;
        state[i].y = v * b.x + u * b.y;
        state[i].vx = du * b.x - dv * b.y;
        state[i].vy = dv * b.x + du * b.y;
    });
}

export function centralOrbitPeriod(preset) {
    return 2 * Math.PI / (preset.solution.omega * (1 - preset.solution.eccentricity) ** 1.5);
}
