import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FALLBACK_PRESET,
    isStateFinite,
    stepBodiesInPlace,
    toSimBodies,
    totalEnergy,
    recenterToCM,
} from '../../utils/physics';
import { classify } from '../../utils/classifier';
import { BodyMenu } from './BodyMenu';
import { ControlPanel } from './ControlPanel';
import { bodyRadius, cloneBodies, formatSimTime, COLORS } from './utils';

const MAX_BODIES = 3;
const MAX_TRAIL_POINTS = 900;
const TRAIL_SAMPLE_TIME = 0.01;
const GRID_STEP = 60;
const MIN_ZOOM = 10;
const MAX_ZOOM = 1000;
const BASE_ZOOM = 120;

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
    const [dt, setDt] = useState(FALLBACK_PRESET.dt || 0.0001);

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const gravityRef = useRef(gravity);
    const softeningRef = useRef(softening);
    const dtRef = useRef(dt);

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
    useEffect(() => { dtRef.current = dt; }, [dt]);
    useEffect(() => { selectedRef.current = menu ? menu.index : null; }, [menu]);

    const syncTimeText = useCallback(() => {
        if (timeTextRef.current) timeTextRef.current.textContent = formatSimTime(simTimeRef.current);
    }, []);

    useEffect(() => { syncTimeText(); });

    const commitEdit = useCallback(() => {
        recenterToCM(stateRef.current);
        trailsRef.current = stateRef.current.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        setupRef.current = cloneBodies(stateRef.current);
        syncTimeText();
        setBodyCount(stateRef.current.length);
        setOutcome('unknown');
    }, [syncTimeText]);

    const setNewBodies = useCallback((bodies, g, softeningValue, newDt) => {
        stateRef.current = cloneBodies(bodies);
        recenterToCM(stateRef.current);
        setupRef.current = cloneBodies(stateRef.current);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        const cleanDt = newDt > 0 ? newDt : 0.0001;
        setDt(cleanDt);
        dtRef.current = cleanDt;
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
        
        const H = dtRef.current;
        stepBodiesInPlace(state, gravityRef.current, softeningRef.current, H);
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
        setOutcome(classify(state, gravityRef.current, softeningRef.current));
        syncTimeText();
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
            const soft = softeningRef.current;
            const H = dtRef.current;
            const stepCount = speedRef.current;

            for (let s = 0; s < stepCount; s++) {
                stepBodiesInPlace(state, g, soft, H);
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
                    const tipX = sx + b.vx * 0.6 * k;
                    const tipY = sy - b.vy * 0.6 * k;
                    const len = Math.hypot(tipX - sx, tipY - sy);
                    if (len > r + 4 * lineScale) {
                        const angle = Math.atan2(tipY - sy, tipX - sx);
                        const head = 8 * lineScale;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.lineWidth = Math.max(1, 1 * lineScale);
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
                dt={dt}
                setDt={setDt}
                gravity={gravity}
                setGravity={setGravity}
                softening={softening}
                setSoftening={setSoftening}
                onReset={() => {
                    setRunning(false);
                    stateRef.current = cloneBodies(setupRef.current);
                    trailsRef.current = stateRef.current.map(() => []);
                    simTimeRef.current = 0;
                    setOutcome('unknown');
                    syncTimeText();
                }}
                onClear={() => {
                    setRunning(false);
                    stateRef.current = [];
                    commitEdit();
                }}
                onStep={advanceOneStep}
                onCenter={resetCamera}
                onPresetSelect={(p) => setNewBodies(p.bodies, p.g, p.softening, p.dt)}
                renderEnergy={renderEnergy}
            />
        </div>
    );
}