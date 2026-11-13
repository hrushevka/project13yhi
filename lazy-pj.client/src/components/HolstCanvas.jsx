import { useCallback, useEffect, useRef, useState } from 'react';
import { FALLBACK_PRESET, isStateFinite, minPairTimescale, stepBodiesInPlace, toSimBodies } from '../utils/physics';
import { classify } from '../utils/classifier';
import { PRESETS } from '../utils/presets';

const MIN_SPEED = 0.1;
const MAX_SPEED = 5;
const SPEED_STEP = 0.1;
const MAX_BODIES = 3;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const MAX_STEPS_PER_FRAME = 6000;
const GRID_STEP = 28;

const OUTCOME_LABELS = {
    collision: 'Столкновение',
    ejection: 'Выброс',
    stable: 'Стабильная',
    unknown: '—',
};

const COLORS = ['#e74c3c', '#3498db', '#2ecc71'];

function bodyRadius(mass) {
    return Math.max(6, Math.min(22, 5 + 4 * Math.cbrt(Math.max(mass, 0.0001))));
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
            style={{ left: Math.min(menu.x, window.innerWidth - 240), top: Math.min(menu.y, window.innerHeight - 300) }} 
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="body-menu-header">
                <span>Тело {menu.index + 1}</span>
                <button onClick={onClose} style={{ padding: '0 5px' }}>X</button>
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
                <button onClick={() => onDelete(menu.index)}>Удалить</button>
                <button onClick={onClose}>Готово</button>
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

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const configRef = useRef({ g: 1, softening: 0, dt: 0.0001 });
    
    const stateRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const setupRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const trailsRef = useRef([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);
    
    const dragRef = useRef({ kind: 'none' });
    const selectedRef = useRef(null);

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
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

    const setNewBodies = useCallback((bodies, g, softening, dt) => {
        stateRef.current = cloneBodies(bodies);
        setupRef.current = cloneBodies(bodies);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        configRef.current = { g, softening, dt };
        syncTimeText();
        setBodyCount(bodies.length);
        setOutcome('unknown');
        setRunning(false);
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
            const cfg = configRef.current;
            const state = stateRef.current;
            if (!runningRef.current || state.length !== MAX_BODIES || realDt <= 0) return;

            for (let i = 0; i < state.length; i++) {
                const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                if (trail.length === 0) trail.push({ x: state[i].x, y: state[i].y });
            }

            let remaining = realDt * speedRef.current;
            const baseMaxDt = Math.max(0.00005, Math.min(cfg.dt > 0 ? cfg.dt : 0.001, 0.005));
            let stepBudget = MAX_STEPS_PER_FRAME;

            while (remaining > 1e-12 && stepBudget > 0) {
                const tillTrail = Math.max(1e-6, TRAIL_SAMPLE_TIME - trailClockRef.current);
                const chunkDt = Math.min(remaining, tillTrail);
                const minTau = minPairTimescale(state, cfg.g, cfg.softening);
                const safeMaxDt = Math.min(baseMaxDt, Math.max(0.00001, 0.04 * minTau));
                const neededSteps = Math.max(1, Math.ceil(chunkDt / safeMaxDt));
                const subSteps = Math.min(stepBudget, neededSteps);
                const stepDt = chunkDt / neededSteps;
                const integratedDt = stepDt * subSteps;

                stepBodiesInPlace(state, cfg.g, cfg.softening, stepDt, subSteps);
                stepBudget -= subSteps;
                remaining -= integratedDt;
                simTimeRef.current += integratedDt;
                trailClockRef.current += integratedDt;

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

            setOutcome(classify(state, cfg.g, cfg.softening));
            syncTimeText();
        };

        const draw = () => {
            const width = cachedWidth;
            const height = cachedHeight;
            const cx = width / 2;
            const cy = height / 2;
            const k = 120;
            const editing = !runningRef.current;

            ctx.clearRect(0, 0, width, height);

            ctx.strokeStyle = '#e0e0e0';
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

            ctx.strokeStyle = '#888';
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
                ctx.beginPath();
                ctx.moveTo(cx + trail[0].x * k, cy - trail[0].y * k);
                for (let p = 1; p < trail.length; p++) {
                    ctx.lineTo(cx + trail[p].x * k, cy - trail[p].y * k);
                }
                ctx.stroke();
            });

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
                        ctx.strokeStyle = '#000';
                        ctx.fillStyle = '#000';
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

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.stroke();

                if (selectedRef.current === i) {
                    ctx.strokeStyle = 'blue';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(sx, sy, r + 3, 0, Math.PI * 2);
                    ctx.stroke();
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
        const k = 120;
        return {
            x: width / 2 + b.x * k,
            y: height / 2 - b.y * k,
        };
    };

    const toWorld = (mousePos) => {
        const width = canvasRef.current.getBoundingClientRect().width;
        const height = canvasRef.current.getBoundingClientRect().height;
        const k = 120;
        return {
            x: (mousePos.x - width / 2) / k,
            y: -(mousePos.y - height / 2) / k,
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

    const handlePointerDown = (e) => {
        if (e.target.closest('.body-menu')) return;
        if (e.button !== 0 && e.button !== 1) return;
        setMenu(null);
        e.currentTarget.setPointerCapture(e.pointerId);

        const mousePos = getMousePos(e);

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

        if (drag.kind === 'move') {
            const mousePos = getMousePos(e);
            const world = toWorld(mousePos);
            stateRef.current = stateRef.current.map((b, i) => {
                if (i !== drag.index) return b;
                return { ...b, x: world.x + drag.dx, y: world.y + drag.dy };
            });
            commitEdit();
        }
    };

    const handlePointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        dragRef.current = { kind: 'none' };
    };

    const handleDoubleClick = (e) => {
        if (e.target.closest('.body-menu')) return;
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', userSelect: 'none' }}>
            <div className="canvas-container" 
                 ref={containerRef}
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerCancel={handlePointerUp}
                 onDoubleClick={handleDoubleClick}>
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

            <div className="sim-panel">
                <div className="sim-row">
                    <button className="btn-primary" onClick={() => {
                        if (bodyCount === MAX_BODIES) setRunning(!running);
                    }} disabled={bodyCount !== MAX_BODIES}>
                        {running ? 'Пауза' : 'Старт'}
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

                    <span style={{ marginLeft: '20px' }}>Исход: <b>{OUTCOME_LABELS[outcome]}</b></span>
                    <span>Время: <span className="sim-time" ref={timeTextRef}>0.00 с</span></span>
                </div>

                <div className="sim-row">
                    <span className="sim-label">Скорость:</span>
                    <input type="range" min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
                    <span className="sim-value">{speed.toFixed(1)}x</span>
                    
                    <span className="sim-label" style={{ marginLeft: '20px' }}>Пресеты:</span>
                    {PRESETS.map((p) => (
                        <button key={p.name} onClick={() => setNewBodies(p.bodies, p.g, p.softening, p.dt)}>
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}