import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../api';
import type { PresetDetail } from '../types';
import { FALLBACK_PRESET, isStateFinite, rk4Step, toSimBodies } from '../utils/physics';
import type { SimBody } from '../utils/physics';

interface HolstCanvasProps {
    theme: 'dark' | 'light';
}

interface SimConfig {
    title: string;
    g: number;
    softening: number;
    dt: number;
    source: 'loading' | 'server' | 'demo';
}

interface ThemeColors {
    bodies: string[];
    grid: string;
    origin: string;
    vector: string;
    ring: string;
    trailAlpha: number;
}

type DragMode =
    | { kind: 'none' }
    | { kind: 'pan'; startX: number; startY: number; ox: number; oy: number }
    | { kind: 'move'; index: number; dx: number; dy: number }
    | { kind: 'velocity'; index: number };

interface MenuState {
    index: number;
    openId: number;
    x: number;
    y: number;
    color: string;
    body: SimBody;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
const MAX_BODIES = 3;
const VELOCITY_SCALE = 0.6;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const MAX_STEPS_PER_FRAME = 6000;
const GRID_STEP = 28;
const HANDLE_RADIUS = 6;
const MENU_WIDTH = 248;
const MENU_HEIGHT = 300;

function readThemeColors(): ThemeColors {
    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return {
        bodies: [
            pick('--body-color-1', '#E39A7B'),
            pick('--body-color-2', '#FDD7A6'),
            pick('--body-color-3', '#8FB3C9'),
        ],
        grid: pick('--grid-dot', '#1F2C38'),
        origin: pick('--origin-color', '#2D4456'),
        vector: pick('--vector-color', '#C9B9A0'),
        ring: pick('--text-primary', '#F7E4C8'),
        trailAlpha: Number(pick('--trail-alpha', '0.45')) || 0.45,
    };
}

function bodyRadius(mass: number): number {
    return Math.max(6, Math.min(22, 5 + 4 * Math.cbrt(Math.max(mass, 0.0001))));
}

function cloneBodies(bodies: SimBody[]): SimBody[] {
    return bodies.map((b) => ({ ...b }));
}

function computeUnitPx(bodies: SimBody[]): number {
    const extent = bodies.reduce((max, b) => Math.max(max, Math.abs(b.x), Math.abs(b.y)), 0);
    const safeExtent = extent > 0 ? extent : 1;
    return (Math.min(window.innerWidth, window.innerHeight) * 0.28) / safeExtent;
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return String(Number(value.toFixed(4)));
}

interface BodyMenuProps {
    menu: MenuState;
    onApply: (index: number, patch: Partial<SimBody>) => void;
    onDelete: (index: number) => void;
    onClose: () => void;
}

type MenuField = 'm' | 'x' | 'y' | 'vx' | 'vy';

const MENU_FIELDS: { key: MenuField; label: string; full?: boolean }[] = [
    { key: 'm', label: 'Масса', full: true },
    { key: 'x', label: 'Позиция X' },
    { key: 'y', label: 'Позиция Y' },
    { key: 'vx', label: 'Скорость X' },
    { key: 'vy', label: 'Скорость Y' },
];

function BodyMenu({ menu, onApply, onDelete, onClose }: BodyMenuProps) {
    const [drafts, setDrafts] = useState<Record<MenuField, string>>(() => ({
        m: formatNumber(menu.body.m),
        x: formatNumber(menu.body.x),
        y: formatNumber(menu.body.y),
        vx: formatNumber(menu.body.vx),
        vy: formatNumber(menu.body.vy),
    }));

    const isValid = (key: MenuField, raw: string) => {
        const value = Number(raw.replace(',', '.'));
        if (raw.trim() === '' || !Number.isFinite(value)) return false;
        if (key === 'm' && value <= 0) return false;
        return true;
    };

    const handleChange = (key: MenuField, raw: string) => {
        setDrafts((prev) => ({ ...prev, [key]: raw }));
        if (isValid(key, raw)) {
            onApply(menu.index, { [key]: Number(raw.replace(',', '.')) });
        }
    };

    const left = Math.min(Math.max(12, menu.x), window.innerWidth - MENU_WIDTH - 12);
    const top = Math.min(Math.max(80, menu.y), window.innerHeight - MENU_HEIGHT - 12);

    return (
        <div
            className="holst-ui body-menu"
            style={{ left, top }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div className="body-menu-header">
                <span className="body-menu-title">
                    <span className="body-swatch" style={{ background: menu.color }} />
                    Тело {menu.index + 1}
                </span>
                <button type="button" className="body-menu-close" onClick={onClose} aria-label="Закрыть">
                    ×
                </button>
            </div>

            <div className="body-menu-grid">
                {MENU_FIELDS.map((field) => (
                    <div key={field.key} className={`body-menu-field ${field.full ? 'full' : ''}`}>
                        <label htmlFor={`body-${menu.index}-${field.key}`}>{field.label}</label>
                        <input
                            id={`body-${menu.index}-${field.key}`}
                            className={`input-sm ${isValid(field.key, drafts[field.key]) ? '' : 'is-invalid'}`}
                            type="text"
                            inputMode="decimal"
                            value={drafts[field.key]}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                        />
                    </div>
                ))}
            </div>

            <div className="body-menu-actions">
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onDelete(menu.index)}>
                    Удалить
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                    Готово
                </button>
            </div>
        </div>
    );
}

export function HolstCanvas({ theme }: HolstCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [config, setConfig] = useState<SimConfig>({
        title: FALLBACK_PRESET.title,
        g: FALLBACK_PRESET.g,
        softening: FALLBACK_PRESET.softening,
        dt: FALLBACK_PRESET.dt,
        source: 'loading',
    });
    const [simTime, setSimTime] = useState(0);
    const [bodyCount, setBodyCount] = useState(FALLBACK_PRESET.bodies.length);
    const [menu, setMenu] = useState<MenuState | null>(null);
    const [cursorMode, setCursorMode] = useState<'pan' | 'place' | 'grab'>('pan');

    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const configRef = useRef(config);
    const stateRef = useRef<SimBody[]>(toSimBodies(FALLBACK_PRESET.bodies));
    const setupRef = useRef<SimBody[]>(toSimBodies(FALLBACK_PRESET.bodies));
    const presetRef = useRef<PresetDetail>(FALLBACK_PRESET);
    const trailsRef = useRef<{ x: number; y: number }[][]>([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);
    const unitPxRef = useRef(180);
    const colorsRef = useRef<ThemeColors | null>(null);
    const dragRef = useRef<DragMode>({ kind: 'none' });
    const selectedRef = useRef<number | null>(null);
    const menuCounterRef = useRef(0);

    useEffect(() => {
        offsetRef.current = offset;
    }, [offset]);

    useEffect(() => {
        scaleRef.current = scale;
    }, [scale]);

    useEffect(() => {
        runningRef.current = running;
    }, [running]);

    useEffect(() => {
        speedRef.current = speed;
    }, [speed]);

    useEffect(() => {
        configRef.current = config;
    }, [config]);

    useEffect(() => {
        colorsRef.current = readThemeColors();
    }, [theme]);

    useEffect(() => {
        selectedRef.current = menu ? menu.index : null;
    }, [menu]);

    const commitEdit = useCallback(() => {
        trailsRef.current = stateRef.current.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        setupRef.current = cloneBodies(stateRef.current);
        setSimTime(0);
        setBodyCount(stateRef.current.length);
    }, []);

    const loadBodies = useCallback((bodies: SimBody[]) => {
        stateRef.current = cloneBodies(bodies);
        setupRef.current = cloneBodies(bodies);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        if (bodies.length > 0) {
            unitPxRef.current = computeUnitPx(bodies);
        }
        setSimTime(0);
        setBodyCount(bodies.length);
    }, []);

    const applyPreset = useCallback(
        (preset: PresetDetail, source: 'server' | 'demo') => {
            presetRef.current = preset;
            loadBodies(toSimBodies(preset.bodies));
            setConfig({
                title: preset.title,
                g: preset.g,
                softening: preset.softening,
                dt: preset.dt,
                source,
            });
        },
        [loadBodies]
    );

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const list = await api.getPublicPresets();
            for (const item of list) {
                const detail = await api.getPresetById(item.id);
                if (detail) {
                    if (!cancelled) applyPreset(detail, 'server');
                    return;
                }
            }
            if (!cancelled) applyPreset(FALLBACK_PRESET, 'demo');
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [applyPreset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let raf = 0;
        let lastTime = performance.now();
        let accumulator = 0;
        let uiClock = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        window.addEventListener('resize', resize);

        const step = (realDt: number) => {
            const cfg = configRef.current;
            if (!runningRef.current || stateRef.current.length !== MAX_BODIES) {
                accumulator = 0;
                return;
            }

            accumulator += realDt * speedRef.current;
            let steps = Math.floor(accumulator / cfg.dt);
            if (steps > MAX_STEPS_PER_FRAME) {
                steps = MAX_STEPS_PER_FRAME;
                accumulator = 0;
            } else {
                accumulator -= steps * cfg.dt;
            }

            let state = stateRef.current;
            for (let s = 0; s < steps; s++) {
                state = rk4Step(state, cfg.g, cfg.softening, cfg.dt);
                simTimeRef.current += cfg.dt;
                trailClockRef.current += cfg.dt;
                if (trailClockRef.current >= TRAIL_SAMPLE_TIME) {
                    trailClockRef.current = 0;
                    state.forEach((b, i) => {
                        const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                        trail.push({ x: b.x, y: b.y });
                        if (trail.length > MAX_TRAIL_POINTS) trail.shift();
                    });
                }
            }

            if (!isStateFinite(state)) {
                runningRef.current = false;
                setRunning(false);
                return;
            }

            stateRef.current = state;
            uiClock += realDt;
            if (uiClock > 0.1) {
                uiClock = 0;
                setSimTime(simTimeRef.current);
            }
        };

        const draw = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            const cx = width / 2 + offsetRef.current.x;
            const cy = height / 2 + offsetRef.current.y;
            const k = unitPxRef.current * scaleRef.current;
            const colors = colorsRef.current || readThemeColors();
            const editing = !runningRef.current;

            ctx.clearRect(0, 0, width, height);

            const gridStep = GRID_STEP * scaleRef.current;
            if (gridStep >= 8) {
                const dotR = Math.max(1, 1.2 * Math.min(scaleRef.current, 1.4));
                const startX = ((cx % gridStep) + gridStep) % gridStep;
                const startY = ((cy % gridStep) + gridStep) % gridStep;
                ctx.fillStyle = colors.grid;
                ctx.beginPath();
                for (let gx = startX; gx < width; gx += gridStep) {
                    for (let gy = startY; gy < height; gy += gridStep) {
                        ctx.moveTo(gx + dotR, gy);
                        ctx.arc(gx, gy, dotR, 0, Math.PI * 2);
                    }
                }
                ctx.fill();
            }

            ctx.strokeStyle = colors.origin;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx - 8, cy);
            ctx.lineTo(cx + 8, cy);
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx, cy + 8);
            ctx.stroke();

            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = colors.trailAlpha;
            trailsRef.current.forEach((trail, i) => {
                if (trail.length < 2) return;
                ctx.strokeStyle = colors.bodies[i % colors.bodies.length];
                ctx.beginPath();
                ctx.moveTo(cx + trail[0].x * k, cy - trail[0].y * k);
                for (let p = 1; p < trail.length; p++) {
                    ctx.lineTo(cx + trail[p].x * k, cy - trail[p].y * k);
                }
                ctx.stroke();
            });
            ctx.globalAlpha = 1;

            stateRef.current.forEach((b, i) => {
                const sx = cx + b.x * k;
                const sy = cy - b.y * k;
                const r = bodyRadius(b.m);

                if (editing) {
                    const tipX = sx + b.vx * VELOCITY_SCALE * k;
                    const tipY = sy - b.vy * VELOCITY_SCALE * k;
                    const len = Math.hypot(tipX - sx, tipY - sy);

                    if (len > r + 4) {
                        const angle = Math.atan2(tipY - sy, tipX - sx);
                        const head = 9;
                        ctx.strokeStyle = colors.vector;
                        ctx.fillStyle = colors.vector;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tipX - Math.cos(angle) * head * 0.6, tipY - Math.sin(angle) * head * 0.6);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(tipX, tipY);
                        ctx.lineTo(
                            tipX - head * Math.cos(angle - Math.PI / 7),
                            tipY - head * Math.sin(angle - Math.PI / 7)
                        );
                        ctx.lineTo(
                            tipX - head * Math.cos(angle + Math.PI / 7),
                            tipY - head * Math.sin(angle + Math.PI / 7)
                        );
                        ctx.closePath();
                        ctx.fill();
                    }

                    const handle = getHandlePosition(sx, sy, tipX, tipY, r);
                    ctx.fillStyle = colors.vector;
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, HANDLE_RADIUS * 0.6, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = colors.bodies[i % colors.bodies.length];
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fill();

                if (selectedRef.current === i) {
                    ctx.strokeStyle = colors.ring;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
                    ctx.stroke();
                }
            });
        };

        const frame = (now: number) => {
            const realDt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;
            step(realDt);
            draw();
            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            if ((e.target as HTMLElement).closest('.holst-ui')) return;
            e.preventDefault();
            const cursorX = e.clientX - window.innerWidth / 2;
            const cursorY = e.clientY - window.innerHeight / 2;
            const prevScale = scaleRef.current;
            const nextScale = Math.min(4, Math.max(0.2, Number((prevScale * (e.deltaY < 0 ? 1.08 : 0.92)).toFixed(3))));
            const ratio = nextScale / prevScale;
            const prev = offsetRef.current;
            const nextOffset = {
                x: cursorX - (cursorX - prev.x) * ratio,
                y: cursorY - (cursorY - prev.y) * ratio,
            };
            offsetRef.current = nextOffset;
            scaleRef.current = nextScale;
            setOffset(nextOffset);
            setScale(nextScale);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const toScreen = (b: SimBody) => {
        const k = unitPxRef.current * scaleRef.current;
        return {
            x: window.innerWidth / 2 + offsetRef.current.x + b.x * k,
            y: window.innerHeight / 2 + offsetRef.current.y - b.y * k,
        };
    };

    const toWorld = (sx: number, sy: number) => {
        const k = unitPxRef.current * scaleRef.current;
        return {
            x: (sx - window.innerWidth / 2 - offsetRef.current.x) / k,
            y: -(sy - window.innerHeight / 2 - offsetRef.current.y) / k,
        };
    };

    const hitBody = (sx: number, sy: number): number | null => {
        const bodies = stateRef.current;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            if (Math.hypot(sx - p.x, sy - p.y) <= Math.max(bodyRadius(bodies[i].m), 10) + 2) {
                return i;
            }
        }
        return null;
    };

    const hitHandle = (sx: number, sy: number): number | null => {
        const bodies = stateRef.current;
        const k = unitPxRef.current * scaleRef.current;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            const tipX = p.x + bodies[i].vx * VELOCITY_SCALE * k;
            const tipY = p.y - bodies[i].vy * VELOCITY_SCALE * k;
            const handle = getHandlePosition(p.x, p.y, tipX, tipY, bodyRadius(bodies[i].m));
            if (Math.hypot(sx - handle.x, sy - handle.y) <= HANDLE_RADIUS + 5) {
                return i;
            }
        }
        return null;
    };

    const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.holst-ui')) return;
        if (e.button !== 0 && e.button !== 1) return;

        setMenu(null);
        e.currentTarget.setPointerCapture(e.pointerId);

        if (e.button === 0 && !runningRef.current) {
            const handleIndex = hitHandle(e.clientX, e.clientY);
            if (handleIndex !== null) {
                dragRef.current = { kind: 'velocity', index: handleIndex };
                setCursorMode('grab');
                return;
            }

            const bodyIndex = hitBody(e.clientX, e.clientY);
            if (bodyIndex !== null) {
                const world = toWorld(e.clientX, e.clientY);
                const b = stateRef.current[bodyIndex];
                dragRef.current = { kind: 'move', index: bodyIndex, dx: b.x - world.x, dy: b.y - world.y };
                setCursorMode('grab');
                return;
            }

            if (stateRef.current.length < MAX_BODIES) {
                const world = toWorld(e.clientX, e.clientY);
                stateRef.current = [...stateRef.current, { m: 1, x: world.x, y: world.y, vx: 0, vy: 0 }];
                dragRef.current = { kind: 'velocity', index: stateRef.current.length - 1 };
                commitEdit();
                setCursorMode('grab');
                return;
            }
        }

        dragRef.current = {
            kind: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            ox: offsetRef.current.x,
            oy: offsetRef.current.y,
        };
        setCursorMode('grab');
    };

    const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (drag.kind === 'none') return;

        if (drag.kind === 'pan') {
            const next = {
                x: drag.ox + (e.clientX - drag.startX),
                y: drag.oy + (e.clientY - drag.startY),
            };
            offsetRef.current = next;
            setOffset(next);
            return;
        }

        const world = toWorld(e.clientX, e.clientY);
        stateRef.current = stateRef.current.map((b, i) => {
            if (i !== drag.index) return b;
            if (drag.kind === 'move') {
                return { ...b, x: world.x + drag.dx, y: world.y + drag.dy };
            }
            return { ...b, vx: (world.x - b.x) / VELOCITY_SCALE, vy: (world.y - b.y) / VELOCITY_SCALE };
        });
        commitEdit();
    };

    const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragRef.current = { kind: 'none' };
        setCursorMode(!runningRef.current && stateRef.current.length < MAX_BODIES ? 'place' : 'pan');
    };

    const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('.holst-ui')) return;
        const index = hitBody(e.clientX, e.clientY);
        if (index === null) return;

        runningRef.current = false;
        setRunning(false);
        const p = toScreen(stateRef.current[index]);
        const colors = colorsRef.current || readThemeColors();
        menuCounterRef.current += 1;
        setMenu({
            index,
            openId: menuCounterRef.current,
            x: p.x + bodyRadius(stateRef.current[index].m) + 16,
            y: p.y - 40,
            color: colors.bodies[index % colors.bodies.length],
            body: { ...stateRef.current[index] },
        });
    };

    const handleApplyBody = (index: number, patch: Partial<SimBody>) => {
        stateRef.current = stateRef.current.map((b, i) => (i === index ? { ...b, ...patch } : b));
        commitEdit();
    };

    const handleDeleteBody = (index: number) => {
        stateRef.current = stateRef.current.filter((_, i) => i !== index);
        commitEdit();
        setMenu(null);
        setCursorMode('place');
    };

    const handleToggleRun = () => {
        if (!running && stateRef.current.length !== MAX_BODIES) return;
        setMenu(null);
        const next = !running;
        runningRef.current = next;
        setRunning(next);
        setCursorMode(next ? 'pan' : stateRef.current.length < MAX_BODIES ? 'place' : 'pan');
    };

    const handleResetSim = () => {
        runningRef.current = false;
        setRunning(false);
        setMenu(null);
        stateRef.current = cloneBodies(setupRef.current);
        trailsRef.current = stateRef.current.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        setSimTime(0);
        setBodyCount(stateRef.current.length);
    };

    const handleRestorePreset = () => {
        runningRef.current = false;
        setRunning(false);
        setMenu(null);
        loadBodies(toSimBodies(presetRef.current.bodies));
        setCursorMode('pan');
    };

    const handleClear = () => {
        runningRef.current = false;
        setRunning(false);
        setMenu(null);
        stateRef.current = [];
        commitEdit();
        setCursorMode('place');
    };

    const adjustZoom = (delta: number) => {
        const nextScale = Math.min(4, Math.max(0.2, Number((scale + delta).toFixed(2))));
        const ratio = nextScale / scale;
        setOffset((prev) => ({ x: prev.x * ratio, y: prev.y * ratio }));
        setScale(nextScale);
    };

    const resetView = () => {
        setOffset({ x: 0, y: 0 });
        setScale(1);
    };

    const hint = running
        ? 'Пауза — чтобы менять тела. Двойной клик по телу — настройки'
        : bodyCount < MAX_BODIES
          ? `Кликните по холсту и тяните — тело и его скорость (${bodyCount}/${MAX_BODIES})`
          : 'Тяните тело — позиция, точку на стрелке — скорость, двойной клик — настройки';

    const sourceLabel = config.source === 'loading' ? 'загрузка' : config.source === 'server' ? 'из базы' : 'демо';

    return (
        <div
            ref={containerRef}
            className={`holst-viewport mode-${cursorMode}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleDoubleClick}
        >
            <canvas ref={canvasRef} className="holst-sim-canvas" />

            {menu && (
                <BodyMenu
                    key={menu.openId}
                    menu={menu}
                    onApply={handleApplyBody}
                    onDelete={handleDeleteBody}
                    onClose={() => setMenu(null)}
                />
            )}

            <div className="holst-bottom-dock">
                <div className="holst-dock-spacer" aria-hidden="true" />

                <div className="holst-ui sim-panel" onPointerDown={(e) => e.stopPropagation()}>
                    <div className="sim-panel-info">
                        <div className="sim-preset-line">
                            <span className="sim-preset-name">{config.title}</span>
                            <span className="sim-preset-source">{sourceLabel}</span>
                        </div>
                        <span className="sim-hint">{hint}</span>
                    </div>

                    <div className="sim-panel-controls">
                        <button
                            type="button"
                            className="sim-btn is-primary"
                            onClick={handleToggleRun}
                            disabled={!running && bodyCount !== MAX_BODIES}
                            aria-label={running ? 'Пауза' : 'Старт'}
                            title={running ? 'Пауза' : bodyCount !== MAX_BODIES ? 'Нужно 3 тела' : 'Старт'}
                        >
                            {running ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="5" width="4" height="14" />
                                    <rect x="14" y="5" width="4" height="14" />
                                </svg>
                            ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7 5v14l12-7z" />
                                </svg>
                            )}
                        </button>
                        <button type="button" className="sim-btn" onClick={handleResetSim} aria-label="Сброс" title="Вернуть к началу">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 12a9 9 0 1 0 3-6.7" />
                                <polyline points="3 4 3 10 9 10" />
                            </svg>
                        </button>
                        <button type="button" className="sim-btn" onClick={handleRestorePreset} aria-label="Пресет" title="Загрузить пресет заново">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="6" cy="16" r="3" />
                                <circle cx="18" cy="16" r="3" />
                                <circle cx="12" cy="6" r="3" />
                            </svg>
                        </button>
                        <button type="button" className="sim-btn" onClick={handleClear} aria-label="Очистить" title="Убрать все тела">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="4 7 20 7" />
                                <path d="M9 7V4h6v3" />
                                <path d="M6 7l1 13h10l1-13" />
                            </svg>
                        </button>

                        <span className="sim-divider" />

                        <div className="sim-speed-group" role="group" aria-label="Скорость симуляции">
                            {SPEED_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`sim-speed-btn ${speed === option ? 'is-active' : ''}`}
                                    onClick={() => setSpeed(option)}
                                >
                                    {option}×
                                </button>
                            ))}
                        </div>

                        <span className="sim-time">t = {simTime.toFixed(2)}</span>
                    </div>
                </div>

                <div className="holst-hud-slot">
                    <div className="holst-ui holst-hud" onPointerDown={(e) => e.stopPropagation()}>
                        <button type="button" className="holst-hud-btn" onClick={() => adjustZoom(-0.15)} aria-label="Отдалить">
                            −
                        </button>
                        <button type="button" className="holst-hud-scale" onClick={resetView} title="Сбросить масштаб и позицию">
                            {Math.round(scale * 100)}%
                        </button>
                        <button type="button" className="holst-hud-btn" onClick={() => adjustZoom(0.15)} aria-label="Приблизить">
                            +
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getHandlePosition(sx: number, sy: number, tipX: number, tipY: number, radius: number) {
    const len = Math.hypot(tipX - sx, tipY - sy);
    const minLen = radius + 12;
    if (len >= minLen) {
        return { x: tipX, y: tipY };
    }
    if (len < 0.001) {
        return { x: sx + minLen, y: sy };
    }
    return {
        x: sx + ((tipX - sx) / len) * minLen,
        y: sy + ((tipY - sy) / len) * minLen,
    };
}
