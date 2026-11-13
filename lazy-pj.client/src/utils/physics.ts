import type { BodyDto, PresetDetail } from '../types';

export interface SimBody {
    m: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface Acceleration {
    ax: number;
    ay: number;
}

export const FALLBACK_PRESET: PresetDetail = {
    id: 0,
    title: 'Восьмёрка',
    description: 'Демо-конфигурация Шенсине–Монтгомери',
    bodies: [
        { mass: 1, positionX: -0.97000436, positionY: 0.24308753, velocityX: 0.46620368, velocityY: 0.43236573 },
        { mass: 1, positionX: 0.97000436, positionY: -0.24308753, velocityX: 0.46620368, velocityY: 0.43236573 },
        { mass: 1, positionX: 0, positionY: 0, velocityX: -0.93240737, velocityY: -0.86473146 },
    ],
    g: 1,
    softening: 0.001,
    dt: 0.001,
    outcome: 'figure8',
    authorName: 'Cosmos lab',
    authorId: 0,
    canEdit: false,
};

export function toSimBodies(bodies: BodyDto[]): SimBody[] {
    return bodies.map((b) => ({
        m: b.mass,
        x: b.positionX,
        y: b.positionY,
        vx: b.velocityX,
        vy: b.velocityY,
    }));
}

function accelerations(state: SimBody[], G: number, eps2: number): Acceleration[] {
    const acc: Acceleration[] = state.map(() => ({ ax: 0, ay: 0 }));
    for (let i = 0; i < state.length; i++) {
        for (let j = i + 1; j < state.length; j++) {
            const dx = state[j].x - state[i].x;
            const dy = state[j].y - state[i].y;
            const r2 = dx * dx + dy * dy + eps2;
            const inv = 1 / (r2 * Math.sqrt(r2));
            const fi = G * state[j].m * inv;
            const fj = G * state[i].m * inv;
            acc[i].ax += dx * fi;
            acc[i].ay += dy * fi;
            acc[j].ax -= dx * fj;
            acc[j].ay -= dy * fj;
        }
    }
    return acc;
}

export function rk4Step(state: SimBody[], G: number, softening: number, dt: number): SimBody[] {
    const eps2 = softening * softening;
    const half = dt / 2;

    const k1 = accelerations(state, G, eps2);
    const s2 = state.map((b, i) => ({
        m: b.m,
        x: b.x + b.vx * half,
        y: b.y + b.vy * half,
        vx: b.vx + k1[i].ax * half,
        vy: b.vy + k1[i].ay * half,
    }));

    const k2 = accelerations(s2, G, eps2);
    const s3 = state.map((b, i) => ({
        m: b.m,
        x: b.x + s2[i].vx * half,
        y: b.y + s2[i].vy * half,
        vx: b.vx + k2[i].ax * half,
        vy: b.vy + k2[i].ay * half,
    }));

    const k3 = accelerations(s3, G, eps2);
    const s4 = state.map((b, i) => ({
        m: b.m,
        x: b.x + s3[i].vx * dt,
        y: b.y + s3[i].vy * dt,
        vx: b.vx + k3[i].ax * dt,
        vy: b.vy + k3[i].ay * dt,
    }));

    const k4 = accelerations(s4, G, eps2);
    const sixth = dt / 6;

    return state.map((b, i) => ({
        m: b.m,
        x: b.x + sixth * (b.vx + 2 * s2[i].vx + 2 * s3[i].vx + s4[i].vx),
        y: b.y + sixth * (b.vy + 2 * s2[i].vy + 2 * s3[i].vy + s4[i].vy),
        vx: b.vx + sixth * (k1[i].ax + 2 * k2[i].ax + 2 * k3[i].ax + k4[i].ax),
        vy: b.vy + sixth * (k1[i].ay + 2 * k2[i].ay + 2 * k3[i].ay + k4[i].ay),
    }));
}

export function isStateFinite(state: SimBody[]): boolean {
    return state.every(
        (b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.vx) && Number.isFinite(b.vy)
    );
}
