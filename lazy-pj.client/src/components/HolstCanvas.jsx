import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FALLBACK_PRESET,
    isStateFinite,
    stepBodiesInPlace,
    toSimBodies,
    computeEffectiveDt,
    totalEnergy,
} from '../utils/physics';
import { classify } from '../utils/classifier';
import { PRESETS } from '../utils/presets';

const MIN_SPEED = 0.1;
const MAX_SPEED = 5;
const SPEED_STEP = 0.1;
const MAX_BODIES = 3;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const MAX_STEPS_PER_FRAME = 4000;
const GRID_STEP = 60;
const MIN_ZOOM = 10;
const MAX_ZOOM = 1000;
const BASE_ZOOM = 120;
const MIN_G = 0.1;
const MAX_G = 5;
const G_STEP = 0.1;
const MIN_SOFTENING = 0;
const MAX_SOFTENING = 1;
const SOFTENING_STEP = 0.01;
const BASE_DT = 0.0001;
const TIME_STEP = 0.01;

const OUTCOME_LABELS = {
    collision: 'Столкновение',
    ejection: 'Выброс',
    stable: 'Стабильная орбита',
    unknown: 'Анализ...',
};

const COLORS = ['#ff4d4d', '#4d6bfe', '#4dff88'];

function bodyRadius(mass) {
    return Math.max(6, Math.min(25, 6 + 5 * Math.cbrt(Math.max(mass, 0.0001))));
}

function cloneBodies(bodies) {
    return bodies.map((b) => ({ ...b }));
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return '0';
    return String(Number(value.toFixed(4)));
}

function formatSimTime(seconds) {
    return `${seconds.toFixed(2)} с`;
}

function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const [drafts, setDrafts] = useState(() => ({
        m: formatNumber(menu.body.m),
        x: formatNumber(menu.body.x),
        y: formatNumber(menu.body.y),
        vx: formatNumber(menu.body.vx),
        vy: formatNumber(menu.body.vy),
    }));

    const handleChange = (key, raw) => {
        setDrafts((prev) => ({ ...prev, [key]: raw }));
        const value = Number(raw.replace(',', '.'));
        if (raw.trim() !== '' && Number.isFinite(value) && (key !== 'm' || value > 0)) {
            onApply(menu.index, { [key]: value });
        }
    };

    return (
        <div 
            className="body-menu" 
            style={{ left: Math.min(menu.x, window.innerWidth - 260), top: Math.min(menu.y, window.innerHeight - 350) }} 
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="body-menu-header">
                <span>Планета {menu.index + 1}</span>
                <button onClick={onClose} style={{ padding: '0 8px', borderRadius: '50%', background: 'transparent', border: 'none' }}>X</button>
            </div>
            <div className="body-menu-grid">
                {['m', 'x', 'y', 'vx', 'vy'].map((key) => (
                    <div key={key} className="body-menu-field">
                        <label>{key === 'm' ? 'Масса' : key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'vx' ? 'Скор. X' : 'Скор. Y'}</label>
                        <input type="text" value={drafts[key]} onChange={(e) => handleChange(key, e.target.value)} />
                    </div>
                ))}
            </div>
            <div className="body-menu-actions">
                <button onClick={() => onDelete(menu.index)} style={{ color: '#ff4d4d', borderColor: '#ff4d4d' }}>Удалить</button>
                <button onClick={onClose} className="btn-primary">Готово</button>
            </div>
        </div>
    );
}

export function HolstCanvas() {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    const [running, setRunning] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [outcome, setOutcome] = useState('unknown');
    const [bodyCount, setBodyCount] = useState(FALLBACK_PRESET.bodies.length);
    const [menu, setMenu] = useState(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

    const [gravity, setGravity] = useState(FALLBACK_PRESET.g ?? 1);
    const [softening, setSoftening] = useState(FALLBACK_PRESET.softening ?? 0.01);

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const gravityRef = useRef(gravity);
    const softeningRef = useRef(softening);
    const dtRef = useRef(BASE_DT);

    const cameraRef = useRef({ x: 0, y: 0, zoom: BASE_ZOOM });

    const stateRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const setupRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const trailsRef = useRef([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);

    const dragRef = useRef({ kind: 'none' });
    const selectedRef = useRef(null);
    const starsRef = useRef([]);

    if (starsRef.current.length === 0) {
        for (let i = 0; i < 150; i++) {
            starsRef.current.push({
                x: Math.random(),
                y: Math.random(),
                size: Math.random() * 2,
                alpha: Math.random() * 0.5 + 0.2
            });
        }
    }

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { gravityRef.current = gravity; }, [gravity]);
    useEffect(() => { softeningRef.current = softening; }, [softening]);
    useEffect(() => { selectedRef.current = menu ? menu.index : null; }, [menu]);

    const syncTimeText = useCallback(() => {
        if (timeTextRef.current) timeTextRef.current.textContent = formatSimTime(simTimeRef.current);
    }, []);

    useEffect(() => { syncTimeText(); });

    const commitEdit = useCallback(() => {
        trailsRef.current = stateRef.current.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        setupRef.current = cloneBodies(stateRef.current);
        syncTimeText();
        setBodyCount(stateRef.current.length);
        setOutcome('unknown');
    }, [syncTimeText]);

    const setNewBodies = useCallback((bodies, g, softeningValue, dt) => {
        stateRef.current = cloneBodies(bodies);
        setupRef.current = cloneBodies(bodies);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        dtRef.current = dt > 0 ? dt : BASE_DT;
        setGravity(g);
        setSoftening(softeningValue);
        gravityRef.current = g;
        softeningRef.current = softeningValue;
        cameraRef.current = { x: 0, y: 0, zoom: BASE_ZOOM };
        syncTimeText();
        setBodyCount(bodies.length);
        setOutcome('unknown');
        setRunning(false);
    }, [syncTimeText]);

    const advanceOneStep = useCallback(() => {
        const state = stateRef.current;
        if (state.length !== MAX_BODIES) return;
        const H = computeEffectiveDt(state, gravityRef.current, softeningRef.current, dtRef.current);
        stepBodiesInPlace(state, gravityRef.current, softeningRef.current, H, 1);
        simTimeRef.current += H;
        trailClockRef.current += H;
        if (trailClockRef.current >= TRAIL_SAMPLE_TIME - 1e-9) {
            trailClockRef.current = 0;
            for (let i = 0; i < state.length; i++) {
                const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                trail.push({ x: state[i].x, y: state[i].y });
                if (trail.length > MAX_TRAIL_POINTS) trail.shift();
            }
        }
        setOutcome(classify(state, gravityRef.current, softeningRef.current));
        syncTimeText();
    }, [syncTimeText]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let raf = 0;
        let lastTime = performance.now();
        let cachedWidth = 0;
        let cachedHeight = 0;

        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            cachedWidth = rect.width;
            cachedHeight = rect.height;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const step = (realDt) => {
            const state = stateRef.current;
            if (!runningRef.current || state.length !== MAX_BODIES || realDt <= 0) return;

            for (let i = 0; i < state.length; i++) {
                const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                if (trail.length === 0) trail.push({ x: state[i].x, y: state[i].y });
            }

            const g = gravityRef.current;
            const soft = softeningRef.current;
            let budget = realDt * speedRef.current;
            let steps = 0;

            while (budget > 0 && steps < MAX_STEPS_PER_FRAME) {
                const H = computeEffectiveDt(state, g, soft, dtRef.current);
                if (H <= 0) break;
                stepBodiesInPlace(state, g, soft, H, 1);
                budget -= H;
                simTimeRef.current += H;
                trailClockRef.current += H;
                steps++;

                if (trailClockRef.current >= TRAIL_SAMPLE_TIME - 1e-9) {
                    trailClockRef.current = 0;
                    for (let i = 0; i < state.length; i++) {
                        const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                        trail.push({ x: state[i].x, y: state[i].y });
                        if (trail.length > MAX_TRAIL_POINTS) trail.shift();
                    }
                }
            }

            if (!isStateFinite(state)) {
                runningRef.current = false;
                setRunning(false);
                return;
            }

            setOutcome(classify(state, g, soft));
            syncTimeText();
        };

        const draw = () => {
            const width = cachedWidth;
            const height = cachedHeight;
            const cx = width / 2 + cameraRef.current.x;
            const cy = height / 2 + cameraRef.current.y;
            const k = cameraRef.current.zoom;
            const editing = !runningRef.current;

            ctx.clearRect(0, 0, width, height);

            starsRef.current.forEach(star => {
                ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                ctx.beginPath();
                ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridStep = GRID_STEP;
            if (gridStep > 5) {
                const startX = ((cx % gridStep) + gridStep) % gridStep;
                const startY = ((cy % gridStep) + gridStep) % gridStep;
                ctx.beginPath();
                for (let x = startX; x < width; x += gridStep) {
                    ctx.moveTo(x, 0); ctx.lineTo(x, height);
                }
                for (let y = startY; y < height; y += gridStep) {
                    ctx.moveTo(0, y); ctx.lineTo(width, y);
                }
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
            ctx.moveTo(0, cy); ctx.lineTo(width, cy);
            ctx.stroke();

            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            trailsRef.current.forEach((trail, i) => {
                const body = stateRef.current[i];
                if (!body || trail.length < 2) return;
                ctx.strokeStyle = COLORS[i % COLORS.length];
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.moveTo(cx + trail[0].x * k, cy - trail[0].y * k);
                for (let p = 1; p < trail.length; p++) {
                    ctx.lineTo(cx + trail[p].x * k, cy - trail[p].y * k);
                }
                ctx.stroke();
            });
            ctx.globalAlpha = 1.0;

            stateRef.current.forEach((b, i) => {
                const sx = cx + b.x * k;
                const sy = cy - b.y * k;
                const r = bodyRadius(b.m);

                if (editing) {
                    const tipX = sx + b.vx * 0.6 * k;
                    const tipY = sy - b.vy * 0.6 * k;
                    const len = Math.hypot(tipX - sx, tipY - sy);
                    if (len > r + 4) {
                        const angle = Math.atan2(tipY - sy, tipX - sx);
                        const head = 8;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(tipX, tipY);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo(tipX, tipY);
                        ctx.lineTo(tipX - head * Math.cos(angle - Math.PI / 6), tipY - head * Math.sin(angle - Math.PI / 6));
                        ctx.lineTo(tipX - head * Math.cos(angle + Math.PI / 6), tipY - head * Math.sin(angle + Math.PI / 6));
                        ctx.closePath();
                        ctx.fill();
                    }
                }

                ctx.fillStyle = COLORS[i % COLORS.length];
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (selectedRef.current === i) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]);
                    ctx.beginPath();
                    ctx.arc(sx, sy, r + 8, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        };

        const frame = (now) => {
            const realDt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
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
    }, [syncTimeText]);

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const toScreen = (b) => {
        const width = canvasRef.current.getBoundingClientRect().width;
        const height = canvasRef.current.getBoundingClientRect().height;
        const k = cameraRef.current.zoom;
        return {
            x: width / 2 + cameraRef.current.x + b.x * k,
            y: height / 2 + cameraRef.current.y - b.y * k,
        };
    };

    const toWorld = (mousePos) => {
        const width = canvasRef.current.getBoundingClientRect().width;
        const height = canvasRef.current.getBoundingClientRect().height;
        const k = cameraRef.current.zoom;
        return {
            x: (mousePos.x - width / 2 - cameraRef.current.x) / k,
            y: -(mousePos.y - height / 2 - cameraRef.current.y) / k,
        };
    };

    const hitBody = (mousePos) => {
        const bodies = stateRef.current;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            const clickRadius = Math.max(bodyRadius(bodies[i].m) + 20, 30);
            if (Math.hypot(mousePos.x - p.x, mousePos.y - p.y) <= clickRadius) {
                return i;
            }
        }
        return null;
    };

    const handleWheel = (e) => {
        e.preventDefault();
        const mousePos = getMousePos(e);
        const cam = cameraRef.current;
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * zoomFactor));
        if (newZoom === cam.zoom) return;

        const width = canvasRef.current.getBoundingClientRect().width;
        const height = canvasRef.current.getBoundingClientRect().height;
        const worldX = (mousePos.x - width / 2 - cam.x) / cam.zoom;
        const worldY = -(mousePos.y - height / 2 - cam.y) / cam.zoom;

        cam.zoom = newZoom;
        cam.x = mousePos.x - width / 2 - worldX * newZoom;
        cam.y = mousePos.y - height / 2 + worldY * newZoom;
    };

    const handlePointerDown = (e) => {
        if (e.target.closest('.body-menu') || e.target.closest('.sim-panel-wrapper') || e.target.closest('.top-navbar')) return;
        setMenu(null);
        e.currentTarget.setPointerCapture(e.pointerId);

        const mousePos = getMousePos(e);

        if (e.button === 1 || e.button === 2) {
            dragRef.current = { kind: 'pan', startX: mousePos.x, startY: mousePos.y, camX: cameraRef.current.x, camY: cameraRef.current.y };
            return;
        }

        if (e.button === 0 && !runningRef.current) {
            const bodyIndex = hitBody(mousePos);
            if (bodyIndex !== null) {
                const world = toWorld(mousePos);
                const b = stateRef.current[bodyIndex];
                dragRef.current = { kind: 'move', index: bodyIndex, dx: b.x - world.x, dy: b.y - world.y };
                return;
            }
            if (stateRef.current.length < MAX_BODIES) {
                const world = toWorld(mousePos);
                stateRef.current = [...stateRef.current, { m: 1, x: world.x, y: world.y, vx: 0, vy: 0 }];
                commitEdit();
                return;
            }
        }
    };

    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        if (drag.kind === 'none') return;

        const mousePos = getMousePos(e);

        if (drag.kind === 'pan') {
            cameraRef.current.x = drag.camX + (mousePos.x - drag.startX);
            cameraRef.current.y = drag.camY + (mousePos.y - drag.startY);
        } else if (drag.kind === 'move') {
            const world = toWorld(mousePos);
            stateRef.current = stateRef.current.map((b, i) => {
                if (i !== drag.index) return b;
                return { ...b, x: world.x + drag.dx, y: world.y + drag.dy };
            });
        }
    };

    const handlePointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        if (dragRef.current.kind === 'move') {
            commitEdit();
        }
        dragRef.current = { kind: 'none' };
    };

    const handleDoubleClick = (e) => {
        if (e.target.closest('.body-menu') || e.target.closest('.sim-panel-wrapper') || e.target.closest('.top-navbar')) return;
        const mousePos = getMousePos(e);
        const index = hitBody(mousePos);
        if (index === null) return;

        runningRef.current = false;
        setRunning(false);
        const p = toScreen(stateRef.current[index]);
        const rect = canvasRef.current.getBoundingClientRect();
        setMenu({
            index,
            x: p.x + rect.left + 20,
            y: p.y + rect.top + 20,
            body: { ...stateRef.current[index] },
        });
    };

    const handleApplyBody = (index, patch) => {
        stateRef.current = stateRef.current.map((b, i) => (i === index ? { ...b, ...patch } : b));
        commitEdit();
    };

    const handleDeleteBody = (index) => {
        stateRef.current = stateRef.current.filter((_, i) => i !== index);
        commitEdit();
        setMenu(null);
    };

    const resetCamera = () => {
        cameraRef.current = { x: 0, y: 0, zoom: BASE_ZOOM };
    };

    const renderEnergy = () => {
        const e = totalEnergy(stateRef.current, gravityRef.current, softeningRef.current);
        return Number.isFinite(e) ? e.toFixed(6) : '—';
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
            <div className="canvas-container" 
                 ref={containerRef}
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerCancel={handlePointerUp}
                 onDoubleClick={handleDoubleClick}
                 onWheel={handleWheel}
                 onContextMenu={(e) => e.preventDefault()}>
                <canvas ref={canvasRef} className="holst-sim-canvas" />
                {menu && (
                    <BodyMenu
                        menu={menu}
                        onApply={handleApplyBody}
                        onDelete={handleDeleteBody}
                        onClose={() => setMenu(null)}
                    />
                )}
            </div>

            <div className={`sim-panel-wrapper ${isPanelCollapsed ? 'collapsed' : ''}`}>
                <div className="sim-panel">
                    <div className="sim-panel-header" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
                        <div className="sim-panel-title">
                            <span style={{ color: running ? '#4dff88' : '#888' }}>●</span> 
                            Панель управления
                        </div>
                        <div className="sim-panel-toggle" style={{ transform: isPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▼
                        </div>
                    </div>

                    <div className="sim-row">
                        <button className="btn-primary" onClick={() => {
                            if (bodyCount === MAX_BODIES) setRunning(!running);
                        }} disabled={bodyCount !== MAX_BODIES}>
                            {running ? 'Пауза' : 'Запуск'}
                        </button>
                        <button onClick={() => {
                            setRunning(false);
                            stateRef.current = cloneBodies(setupRef.current);
                            trailsRef.current = stateRef.current.map(() => []);
                            simTimeRef.current = 0;
                            setOutcome('unknown');
                            syncTimeText();
                        }}>Сброс</button>
                        <button onClick={() => {
                            setRunning(false);
                            stateRef.current = [];
                            commitEdit();
                        }}>Очистить</button>
                        <button onClick={advanceOneStep} disabled={running || bodyCount !== MAX_BODIES}>Шаг</button>
                        <button onClick={resetCamera}>Центр</button>

                        <span className="sim-label" style={{ marginLeft: 'auto' }}>
                            Исход: <b style={{ color: outcome === 'stable' ? '#4dff88' : outcome === 'collision' || outcome === 'ejection' ? '#ff4d4d' : '#fff' }}>
                                {OUTCOME_LABELS[outcome]}
                            </b>
                        </span>
                        <span className="sim-label">
                            Время: <span className="sim-time" ref={timeTextRef}>0.00 с</span>
                        </span>
                    </div>

                    <div className="sim-row" style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                        <span className="sim-label">Скорость:</span>
                        <input type="range" min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                        <span className="sim-value">{speed.toFixed(1)}x</span>
                    </div>

                    <div className="sim-row" style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                        <span className="sim-label">Гравитация (G):</span>
                        <input type="range" min={MIN_G} max={MAX_G} step={G_STEP} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} />
                        <span className="sim-value">{gravity.toFixed(1)}</span>

                        <span className="sim-label" style={{ marginLeft: '20px' }}>Сглаживание:</span>
                        <input type="range" min={MIN_SOFTENING} max={MAX_SOFTENING} step={SOFTENING_STEP} value={softening} onChange={(e) => setSoftening(Number(e.target.value))} />
                        <span className="sim-value">{softening.toFixed(2)}</span>
                    </div>

                    <div className="sim-row" style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                        <span className="sim-label">Энергия:</span>
                        <span className="sim-value" style={{ minWidth: '100px' }}>{renderEnergy()}</span>
                    </div>

                    <div className="sim-row" style={{ borderTop: '1px solid #333', paddingTop: '15px' }}>
                        <span className="sim-label">Пресеты:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {PRESETS.map((p) => (
                                <button key={p.name} onClick={() => setNewBodies(p.bodies, p.g, p.softening, p.dt)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}