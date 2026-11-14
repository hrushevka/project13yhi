import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FALLBACK_PRESET,
    isStateFinite,
    stepBodiesInPlace,
    toSimBodies,
    recenterToCM,
} from '../utils/physics';
import { classify } from '../utils/classifier';
import { PRESETS } from '../utils/presets';

const MIN_SPEED = 0.1;
const MAX_SPEED = 10;
const SPEED_STEP = 0.1;
const MAX_BODIES = 3;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const GRID_STEP = 60;
const MIN_ZOOM = 10;
const MAX_ZOOM = 1000;
const BASE_ZOOM = 120;
const MIN_G = 0.1;
const MAX_G = 5;
const G_STEP = 0.1;
const VEL_SCALE = 0.6;

const OUTCOME_LABELS = {
    collision: 'Столкновение',
    ejection: 'Выброс',
    stable: 'Стабильно',
    unknown: 'Пауза',
};

const COLORS = ['#ff4d4d', '#4d6bfe', '#4dff88'];

const STARS = Array.from({ length: 120 }, (_, i) => ({
    x: ((i * 73 + 19) % 997) / 997,
    y: ((i * 151 + 43) % 991) / 991,
    size: (i % 3) * 0.6 + 0.6,
    alpha: ((i * 37) % 50) / 100 + 0.15,
}));

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

function getVelocityHandleScreenPos(b, sx, sy, k, lineScale) {
    const r = bodyRadius(b.m) * lineScale;
    const tipX = sx + b.vx * VEL_SCALE * k;
    const tipY = sy - b.vy * VEL_SCALE * k;
    const len = Math.hypot(tipX - sx, tipY - sy);
    if (len < r + 10 * lineScale) {
        const angle = len > 1e-4 ? Math.atan2(tipY - sy, tipX - sx) : 0;
        const dist = r + 14 * lineScale;
        return {
            x: sx + Math.cos(angle) * dist,
            y: sy + Math.sin(angle) * dist,
            isZero: len <= 1e-4,
        };
    }
    return { x: tipX, y: tipY, isZero: false };
}

function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const [drafts, setDrafts] = useState(() => ({
        m: formatNumber(menu.body.m),
        x: formatNumber(menu.body.x),
        y: formatNumber(menu.body.y),
        vx: formatNumber(menu.body.vx),
        vy: formatNumber(menu.body.vy),
    }));

    const [pos, setPos] = useState(() => ({
        x: Math.max(10, Math.min(menu.x, window.innerWidth - 260)),
        y: Math.max(60, Math.min(menu.y, window.innerHeight - 320)),
    }));

    const dragOffsetRef = useRef(null);

    const handleChange = (key, raw) => {
        setDrafts((prev) => ({ ...prev, [key]: raw }));
        const value = Number(raw.replace(',', '.'));
        if (raw.trim() !== '' && Number.isFinite(value) && (key !== 'm' || value > 0)) {
            onApply(menu.index, { [key]: value });
        }
    };

    const handleMenuPointerDown = (e) => {
        e.stopPropagation();
        if (e.target.closest('input') || e.target.closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffsetRef.current = {
            dx: e.clientX - pos.x,
            dy: e.clientY - pos.y,
        };
    };

    const handleMenuPointerMove = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        const nextX = Math.max(10, Math.min(window.innerWidth - 250, e.clientX - dragOffsetRef.current.dx));
        const nextY = Math.max(10, Math.min(window.innerHeight - 280, e.clientY - dragOffsetRef.current.dy));
        setPos({ x: nextX, y: nextY });
    };

    const handleMenuPointerUp = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragOffsetRef.current = null;
    };

    return (
        <div
            className="body-menu"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handleMenuPointerDown}
            onPointerMove={handleMenuPointerMove}
            onPointerUp={handleMenuPointerUp}
            onPointerCancel={handleMenuPointerUp}
        >
            <div className="body-menu-header">
                <span>Тело {menu.index + 1}</span>
                <button type="button" onClick={onClose}>X</button>
            </div>
            <div className="body-menu-grid">
                {['m', 'x', 'y', 'vx', 'vy'].map((key) => (
                    <div key={key} className="body-menu-field">
                        <label>
                            {key === 'm'
                                ? 'Масса'
                                : key === 'x'
                                ? 'X'
                                : key === 'y'
                                ? 'Y'
                                : key === 'vx'
                                ? 'VX'
                                : 'VY'}
                        </label>
                        <input
                            type="text"
                            value={drafts[key]}
                            onChange={(e) => handleChange(key, e.target.value)}
                        />
                    </div>
                ))}
            </div>
            <div className="body-menu-actions">
                <button type="button" className="btn-danger" onClick={() => onDelete(menu.index)}>
                    Удалить
                </button>
                <button type="button" className="btn-primary" onClick={onClose}>
                    Готово
                </button>
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

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const gravityRef = useRef(gravity);
    const dtRef = useRef(FALLBACK_PRESET.dt || 0.0001);

    const cameraRef = useRef({ x: 0, y: 0, zoom: BASE_ZOOM });

    const stateRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const setupRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const trailsRef = useRef([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);

    const dragRef = useRef({ kind: 'none' });
    const selectedRef = useRef(null);

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { gravityRef.current = gravity; }, [gravity]);
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

    const setNewBodies = useCallback((bodies, g, newDt) => {
        stateRef.current = cloneBodies(bodies);
        recenterToCM(stateRef.current);
        setupRef.current = cloneBodies(stateRef.current);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        dtRef.current = newDt > 0 ? newDt : 0.0001;
        setGravity(g);
        gravityRef.current = g;
        cameraRef.current = { x: 0, y: 0, zoom: BASE_ZOOM };
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

        const step = () => {
            const state = stateRef.current;
            if (!runningRef.current || state.length !== MAX_BODIES) return;

            for (let i = 0; i < state.length; i++) {
                const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                if (trail.length === 0) trail.push({ x: state[i].x, y: state[i].y });
            }

            const g = gravityRef.current;
            const H = dtRef.current;
            const currentSpeed = Math.max(0.01, Number(speedRef.current) || 0.1);
            const stepCount = Math.max(1, Math.min(4000, Math.round((currentSpeed / 60) / H)));

            for (let s = 0; s < stepCount; s++) {
                stepBodiesInPlace(state, g, 0, H);
                recenterToCM(state);

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
            }

            if (!isStateFinite(state)) {
                runningRef.current = false;
                setRunning(false);
                return;
            }

            setOutcome(classify(state, g, 0));
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

            STARS.forEach((star) => {
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
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                }
                for (let y = startY; y < height; y += gridStep) {
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                }
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, height);
            ctx.moveTo(0, cy);
            ctx.lineTo(width, cy);
            ctx.stroke();

            const lineScale = k / BASE_ZOOM;

            ctx.lineWidth = Math.max(1, 2 * lineScale);
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
                const r = bodyRadius(b.m) * lineScale;

                if (editing) {
                    const handle = getVelocityHandleScreenPos(b, sx, sy, k, lineScale);
                    const angle = Math.atan2(handle.y - sy, handle.x - sx);
                    const head = Math.max(6, 8 * lineScale);

                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.lineWidth = Math.max(1, 1.5 * lineScale);
                    ctx.beginPath();
                    ctx.moveTo(sx, sy);
                    ctx.lineTo(handle.x, handle.y);
                    ctx.stroke();

                    ctx.beginPath();
                    ctx.moveTo(handle.x, handle.y);
                    ctx.lineTo(
                        handle.x - head * Math.cos(angle - Math.PI / 6),
                        handle.y - head * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.lineTo(
                        handle.x - head * Math.cos(angle + Math.PI / 6),
                        handle.y - head * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.closePath();
                    ctx.fill();

                    const handleSize = Math.max(6, 7 * lineScale);
                    ctx.fillStyle = '#d97706';
                    ctx.fillRect(
                        handle.x - handleSize / 2,
                        handle.y - handleSize / 2,
                        handleSize,
                        handleSize
                    );
                }

                ctx.fillStyle = COLORS[i % COLORS.length];
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = Math.max(1, 1 * lineScale);
                ctx.stroke();

                if (selectedRef.current === i) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = Math.max(1, 2 * lineScale);
                    ctx.setLineDash([5 * lineScale, 5 * lineScale]);
                    ctx.beginPath();
                    ctx.arc(sx, sy, r + 8 * lineScale, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        };

        const frame = () => {
            step();
            draw();
            raf = requestAnimationFrame(frame);
        };

        raf = requestAnimationFrame(frame);

        const handleNativeWheel = (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const cam = cameraRef.current;
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * zoomFactor));

            if (newZoom === cam.zoom) return;

            const worldX = (mouseX - rect.width / 2 - cam.x) / cam.zoom;
            const worldY = -(mouseY - rect.height / 2 - cam.y) / cam.zoom;

            cam.zoom = newZoom;
            cam.x = mouseX - rect.width / 2 - worldX * newZoom;
            cam.y = mouseY - rect.height / 2 + worldY * newZoom;
        };

        canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('wheel', handleNativeWheel);
        };
    }, [syncTimeText]);

    const getMousePos = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const toScreen = (b) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const k = cameraRef.current.zoom;
        return {
            x: rect.width / 2 + cameraRef.current.x + b.x * k,
            y: rect.height / 2 + cameraRef.current.y - b.y * k,
        };
    };

    const toWorld = (mousePos) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const k = cameraRef.current.zoom;
        return {
            x: (mousePos.x - rect.width / 2 - cameraRef.current.x) / k,
            y: -(mousePos.y - rect.height / 2 - cameraRef.current.y) / k,
        };
    };

    const hitVelocityHandle = (mousePos) => {
        const bodies = stateRef.current;
        const k = cameraRef.current.zoom;
        const lineScale = k / BASE_ZOOM;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            const handle = getVelocityHandleScreenPos(bodies[i], p.x, p.y, k, lineScale);
            if (Math.hypot(mousePos.x - handle.x, mousePos.y - handle.y) <= 14) {
                return i;
            }
        }
        return null;
    };

    const hitBody = (mousePos) => {
        const bodies = stateRef.current;
        const k = cameraRef.current.zoom;
        const lineScale = k / BASE_ZOOM;
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            const clickRadius = Math.max(bodyRadius(bodies[i].m) * lineScale + 10, 18);
            if (Math.hypot(mousePos.x - p.x, mousePos.y - p.y) <= clickRadius) {
                return i;
            }
        }
        return null;
    };

    const handlePointerDown = (e) => {
        if (
            e.target.closest('.body-menu') ||
            e.target.closest('.sim-panel-wrapper') ||
            e.target.closest('.top-navbar')
        ) {
            return;
        }
        setMenu(null);
        e.currentTarget.setPointerCapture(e.pointerId);

        const mousePos = getMousePos(e);

        if (e.button === 1 || e.button === 2) {
            dragRef.current = {
                kind: 'pan',
                startX: mousePos.x,
                startY: mousePos.y,
                camX: cameraRef.current.x,
                camY: cameraRef.current.y,
            };
            return;
        }

        if (e.button === 0 && !runningRef.current) {
            const velIndex = hitVelocityHandle(mousePos);
            if (velIndex !== null) {
                dragRef.current = { kind: 'velocity', index: velIndex };
                return;
            }

            const bodyIndex = hitBody(mousePos);
            if (bodyIndex !== null) {
                const world = toWorld(mousePos);
                const b = stateRef.current[bodyIndex];
                dragRef.current = {
                    kind: 'move',
                    index: bodyIndex,
                    dx: b.x - world.x,
                    dy: b.y - world.y,
                };
                return;
            }

            if (stateRef.current.length < MAX_BODIES) {
                const world = toWorld(mousePos);
                const newIndex = stateRef.current.length;
                stateRef.current = [
                    ...stateRef.current,
                    { m: 1, x: world.x, y: world.y, vx: 0, vy: 0 },
                ];
                commitEdit();
                dragRef.current = { kind: 'velocity', index: newIndex };
                return;
            }

            dragRef.current = {
                kind: 'pan',
                startX: mousePos.x,
                startY: mousePos.y,
                camX: cameraRef.current.x,
                camY: cameraRef.current.y,
            };
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
        } else if (drag.kind === 'velocity') {
            const world = toWorld(mousePos);
            stateRef.current = stateRef.current.map((b, i) => {
                if (i !== drag.index) return b;
                const vx = (world.x - b.x) / VEL_SCALE;
                const vy = (world.y - b.y) / VEL_SCALE;
                return {
                    ...b,
                    vx: Math.hypot(vx, vy) < 0.03 ? 0 : vx,
                    vy: Math.hypot(vx, vy) < 0.03 ? 0 : vy,
                };
            });
        }
    };

    const handlePointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (dragRef.current.kind === 'move' || dragRef.current.kind === 'velocity') {
            commitEdit();
        }
        dragRef.current = { kind: 'none' };
    };

    const handleDoubleClick = (e) => {
        if (
            e.target.closest('.body-menu') ||
            e.target.closest('.sim-panel-wrapper') ||
            e.target.closest('.top-navbar')
        ) {
            return;
        }
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

    const handleCustomSpeedChange = (e) => {
        const raw = e.target.value;
        if (raw === '') {
            setSpeed('');
            return;
        }
        const num = Number(raw);
        if (Number.isFinite(num) && num >= 0) {
            setSpeed(num);
        }
    };

    const handleCustomGravityChange = (e) => {
        const raw = e.target.value;
        if (raw === '') {
            setGravity('');
            return;
        }
        const num = Number(raw);
        if (Number.isFinite(num) && num >= 0) {
            setGravity(num);
        }
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', userSelect: 'none' }}>
            <div
                className="canvas-container"
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => e.preventDefault()}
            >
                <canvas ref={canvasRef} className="holst-sim-canvas" />
                {menu && (
                    <BodyMenu
                        key={menu.index}
                        menu={menu}
                        onApply={handleApplyBody}
                        onDelete={handleDeleteBody}
                        onClose={() => setMenu(null)}
                    />
                )}
            </div>

            <div className="sim-panel-wrapper">
                <div className="sim-panel">
                    <div className="sim-panel-top">
                        <div className="sim-top-actions">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => {
                                    if (bodyCount === MAX_BODIES) setRunning(!running);
                                }}
                                disabled={bodyCount !== MAX_BODIES}
                            >
                                {running ? 'Пауза' : 'Запуск'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRunning(false);
                                    stateRef.current = cloneBodies(setupRef.current);
                                    trailsRef.current = stateRef.current.map(() => []);
                                    simTimeRef.current = 0;
                                    trailClockRef.current = 0;
                                    setOutcome('unknown');
                                    syncTimeText();
                                }}
                            >
                                Сброс
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setRunning(false);
                                    stateRef.current = [];
                                    commitEdit();
                                }}
                            >
                                Очистить
                            </button>
                            <span className="sim-time" ref={timeTextRef}>0.00 с</span>
                        </div>

                        <button
                            type="button"
                            className="sim-toggle-btn"
                            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                        >
                            {isPanelCollapsed ? '▲' : '▼'}
                        </button>
                    </div>

                    {!isPanelCollapsed && (
                        <div className="sim-panel-body">
                            <div className="sim-row">
                                <span className="sim-label">Время:</span>
                                <input
                                    type="range"
                                    min={MIN_SPEED}
                                    max={MAX_SPEED}
                                    step={SPEED_STEP}
                                    value={Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(speed) || MIN_SPEED))}
                                    onChange={(e) => setSpeed(Number(e.target.value))}
                                />
                                <div className="sim-input-unit">
                                    <input
                                        type="number"
                                        step={SPEED_STEP}
                                        min="0.01"
                                        className="sim-value-input"
                                        value={speed}
                                        onChange={handleCustomSpeedChange}
                                    />
                                    <span>с</span>
                                </div>

                                <span className="sim-label">Гравитация:</span>
                                <input
                                    type="range"
                                    min={MIN_G}
                                    max={MAX_G}
                                    step={G_STEP}
                                    value={Math.min(MAX_G, Math.max(MIN_G, Number(gravity) || MIN_G))}
                                    onChange={(e) => setGravity(Number(e.target.value))}
                                />
                                <input
                                    type="number"
                                    step={G_STEP}
                                    min="0"
                                    className="sim-value-input"
                                    value={gravity}
                                    onChange={handleCustomGravityChange}
                                />

                                <span className="sim-status">
                                    {OUTCOME_LABELS[outcome]}
                                </span>
                            </div>

                            <div className="sim-row">
                                <div className="sim-presets">
                                    {PRESETS.map((p) => (
                                        <button
                                            key={p.name}
                                            type="button"
                                            onClick={() => setNewBodies(p.bodies, p.g, p.dt)}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}