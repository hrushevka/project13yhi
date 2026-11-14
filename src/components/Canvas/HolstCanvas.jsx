import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FALLBACK_PRESET,
    isStateFinite,
    stepBodiesInPlace,
    toSimBodies,
    recenterToCM,
} from '../../utils/physics';
import { classify } from '../../utils/classifier';
import { BodyMenu } from './BodyMenu';
import { ControlPanel } from './ControlPanel';
import {
    bodyRadius,
    cloneBodies,
    formatSimTime,
    getVelocityHandleScreenPos,
    roundFloat,
    toFloat,
    COLORS,
    VEL_SCALE,
} from './utils';

const MAX_BODIES = 3;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const GRID_STEP = 60;
const MIN_ZOOM = 10;
const MAX_ZOOM = 1000;
const BASE_ZOOM = 120;
const STAR_TILE_WORLD = 16;

const STARS = (() => {
    let seed = 13379001;
    const nextRand = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
    };
    return Array.from({ length: 180 }, () => ({
        u: nextRand(),
        v: nextRand(),
        size: nextRand() * 1.4 + 0.6,
        alpha: nextRand() * 0.5 + 0.15,
    }));
})();

function tileShift(tx, ty, salt) {
    let h = (tx * 374761393 + ty * 668265263 + salt * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

    const [gravity, setGravity] = useState(toFloat(FALLBACK_PRESET.g, 1));

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const gravityRef = useRef(gravity);
    const dtRef = useRef(toFloat(FALLBACK_PRESET.dt, 0.0001));

    const cameraRef = useRef({ x: 0, y: 0, zoom: BASE_ZOOM });

    const stateRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const setupRef = useRef(toSimBodies(FALLBACK_PRESET.bodies));
    const trailsRef = useRef([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);

    const dragRef = useRef({ kind: 'none' });
    const selectedRef = useRef(null);

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { speedRef.current = toFloat(speed, 1); }, [speed]);
    useEffect(() => { gravityRef.current = toFloat(gravity, 1); }, [gravity]);
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
        setMenu((prev) => {
            if (!prev || !stateRef.current[prev.index]) return null;
            return { ...prev, body: { ...stateRef.current[prev.index] } };
        });
    }, [syncTimeText]);

    const setNewBodies = useCallback((bodies, g, newDt) => {
        stateRef.current = cloneBodies(bodies);
        recenterToCM(stateRef.current);
        setupRef.current = cloneBodies(stateRef.current);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        const cleanDt = toFloat(newDt, 0.0001);
        dtRef.current = cleanDt > 0 ? cleanDt : 0.0001;
        const cleanG = toFloat(g, 1);
        setGravity(cleanG);
        gravityRef.current = cleanG;
        cameraRef.current = { x: 0, y: 0, zoom: BASE_ZOOM };
        syncTimeText();
        setBodyCount(bodies.length);
        setOutcome('unknown');
        setMenu(null);
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
            const currentSpeed = Math.max(0.01, toFloat(speedRef.current, 0.1));
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

            const lineScale = k / BASE_ZOOM;

            const worldMinX = -cx / k;
            const worldMaxX = (width - cx) / k;
            const worldMinY = (cy - height) / k;
            const worldMaxY = cy / k;

            const startTileX = Math.floor(worldMinX / STAR_TILE_WORLD);
            const endTileX = Math.floor(worldMaxX / STAR_TILE_WORLD);
            const startTileY = Math.floor(worldMinY / STAR_TILE_WORLD);
            const endTileY = Math.floor(worldMaxY / STAR_TILE_WORLD);

            const tilesCount = Math.max(
                1,
                (endTileX - startTileX + 1) * (endTileY - startTileY + 1)
            );
            const starsPerTile = Math.max(
                6,
                Math.min(STARS.length, Math.floor(500 / tilesCount))
            );

            for (let tx = startTileX; tx <= endTileX; tx++) {
                for (let ty = startTileY; ty <= endTileY; ty++) {
                    const shiftU = tileShift(tx, ty, 1);
                    const shiftV = tileShift(tx, ty, 2);
                    const baseWorldX = tx * STAR_TILE_WORLD;
                    const baseWorldY = ty * STAR_TILE_WORLD;

                    for (let s = 0; s < starsPerTile; s++) {
                        const star = STARS[s];
                        const u = (star.u + shiftU) % 1;
                        const v = (star.v + shiftV) % 1;
                        const wx = baseWorldX + u * STAR_TILE_WORLD;
                        const wy = baseWorldY + v * STAR_TILE_WORLD;
                        const sx = cx + wx * k;
                        const sy = cy - wy * k;

                        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;

                        ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
                        ctx.beginPath();
                        ctx.arc(sx, sy, Math.max(0.8, star.size), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

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

                if (editing) {
                    const handle = getVelocityHandleScreenPos(b, sx, sy, k);

                    if (!handle.isZero) {
                        const angle = Math.atan2(handle.y - sy, handle.x - sx);
                        const head = Math.max(6, 8 * lineScale);

                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
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
                    }

                    const dotRadius = Math.max(3.5, 4 * lineScale);
                    ctx.fillStyle = '#ffffff';
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
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
        for (let i = bodies.length - 1; i >= 0; i--) {
            const p = toScreen(bodies[i]);
            const handle = getVelocityHandleScreenPos(bodies[i], p.x, p.y, k);
            const hitRadius = handle.isZero ? 6 : 12;
            if (Math.hypot(mousePos.x - handle.x, mousePos.y - handle.y) <= hitRadius) {
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
            const clickRadius = Math.max(bodyRadius(bodies[i].m) * lineScale + 8, 14);
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
                    { m: 1, x: roundFloat(world.x, 4), y: roundFloat(world.y, 4), vx: 0, vy: 0 },
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
                return {
                    ...b,
                    x: roundFloat(world.x + drag.dx, 4),
                    y: roundFloat(world.y + drag.dy, 4),
                };
            });
        } else if (drag.kind === 'velocity') {
            const world = toWorld(mousePos);
            stateRef.current = stateRef.current.map((b, i) => {
                if (i !== drag.index) return b;
                const vx = (world.x - b.x) / VEL_SCALE;
                const vy = (world.y - b.y) / VEL_SCALE;
                const isSmall = Math.hypot(vx, vy) < 0.03;
                return {
                    ...b,
                    vx: isSmall ? 0 : roundFloat(vx, 4),
                    vy: isSmall ? 0 : roundFloat(vy, 4),
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
        const cleanPatch = {};
        for (const [k, v] of Object.entries(patch)) {
            cleanPatch[k] = toFloat(v, 0);
        }
        stateRef.current = stateRef.current.map((b, i) => (i === index ? { ...b, ...cleanPatch } : b));
        commitEdit();
    };

    const handleDeleteBody = (index) => {
        stateRef.current = stateRef.current.filter((_, i) => i !== index);
        commitEdit();
        setMenu(null);
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

            <ControlPanel
                isPanelCollapsed={isPanelCollapsed}
                setIsPanelCollapsed={setIsPanelCollapsed}
                running={running}
                setRunning={setRunning}
                bodyCount={bodyCount}
                maxBodies={MAX_BODIES}
                outcome={outcome}
                timeTextRef={timeTextRef}
                speed={speed}
                setSpeed={setSpeed}
                gravity={gravity}
                setGravity={setGravity}
                onReset={() => {
                    setRunning(false);
                    stateRef.current = cloneBodies(setupRef.current);
                    trailsRef.current = stateRef.current.map(() => []);
                    simTimeRef.current = 0;
                    trailClockRef.current = 0;
                    setOutcome('unknown');
                    syncTimeText();
                }}
                onClear={() => {
                    setRunning(false);
                    stateRef.current = [];
                    commitEdit();
                }}
                onPresetSelect={(p) => setNewBodies(p.bodies, p.g, p.dt)}
            />
        </div>
    );
}
