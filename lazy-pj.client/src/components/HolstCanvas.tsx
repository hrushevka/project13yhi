import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { api } from '../api';
import type { PresetDetail } from '../types';
import { FALLBACK_PRESET, isStateFinite, rk4Step, toSimBodies } from '../utils/physics';
import type { SimBody } from '../utils/physics';

interface HolstCanvasProps {
    theme: 'dark' | 'light';
}

interface ThemeColors {
    bodies: string[];
    trailAlpha: number;
    label: string;
}

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];
const MAX_TRAIL_POINTS = 700;
const TRAIL_SAMPLE_TIME = 0.012;
const MAX_STEPS_PER_FRAME = 6000;

function readThemeColors(): ThemeColors {
    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    return {
        bodies: [
            pick('--body-color-1', '#E39A7B'),
            pick('--body-color-2', '#FDD7A6'),
            pick('--body-color-3', '#8FB3C9'),
        ],
        trailAlpha: Number(pick('--trail-alpha', '0.55')) || 0.55,
        label: pick('--text-secondary', '#F7E4C8'),
    };
}

function hexToRgba(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) {
        return hex;
    }
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function computeUnitPx(preset: PresetDetail, width: number, height: number): number {
    const extent = preset.bodies.reduce(
        (max, b) => Math.max(max, Math.abs(b.positionX), Math.abs(b.positionY)),
        0
    );
    const safeExtent = extent > 0 ? extent : 1;
    return (Math.min(width, height) * 0.28) / safeExtent;
}

export function HolstCanvas({ theme }: HolstCanvasProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [preset, setPreset] = useState<PresetDetail>(FALLBACK_PRESET);
    const [source, setSource] = useState<'loading' | 'server' | 'demo'>('loading');
    const [simTime, setSimTime] = useState(0);

    const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
    const offsetRef = useRef(offset);
    const scaleRef = useRef(scale);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const presetRef = useRef<PresetDetail>(FALLBACK_PRESET);
    const stateRef = useRef<SimBody[]>(toSimBodies(FALLBACK_PRESET.bodies));
    const trailsRef = useRef<{ x: number; y: number }[][]>([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);
    const unitPxRef = useRef(180);
    const colorsRef = useRef<ThemeColors | null>(null);

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
        colorsRef.current = readThemeColors();
    }, [theme]);

    const applyPreset = useCallback((next: PresetDetail) => {
        presetRef.current = next;
        stateRef.current = toSimBodies(next.bodies);
        trailsRef.current = next.bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        unitPxRef.current = computeUnitPx(next, window.innerWidth, window.innerHeight);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const list = await api.getPublicPresets();
            for (const item of list) {
                const detail = await api.getPresetById(item.id);
                if (detail) {
                    if (!cancelled) {
                        applyPreset(detail);
                        setPreset(detail);
                        setSource('server');
                        setSimTime(0);
                    }
                    return;
                }
            }
            if (!cancelled) {
                applyPreset(FALLBACK_PRESET);
                setPreset(FALLBACK_PRESET);
                setSource('demo');
            }
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

        const frame = (now: number) => {
            const realDt = Math.min(0.05, (now - lastTime) / 1000);
            lastTime = now;

            const current = presetRef.current;

            if (runningRef.current) {
                accumulator += realDt * speedRef.current;
                let steps = Math.floor(accumulator / current.dt);
                if (steps > MAX_STEPS_PER_FRAME) {
                    steps = MAX_STEPS_PER_FRAME;
                    accumulator = 0;
                } else {
                    accumulator -= steps * current.dt;
                }

                let state = stateRef.current;
                for (let s = 0; s < steps; s++) {
                    state = rk4Step(state, current.g, current.softening, current.dt);
                    simTimeRef.current += current.dt;
                    trailClockRef.current += current.dt;
                    if (trailClockRef.current >= TRAIL_SAMPLE_TIME) {
                        trailClockRef.current = 0;
                        state.forEach((b, i) => {
                            const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                            trail.push({ x: b.x, y: b.y });
                            if (trail.length > MAX_TRAIL_POINTS) {
                                trail.shift();
                            }
                        });
                    }
                }

                if (!isStateFinite(state)) {
                    runningRef.current = false;
                    setRunning(false);
                } else {
                    stateRef.current = state;
                }

                uiClock += realDt;
                if (uiClock > 0.1) {
                    uiClock = 0;
                    setSimTime(simTimeRef.current);
                }
            }

            const width = window.innerWidth;
            const height = window.innerHeight;
            const cx = width / 2 + offsetRef.current.x;
            const cy = height / 2 + offsetRef.current.y;
            const k = unitPxRef.current * scaleRef.current;
            const colors = colorsRef.current || readThemeColors();

            ctx.clearRect(0, 0, width, height);

            trailsRef.current.forEach((trail, i) => {
                if (trail.length < 2) return;
                const color = colors.bodies[i % colors.bodies.length];
                ctx.lineWidth = 1.6;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const segments = trail.length - 1;
                for (let p = 1; p < trail.length; p++) {
                    const alpha = (p / segments) * colors.trailAlpha;
                    ctx.strokeStyle = hexToRgba(color, alpha);
                    ctx.beginPath();
                    ctx.moveTo(cx + trail[p - 1].x * k, cy - trail[p - 1].y * k);
                    ctx.lineTo(cx + trail[p].x * k, cy - trail[p].y * k);
                    ctx.stroke();
                }
            });

            stateRef.current.forEach((b, i) => {
                const color = colors.bodies[i % colors.bodies.length];
                const sx = cx + b.x * k;
                const sy = cy - b.y * k;
                const radius = Math.max(4, Math.min(22, 6 + 4 * Math.cbrt(Math.max(b.m, 0.0001)))) * Math.min(1.6, Math.max(0.6, scaleRef.current));

                const glow = ctx.createRadialGradient(sx, sy, radius * 0.4, sx, sy, radius * 3.2);
                glow.addColorStop(0, hexToRgba(color, 0.35));
                glow.addColorStop(1, hexToRgba(color, 0));
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(sx, sy, radius * 3.2, 0, Math.PI * 2);
                ctx.fill();

                const body = ctx.createRadialGradient(sx - radius * 0.35, sy - radius * 0.35, radius * 0.1, sx, sy, radius);
                body.addColorStop(0, hexToRgba('#FFFFFF', 0.85));
                body.addColorStop(0.35, color);
                body.addColorStop(1, hexToRgba(color, 0.9));
                ctx.fillStyle = body;
                ctx.beginPath();
                ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                ctx.fill();
            });

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
            const rect = container.getBoundingClientRect();
            const cursorX = e.clientX - rect.left - rect.width / 2;
            const cursorY = e.clientY - rect.top - rect.height / 2;
            const prevScale = scaleRef.current;
            const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
            const nextScale = Math.min(4, Math.max(0.2, Number((prevScale * zoomFactor).toFixed(3))));
            const ratio = nextScale / prevScale;
            setOffset((prev) => ({
                x: cursorX - (cursorX - prev.x) * ratio,
                y: cursorY - (cursorY - prev.y) * ratio,
            }));
            setScale(nextScale);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.button !== 1) return;
        if ((e.target as HTMLElement).closest('.holst-ui')) return;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
        };
    };

    const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        setOffset({
            x: dragStartRef.current.ox + (e.clientX - dragStartRef.current.x),
            y: dragStartRef.current.oy + (e.clientY - dragStartRef.current.y),
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
        }
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

    const handleToggleRun = () => {
        setRunning((prev) => !prev);
    };

    const handleResetSim = () => {
        setRunning(false);
        applyPreset(presetRef.current);
        setSimTime(0);
    };

    const gridStep = 28 * scale;
    const dotRadius = Math.max(1, 1.35 * Math.min(scale, 1.4));

    return (
        <div
            ref={containerRef}
            className={`holst-viewport ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <div
                className="holst-grid-layer"
                style={{
                    backgroundSize: `${gridStep}px ${gridStep}px`,
                    backgroundPosition: `calc(50% + ${offset.x}px) calc(50% + ${offset.y}px)`,
                    backgroundImage: `radial-gradient(circle, var(--holst-dot-color) ${dotRadius}px, transparent ${dotRadius + 0.5}px)`,
                }}
            />

            <canvas ref={canvasRef} className="holst-sim-canvas" />

            <div className="holst-ui sim-panel">
                <div className="sim-panel-title">
                    <span className="sim-preset-name">{preset.title}</span>
                    <span className="sim-preset-source">
                        {source === 'loading' ? 'загрузка…' : source === 'server' ? 'из базы' : 'демо'}
                    </span>
                </div>

                <div className="sim-panel-row">
                    <button
                        type="button"
                        className={`sim-btn ${running ? 'is-active' : ''}`}
                        onClick={handleToggleRun}
                        aria-label={running ? 'Пауза' : 'Старт'}
                        title={running ? 'Пауза' : 'Старт'}
                    >
                        {running ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M7 5v14l12-7z" />
                            </svg>
                        )}
                    </button>
                    <button
                        type="button"
                        className="sim-btn"
                        onClick={handleResetSim}
                        aria-label="Сброс"
                        title="Сброс"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 12a9 9 0 1 0 3-6.7" />
                            <polyline points="3 4 3 10 9 10" />
                        </svg>
                    </button>

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

            <div className="holst-ui holst-hud">
                <button
                    type="button"
                    className="holst-hud-btn"
                    onClick={() => adjustZoom(-0.15)}
                    title="Отдалить"
                    aria-label="Отдалить"
                >
                    −
                </button>
                <button
                    type="button"
                    className="holst-hud-scale"
                    onClick={resetView}
                    title="Сбросить масштаб и позицию"
                >
                    {Math.round(scale * 100)}%
                </button>
                <button
                    type="button"
                    className="holst-hud-btn"
                    onClick={() => adjustZoom(0.15)}
                    title="Приблизить"
                    aria-label="Приблизить"
                >
                    +
                </button>
            </div>
        </div>
    );
}
