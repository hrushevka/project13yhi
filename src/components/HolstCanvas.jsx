import { useCallback, useEffect, useRef, useState } from 'react';
import {
    FALLBACK_PRESET,
    isStateFinite,
    stepSimulation,
    toSimBodies,
    recenterToCM,
    totalEnergy,
} from '../utils/physics';
import { PRESETS } from '../utils/presets';
import { preparePeriodicOrbit, evaluatePeriodicOrbit } from '../utils/periodic-orbits';
import { evaluateCentralOrbit } from '../utils/orbits';
import { classify } from '../utils/classifier';
import { createStats, resetStats, sampleStats } from '../utils/stats';
import { BodyMenu } from './BodyMenu';
import { ControlPanel } from './ControlPanel';
import { StatsPanel } from './StatsPanel';
import { SimulationReportModal, SimulationSetupMenu } from './SimulationMenu';
import { bodyRadius, cloneBodies, formatSimTime } from './utils';

const MAX_BODIES = 3;
const MIN_BODIES = 1;
const MAX_TRAIL_POINTS = 4000;
const TRAIL_SAMPLE_TIME = 0.01;
const GRID_STEP = 60;
const MIN_ZOOM = 10;
const MAX_ZOOM = 1000;
const BASE_ZOOM = 120;
const VEL_SCALE = 0.6;
const STAR_TILE_WORLD = 16;
const STATS_RENDER_EVERY = 10;

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

function roundFloat(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function getVelocityHandleScreenPos(b, sx, sy, k, r) {
    const tipX = sx + b.vx * VEL_SCALE * k;
    const tipY = sy - b.vy * VEL_SCALE * k;
    const distPx = Math.hypot(tipX - sx, tipY - sy);
    const isZero = Math.hypot(b.vx, b.vy) < 1e-4;
    if (isZero || distPx < r + 4) {
        const angle = isZero ? 0 : Math.atan2(tipY - sy, tipX - sx);
        const offset = r + Math.max(10, 12 * (k / BASE_ZOOM));
        return {
            x: sx + Math.cos(angle) * offset,
            y: sy + Math.sin(angle) * offset,
            isZero,
            extended: true,
        };
    }
    return { x: tipX, y: tipY, isZero: false, extended: false };
}

function computeSnapshotMetrics(state, t, g, softening) {
    let minDist = Infinity;
    let maxDist = 0;
    let maxSpeed = 0;
    let kinetic = 0;

    for (let i = 0; i < state.length; i++) {
        const v = Math.hypot(state[i].vx, state[i].vy);
        if (v > maxSpeed) maxSpeed = v;
        kinetic += 0.5 * state[i].m * v * v;
        for (let j = i + 1; j < state.length; j++) {
            const d = Math.hypot(state[j].x - state[i].x, state[j].y - state[i].y);
            if (d < minDist) minDist = d;
            if (d > maxDist) maxDist = d;
        }
    }

    if (!Number.isFinite(minDist)) minDist = 0;

    const d12 = state.length >= 2 ? Math.hypot(state[1].x - state[0].x, state[1].y - state[0].y) : 0;
    const d23 = state.length >= 3 ? Math.hypot(state[2].x - state[1].x, state[2].y - state[1].y) : d12;
    const d13 = state.length >= 3 ? Math.hypot(state[2].x - state[0].x, state[2].y - state[0].y) : d12;

    const v1 = state.length >= 1 ? Math.hypot(state[0].vx, state[0].vy) : 0;
    const v2 = state.length >= 2 ? Math.hypot(state[1].vx, state[1].vy) : 0;
    const v3 = state.length >= 3 ? Math.hypot(state[2].vx, state[2].vy) : 0;

    const totalE = totalEnergy(state, g, softening);
    const potential = Number.isFinite(totalE) ? totalE - kinetic : 0;

    return {
        t,
        d12,
        d23,
        d13,
        v1,
        v2,
        v3,
        minDist,
        maxDist,
        maxSpeed,
        kinetic,
        potential,
        totalE: Number.isFinite(totalE) ? totalE : kinetic,
    };
}

const V_FRAG = 1.0;
const Q_MIN = 0.2;
const N_DEBRIS = 6;
const DEBRIS_SPREAD = 0.8;
const DEBRIS_MASS_FRACTION = 0.4;
function attachContactRadius(body, idx) {
    const mass = body.m || 1;
    return {
        ...body,
        r: Math.max(0.01, 0.05 * Math.cbrt(mass)),
        id: body.id || `body-${idx}-${Math.random().toString(36).slice(2, 8)}`,
    };
}

function fittedZoom(preset, bodies, width, height) {
    const initial = preset?.bodies ?? bodies;
    const apoapsis = preset?.solution ? (1 + preset.solution.eccentricity) / (1 - preset.solution.eccentricity) : 1;
    const extent = Math.max(preset?.extent ?? 1.1, ...initial.map((b) => Math.hypot(b.x, b.y) * apoapsis));
    return Math.max(MIN_ZOOM, Math.min(BASE_ZOOM, width * 0.42 / extent, height * 0.28 / extent));
}

function readCanvasPalette() {
    const styles = getComputedStyle(document.documentElement);
    const get = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
    const trailAlpha = Number.parseFloat(get('--trail-alpha', '0.45'));
    return {
        starColor: get('--star-color', '#F7E4C8'),
        gridColor: get('--grid-dot', '#1F2C38'),
        originColor: get('--origin-color', '#2D4456'),
        vectorColor: get('--vector-color', '#C9B9A0'),
        handleFill: get('--handle-fill', '#F7E4C8'),
        handleStroke: get('--handle-stroke', '#0C131A'),
        accent: get('--accent', '#9E6752'),
        textPrimary: get('--text-primary', '#F7E4C8'),
        trailAlpha: Number.isFinite(trailAlpha) ? trailAlpha : 0.45,
        bodyColors: [
            get('--body-color-1', '#E39A7B'),
            get('--body-color-2', '#FDD7A6'),
            get('--body-color-3', '#8FB3C9'),
        ],
    };
}

export function HolstCanvas({ theme = 'dark', presetCommand = null, onActivePresetChange }) {
    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const paletteRef = useRef(null);
    const appliedThemeRef = useRef(null);
    const themePropRef = useRef(theme);
    const lastTapRef = useRef({ time: 0, index: null });
    const handledPresetNonceRef = useRef(0);
    const onActivePresetChangeRef = useRef(onActivePresetChange);

    useEffect(() => {
        onActivePresetChangeRef.current = onActivePresetChange;
    }, [onActivePresetChange]);

    useEffect(() => {
        themePropRef.current = theme;
        appliedThemeRef.current = null;
    }, [theme]);

    const [running, setRunning] = useState(false);
    const [simulationError, setSimulationError] = useState(null);
    const [speed, setSpeed] = useState(1);
    const [collisions, setCollisions] = useState(false);
    const [showSimSetup, setShowSimSetup] = useState(false);
    const [simReport, setSimReport] = useState(null);
    const [hoverCursor, setHoverCursor] = useState(null);
    const activeSimSessionRef = useRef(null);
    const loopModeRef = useRef(false);
    const periodicOrbitRef = useRef(null);
    const presetRef = useRef(PRESETS[0]);
    const setupPresetRef = useRef(PRESETS[0]);
    const exactModeRef = useRef(false);
    const collisionsRef = useRef(false);
    const accumulatorRef = useRef(0);
    const [outcome, setOutcome] = useState('unknown');
    const [bodyCount, setBodyCount] = useState(FALLBACK_PRESET.bodies.length);
    const [menu, setMenu] = useState(null);
    const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
    const [showStats, setShowStats] = useState(() => {
        try { const saved = localStorage.getItem('cosmos.analytics'); return saved === null ? window.innerWidth >= 900 : saved === 'true'; }
        catch { return window.innerWidth >= 900; }
    });
    const toggleStats = (value) => {
        setShowStats(value);
        try { localStorage.setItem('cosmos.analytics', String(value)); } catch { return undefined; }
        return undefined;
    };
    const [statsView, setStatsView] = useState(() => {
        const stats = createStats();
        resetStats(stats, toSimBodies(FALLBACK_PRESET.bodies), FALLBACK_PRESET.g, FALLBACK_PRESET.softening, FALLBACK_PRESET.dt);
        return stats;
    });

    const [gravity, setGravity] = useState(FALLBACK_PRESET.g ?? 1);

    const timeTextRef = useRef(null);
    const runningRef = useRef(running);
    const speedRef = useRef(speed);
    const gravityRef = useRef(gravity);
    const softeningRef = useRef(FALLBACK_PRESET.softening ?? 0);
    const dtRef = useRef(FALLBACK_PRESET.dt || 0.0001);
    const lockCMRef = useRef(false);
    const hasCollidedRef = useRef(false);

    const cameraRef = useRef({ x: 0, y: 0, zoom: BASE_ZOOM });
    const stateRef = useRef(toSimBodies(FALLBACK_PRESET.bodies).map(attachContactRadius));
    const setupRef = useRef(toSimBodies(FALLBACK_PRESET.bodies).map(attachContactRadius));
    const trailsRef = useRef([[], [], []]);
    const simTimeRef = useRef(0);
    const trailClockRef = useRef(0);
    const statsRef = useRef({ ...statsView });
    const frameCounterRef = useRef(0);

    const dragRef = useRef({ kind: 'none' });
    const selectedRef = useRef(null);

    useEffect(() => {
        onActivePresetChangeRef.current?.(PRESETS[0]);
    }, []);

    useEffect(() => { runningRef.current = running; }, [running]);
    useEffect(() => { speedRef.current = speed; }, [speed]);
    useEffect(() => { gravityRef.current = gravity; }, [gravity]);
    useEffect(() => { selectedRef.current = menu ? menu.index : null; }, [menu]);

    const syncTimeText = useCallback(() => {
        if (timeTextRef.current) timeTextRef.current.textContent = formatSimTime(simTimeRef.current);
    }, []);

    useEffect(() => { syncTimeText(); });

    const refreshStatsView = useCallback(() => {
        setStatsView({ ...statsRef.current });
    }, []);

    const resetMeta = useCallback(() => {
        hasCollidedRef.current = false;
        setSimulationError(null);
    }, []);

    const invalidatePreset = useCallback(() => {
        presetRef.current = null;
        setupPresetRef.current = null;
        exactModeRef.current = false;
        loopModeRef.current = false;
        onActivePresetChangeRef.current?.(null);
    }, []);

    const commitEdit = useCallback(() => {
        invalidatePreset();
        if (lockCMRef.current) recenterToCM(stateRef.current);
        trailsRef.current = stateRef.current.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        setupRef.current = cloneBodies(stateRef.current);
        resetMeta();
        resetStats(statsRef.current, stateRef.current, gravityRef.current, softeningRef.current, dtRef.current);
        syncTimeText();
        setBodyCount(stateRef.current.length);
        setOutcome('unknown');
        refreshStatsView();
    }, [syncTimeText, resetMeta, refreshStatsView, invalidatePreset]);

    const setNewBodies = useCallback((preset) => {
        let periodicOrbit = null;
        try { if (preset.period) periodicOrbit = preparePeriodicOrbit(preset); }
        catch (error) { setSimulationError(error.message); return; }
        periodicOrbitRef.current = periodicOrbit;
        loopModeRef.current = !!periodicOrbit;
        const { bodies, g, softening: softeningValue, dt: newDt, lockCM: lock } = preset;
        presetRef.current = preset;
        setupPresetRef.current = preset;
        exactModeRef.current = !!preset.solution;
        collisionsRef.current = false;
        accumulatorRef.current = 0;
        onActivePresetChangeRef.current?.(preset);
        setCollisions(false);
        runningRef.current = false;
        setMenu(null);
        activeSimSessionRef.current = null;
        setShowSimSetup(false);
        setSimReport(null);
        stateRef.current = bodies.map(attachContactRadius);
        if (lock) recenterToCM(stateRef.current);
        setupRef.current = cloneBodies(stateRef.current);
        trailsRef.current = bodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        const cleanDt = newDt > 0 ? newDt : 0.0001;
        dtRef.current = cleanDt;
        setGravity(g);
        gravityRef.current = g;
        softeningRef.current = softeningValue ?? 0;
        lockCMRef.current = !!lock;

        cameraRef.current = { x: 0, y: 0, zoom: fittedZoom(periodicOrbit ? { ...preset, extent: periodicOrbit.extent } : preset, bodies, window.innerWidth, window.innerHeight) };
        resetMeta();
        resetStats(statsRef.current, stateRef.current, g, softeningValue ?? 0, cleanDt);
        syncTimeText();
        setBodyCount(bodies.length);
        setOutcome('unknown');
        setRunning(false);
        refreshStatsView();
    }, [syncTimeText, resetMeta, refreshStatsView]);

    useEffect(() => {
        if (!presetCommand?.preset || presetCommand.nonce === handledPresetNonceRef.current) return;
        handledPresetNonceRef.current = presetCommand.nonce;
        setNewBodies(presetCommand.preset);
    }, [presetCommand, setNewBodies]);

    const finishTimedSimulation = useCallback((session, finalOutcome) => {
        activeSimSessionRef.current = null;
        runningRef.current = false;
        setRunning(false);
        accumulatorRef.current = 0;

        const elapsed = simTimeRef.current;

        presetRef.current = session.savedPreset;
        setupPresetRef.current = session.savedSetupPreset;
        exactModeRef.current = session.savedExact;
        loopModeRef.current = session.savedLoop;
        periodicOrbitRef.current = session.savedPeriodicOrbit;
        onActivePresetChangeRef.current?.(session.savedPreset);

        stateRef.current = cloneBodies(session.savedState);
        setupRef.current = cloneBodies(session.savedSetup);
        trailsRef.current = session.savedTrails.map((t) => t.map((pt) => ({ ...pt })));
        simTimeRef.current = session.savedSimTime;
        trailClockRef.current = session.savedTrailClock;
        hasCollidedRef.current = session.savedHasCollided;
        statsRef.current = session.savedStats;
        setBodyCount(stateRef.current.length);
        setOutcome(session.savedOutcome);
        syncTimeText();
        refreshStatsView();

        const samples = session.samples;
        const initialEnergy = samples.length > 0 ? samples[0].totalE : 0;
        const finalEnergy = samples.length > 0 ? samples[samples.length - 1].totalE : 0;

        setSimReport({
            targetTime: session.targetTime,
            elapsedTime: elapsed,
            expected: session.expectedOutcome,
            actual: finalOutcome,
            matched: finalOutcome === session.expectedOutcome,
            minDist: Number.isFinite(session.minDist) ? session.minDist : 0,
            maxDist: Number.isFinite(session.maxDist) ? session.maxDist : 0,
            maxSpeed: Number.isFinite(session.maxSpeed) ? session.maxSpeed : 0,
            initialEnergy,
            energyDrift: Math.abs(finalEnergy - initialEnergy),
            samples,
        });
    }, [syncTimeText, refreshStatsView]);

    const startTimedSimulation = useCallback((targetTime, expectedOutcome) => {
        if (stateRef.current.length < 2) return;
        setShowSimSetup(false);
        setSimReport(null);
        setMenu(null);

        const savedState = cloneBodies(stateRef.current);
        const savedSetup = cloneBodies(setupRef.current);
        const savedTrails = trailsRef.current.map((t) => t.map((pt) => ({ ...pt })));
        const savedSimTime = simTimeRef.current;
        const savedTrailClock = trailClockRef.current;
        const savedOutcome = outcome;
        const savedHasCollided = hasCollidedRef.current;
        const savedStats = { ...statsRef.current };
        const savedPreset = presetRef.current;
        const savedSetupPreset = setupPresetRef.current;
        const savedExact = exactModeRef.current;
        const savedLoop = loopModeRef.current;
        const savedPeriodicOrbit = periodicOrbitRef.current;

        const startBodies = cloneBodies(setupRef.current.length >= 2 ? setupRef.current : stateRef.current);
        if (lockCMRef.current) recenterToCM(startBodies);
        stateRef.current = startBodies;
        trailsRef.current = startBodies.map(() => []);
        simTimeRef.current = 0;
        trailClockRef.current = 0;
        hasCollidedRef.current = false;
        accumulatorRef.current = 0;
        resetMeta();
        resetStats(statsRef.current, stateRef.current, gravityRef.current, softeningRef.current, dtRef.current);
        setBodyCount(startBodies.length);
        syncTimeText();
        refreshStatsView();

        const firstSample = computeSnapshotMetrics(startBodies, 0, gravityRef.current, softeningRef.current);
        const sampleInterval = Math.max(0.01, targetTime / 180);

        activeSimSessionRef.current = {
            targetTime,
            expectedOutcome,
            sampleInterval,
            nextSampleTime: sampleInterval,
            samples: [firstSample],
            minDist: firstSample.minDist,
            maxDist: firstSample.maxDist,
            maxSpeed: firstSample.maxSpeed,
            savedState,
            savedSetup,
            savedTrails,
            savedSimTime,
            savedTrailClock,
            savedOutcome,
            savedHasCollided,
            savedStats,
            savedPreset,
            savedSetupPreset,
            savedExact,
            savedLoop,
            savedPeriodicOrbit,
        };

        runningRef.current = true;
        setRunning(true);
    }, [outcome, resetMeta, syncTimeText, refreshStatsView]);

    const processStep = useCallback((H) => {
        const state = stateRef.current;
        
        const before = cloneBodies(state);
        let result;
        try {
            if (loopModeRef.current && periodicOrbitRef.current) {
                evaluatePeriodicOrbit(periodicOrbitRef.current, simTimeRef.current + H, state);
                result = { events: [] };
            } else if (exactModeRef.current && presetRef.current?.solution) {
                evaluateCentralOrbit(presetRef.current, simTimeRef.current + H, state);
                result = { events: [] };
            } else result = stepSimulation(state, gravityRef.current, softeningRef.current, H, {
                collisions: collisionsRef.current,
                vFrag: V_FRAG, qMin: Q_MIN, nDebris: N_DEBRIS,
                spread: DEBRIS_SPREAD, debrisMassFraction: DEBRIS_MASS_FRACTION,
            });
            if (!isStateFinite(state)) throw new Error('Simulation became non-finite; reduce the time step.');
        } catch (error) {
            state.splice(0, state.length, ...before);
            runningRef.current = false;
            setRunning(false);
            setSimulationError(error.message);
            return null;
        }
        if (result.events.length > 0) {
            hasCollidedRef.current = true;
            trailsRef.current = state.map(() => []);
            setMenu(null);
        }
        if (lockCMRef.current) recenterToCM(state);

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

        statsRef.current.dt = H;
        const energy = totalEnergy(state, gravityRef.current, softeningRef.current);
        sampleStats(statsRef.current, state, simTimeRef.current, energy, result.events);

        const session = activeSimSessionRef.current;
        if (session) {
            if (!isStateFinite(state)) {
                finishTimedSimulation(session, 'ejection');
                return null;
            }
            const g = gravityRef.current;
            const soft = softeningRef.current;
            for (let i = 0; i < state.length; i++) {
                const v = Math.hypot(state[i].vx, state[i].vy);
                if (v > session.maxSpeed) session.maxSpeed = v;
                for (let j = i + 1; j < state.length; j++) {
                    const d = Math.hypot(state[j].x - state[i].x, state[j].y - state[i].y);
                    if (d < session.minDist) session.minDist = d;
                    if (d > session.maxDist) session.maxDist = d;
                }
            }

            if (simTimeRef.current >= session.nextSampleTime || simTimeRef.current >= session.targetTime) {
                const snap = computeSnapshotMetrics(state, simTimeRef.current, g, soft);
                session.samples.push(snap);
                session.nextSampleTime += session.sampleInterval;
            }

            const status = classify(state, g, soft, hasCollidedRef.current);
            if (status === 'collision' || status === 'ejection') {
                const snap = computeSnapshotMetrics(state, simTimeRef.current, g, soft);
                session.samples.push(snap);
                finishTimedSimulation(session, status);
                return null;
            }

            if (simTimeRef.current >= session.targetTime) {
                finishTimedSimulation(session, 'stable');
                return null;
            }
        }

        return result;
    }, [finishTimedSimulation]);

    const updateOutcome = useCallback(() => {
        const result = classify(
            stateRef.current,
            gravityRef.current,
            softeningRef.current,
            hasCollidedRef.current
        );
        setOutcome(result);
    }, []);

    const toggleRunning = useCallback(() => {
        if (stateRef.current.length < MIN_BODIES) return;
        const nextRunning = !runningRef.current;
        if (!nextRunning && activeSimSessionRef.current) {
            const session = activeSimSessionRef.current;
            const status = classify(stateRef.current, gravityRef.current, softeningRef.current, hasCollidedRef.current);
            finishTimedSimulation(session, status === 'unknown' ? 'stable' : status);
            return;
        }
        runningRef.current = nextRunning;
        accumulatorRef.current = 0;
        setRunning(nextRunning);
        if (!nextRunning) refreshStatsView();
    }, [finishTimedSimulation, refreshStatsView]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code !== 'Space' && e.key !== ' ') return;
            if (e.repeat) return;
            const target = e.target;
            if (target instanceof Element) {
                const tag = target.tagName;
                const isTextInput =
                    tag === 'TEXTAREA' ||
                    tag === 'SELECT' ||
                    target.isContentEditable ||
                    (tag === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes(target.getAttribute('type') || 'text'));
                if (isTextInput || target.closest('.catalog-backdrop')) return;
            }
            e.preventDefault();
            toggleRunning();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleRunning]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let raf = 0;
        let cachedWidth = 0;
        let cachedHeight = 0;
        let lastFrameTime = null;

        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(rect.width * dpr);
            canvas.height = Math.floor(rect.height * dpr);
            if ((cachedWidth > 0 && cachedHeight > 0) || (rect.width > 0 && rect.height > 0 && cachedWidth === 0)) {
                cameraRef.current.zoom = fittedZoom(presetRef.current, stateRef.current, rect.width, rect.height);
            }
            cachedWidth = rect.width;
            cachedHeight = rect.height;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener('resize', resize);

        const step = (wallSeconds) => {
            const state = stateRef.current;
            if (!runningRef.current || state.length < MIN_BODIES) { accumulatorRef.current = 0; return; }

            for (let i = 0; i < state.length; i++) {
                const trail = trailsRef.current[i] || (trailsRef.current[i] = []);
                if (trail.length === 0) trail.push({ x: state[i].x, y: state[i].y });
            }

            const H = dtRef.current;
            accumulatorRef.current += wallSeconds * speedRef.current;
            const stepCount = Math.min(2000, Math.floor(accumulatorRef.current / H));
            accumulatorRef.current -= stepCount * H;
            // Drop excess wall time under load instead of freezing the browser catching up.
            accumulatorRef.current = Math.min(accumulatorRef.current, H);

            for (let s = 0; s < stepCount; s++) {
                if (!processStep(H)) break;
            }

            if (!isStateFinite(state)) {
                runningRef.current = false;
                setRunning(false);
                return;
            }

            updateOutcome();
            setBodyCount(state.length);
            syncTimeText();

            frameCounterRef.current += 1;
            if (frameCounterRef.current % STATS_RENDER_EVERY === 0) {
                refreshStatsView();
            }
        };

        const draw = () => {
            const width = cachedWidth;
            const height = cachedHeight;
            const cx = width / 2 + cameraRef.current.x;
            const cy = height * 0.35 + cameraRef.current.y;
            const k = cameraRef.current.zoom;
            const editing = !runningRef.current;

            const currentTheme = document.documentElement.getAttribute('data-theme') || themePropRef.current;
            if (!paletteRef.current || appliedThemeRef.current !== currentTheme) {
                paletteRef.current = readCanvasPalette();
                appliedThemeRef.current = currentTheme;
            }
            const palette = paletteRef.current;

            ctx.clearRect(0, 0, width, height);

            const worldMinX = -cx / k;
            const worldMaxX = (width - cx) / k;
            const worldMinY = (cy - height) / k;
            const worldMaxY = cy / k;

            let tileWorld = STAR_TILE_WORLD;
            while ((worldMaxX - worldMinX) / tileWorld > 18 || (worldMaxY - worldMinY) / tileWorld > 18) {
                tileWorld *= 2;
            }

            const startTileX = Math.floor(worldMinX / tileWorld);
            const endTileX = Math.floor(worldMaxX / tileWorld);
            const startTileY = Math.floor(worldMinY / tileWorld);
            const endTileY = Math.floor(worldMaxY / tileWorld);

            const tilesCount = Math.max(1, (endTileX - startTileX + 1) * (endTileY - startTileY + 1));
            const starsPerTile = Math.max(6, Math.min(STARS.length, Math.floor(500 / tilesCount)));

            ctx.fillStyle = palette.starColor;
            for (let tx = startTileX; tx <= endTileX; tx++) {
                for (let ty = startTileY; ty <= endTileY; ty++) {
                    const shiftU = tileShift(tx, ty, 1);
                    const shiftV = tileShift(tx, ty, 2);
                    const baseWorldX = tx * tileWorld;
                    const baseWorldY = ty * tileWorld;

                    for (let s = 0; s < starsPerTile; s++) {
                        const star = STARS[s];
                        const u = (star.u + shiftU) % 1;
                        const v = (star.v + shiftV) % 1;
                        const wx = baseWorldX + u * tileWorld;
                        const wy = baseWorldY + v * tileWorld;
                        const sx = cx + wx * k;
                        const sy = cy - wy * k;

                        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;

                        ctx.globalAlpha = star.alpha;
                        ctx.beginPath();
                        ctx.arc(sx, sy, Math.max(0.8, star.size), 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = 1.0;

            ctx.strokeStyle = palette.gridColor;
            ctx.globalAlpha = 0.7;
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

            ctx.strokeStyle = palette.originColor;
            ctx.globalAlpha = 0.85;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
            ctx.moveTo(0, cy); ctx.lineTo(width, cy);
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            const lineScale = k / BASE_ZOOM;

            ctx.lineWidth = Math.max(1, 2 * lineScale);
            ctx.lineJoin = 'round';
            trailsRef.current.forEach((trail, i) => {
                const body = stateRef.current[i];
                if (!body || trail.length < 2) return;
                ctx.strokeStyle = palette.bodyColors[i % palette.bodyColors.length];
                ctx.globalAlpha = palette.trailAlpha;
                ctx.beginPath();
                ctx.moveTo(cx + trail[0].x * k, cy - trail[0].y * k);
                for (let p = 1; p < trail.length; p++) {
                    ctx.lineTo(cx + trail[p].x * k, cy - trail[p].y * k);
                }
                ctx.stroke();
            });
            ctx.globalAlpha = 1.0;

            const bodies = stateRef.current;
            if (bodies.length >= 2 && bodies.length <= 6) {
                ctx.strokeStyle = palette.accent;
                ctx.globalAlpha = 0.28;
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                for (let i = 0; i < bodies.length; i++) {
                    for (let j = i + 1; j < bodies.length; j++) {
                        const a = { x: cx + bodies[i].x * k, y: cy - bodies[i].y * k };
                        const b = { x: cx + bodies[j].x * k, y: cy - bodies[j].y * k };
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y);
                        ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;
            }

            stateRef.current.forEach((b, i) => {
                const sx = cx + b.x * k;
                const sy = cy - b.y * k;
                const r = Math.max(2, bodyRadius(b.m) * lineScale * (b.isDebris ? 0.5 : 1));

                ctx.fillStyle = b.isDebris ? palette.bodyColors[1] : palette.bodyColors[i % palette.bodyColors.length];
                ctx.globalAlpha = b.isDebris ? 0.85 : 1.0;
                ctx.beginPath();
                ctx.arc(sx, sy, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;

                ctx.strokeStyle = palette.handleStroke;
                ctx.lineWidth = Math.max(1, 1.25 * lineScale);
                ctx.stroke();

                if (selectedRef.current === i) {
                    ctx.strokeStyle = palette.textPrimary;
                    ctx.lineWidth = Math.max(1, 2 * lineScale);
                    ctx.setLineDash([5 * lineScale, 5 * lineScale]);
                    ctx.beginPath();
                    ctx.arc(sx, sy, r + 8 * lineScale, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                if (editing && !b.isDebris) {
                    const handle = getVelocityHandleScreenPos(b, sx, sy, k, r);
                    const tipX = sx + b.vx * VEL_SCALE * k;
                    const tipY = sy - b.vy * VEL_SCALE * k;
                    const len = Math.hypot(tipX - sx, tipY - sy);

                    if (!handle.isZero && len > r + 4 * lineScale) {
                        const angle = Math.atan2(tipY - sy, tipX - sx);
                        const head = Math.max(6, 8 * lineScale);
                        ctx.strokeStyle = palette.vectorColor;
                        ctx.fillStyle = palette.vectorColor;
                        ctx.globalAlpha = 0.78;
                        ctx.lineWidth = Math.max(1.2, 1.4 * lineScale);
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
                        ctx.globalAlpha = 1.0;
                    } else if (handle.extended) {
                        ctx.strokeStyle = palette.vectorColor;
                        ctx.globalAlpha = 0.45;
                        ctx.lineWidth = 1;
                        ctx.setLineDash([2, 2]);
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(handle.x, handle.y);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.globalAlpha = 1.0;
                    }

                    const dotRadius = Math.max(4, 4.5 * lineScale);
                    ctx.fillStyle = palette.handleFill;
                    ctx.strokeStyle = palette.handleStroke;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(handle.x, handle.y, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            });
        };

        const frame = (timestamp) => {
            const elapsed = lastFrameTime === null ? 0 : Math.min(0.05, (timestamp - lastFrameTime) / 1000);
            lastFrameTime = timestamp;
            step(elapsed);
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
            const worldY = -(mouseY - rect.height * 0.35 - cam.y) / cam.zoom;

            cam.zoom = newZoom;
            cam.x = mouseX - rect.width / 2 - worldX * newZoom;
            cam.y = mouseY - rect.height * 0.35 + worldY * newZoom;
        };

        canvas.addEventListener('wheel', handleNativeWheel, { passive: false });

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
            canvas.removeEventListener('wheel', handleNativeWheel);
        };
    }, [syncTimeText, processStep, updateOutcome, refreshStatsView]);

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
            y: height * 0.35 + cameraRef.current.y - b.y * k,
        };
    };

    const toWorld = (mousePos) => {
        const width = canvasRef.current.getBoundingClientRect().width;
        const height = canvasRef.current.getBoundingClientRect().height;
        const k = cameraRef.current.zoom;
        return {
            x: (mousePos.x - width / 2 - cameraRef.current.x) / k,
            y: -(mousePos.y - height * 0.35 - cameraRef.current.y) / k,
        };
    };

    const hitVelocityHandle = (mousePos, hitRadius = 14) => {
        const bodies = stateRef.current;
        const k = cameraRef.current.zoom;
        const lineScale = k / BASE_ZOOM;
        for (let i = bodies.length - 1; i >= 0; i--) {
            if (bodies[i].isDebris) continue;
            const p = toScreen(bodies[i]);
            const r = Math.max(2, bodyRadius(bodies[i].m) * lineScale);
            const handle = getVelocityHandleScreenPos(bodies[i], p.x, p.y, k, r);
            if (Math.hypot(mousePos.x - handle.x, mousePos.y - handle.y) <= hitRadius) {
                return i;
            }
        }
        return null;
    };

    const hitBody = (mousePos) => {
        const bodies = stateRef.current;
        const lineScale = cameraRef.current.zoom / BASE_ZOOM;
        for (let i = bodies.length - 1; i >= 0; i--) {
            if (bodies[i].isDebris) continue;
            const p = toScreen(bodies[i]);
            const r = Math.max(2, bodyRadius(bodies[i].m) * lineScale);
            const clickRadius = Math.max(r + 12, 22);
            if (Math.hypot(mousePos.x - p.x, mousePos.y - p.y) <= clickRadius) {
                return i;
            }
        }
        return null;
    };

    const openBodyMenu = (index) => {
        if (index === null || !stateRef.current[index]) return;
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

    const handlePointerDown = (e) => {
        if (e.target.closest('.body-menu') || e.target.closest('.sim-panel-wrapper') || e.target.closest('.stats-panel')) return;
        setMenu(null);
        e.currentTarget.setPointerCapture(e.pointerId);

        const mousePos = getMousePos(e);

        if (e.button === 1 || e.button === 2) {
            dragRef.current = { kind: 'pan', startX: mousePos.x, startY: mousePos.y, camX: cameraRef.current.x, camY: cameraRef.current.y };
            setHoverCursor('grabbing');
            return;
        }

        if (e.button === 0 && !runningRef.current) {
            const velHitRadius = e.pointerType === 'mouse' ? 14 : 22;
            const velIndex = hitVelocityHandle(mousePos, velHitRadius);
            if (velIndex !== null) {
                dragRef.current = { kind: 'velocity', index: velIndex, startX: mousePos.x, startY: mousePos.y, moved: false };
                setHoverCursor('grabbing');
                return;
            }

            const bodyIndex = hitBody(mousePos);
            if (bodyIndex !== null) {
                const world = toWorld(mousePos);
                const b = stateRef.current[bodyIndex];
                dragRef.current = { kind: 'move', index: bodyIndex, dx: b.x - world.x, dy: b.y - world.y, startX: mousePos.x, startY: mousePos.y, moved: false };
                setHoverCursor('move');
                return;
            }

            if (stateRef.current.length < MAX_BODIES) {
                const world = toWorld(mousePos);
                const idx = stateRef.current.length;
                stateRef.current = [
                    ...stateRef.current,
                    attachContactRadius({ m: 1, x: roundFloat(world.x, 4), y: roundFloat(world.y, 4), vx: 0, vy: 0 }, idx),
                ];
                commitEdit();
                dragRef.current = { kind: 'velocity', index: idx, startX: mousePos.x, startY: mousePos.y, moved: false };
                setHoverCursor('grabbing');
                return;
            }
        }

        if (e.button === 0) {
            dragRef.current = { kind: 'pan', startX: mousePos.x, startY: mousePos.y, camX: cameraRef.current.x, camY: cameraRef.current.y };
            setHoverCursor('grabbing');
        }
    };

    const handlePointerMove = (e) => {
        const drag = dragRef.current;
        const mousePos = getMousePos(e);

        if (drag.kind === 'none') {
            if (!runningRef.current && e.pointerType === 'mouse' && !e.target.closest('.body-menu, .sim-panel-wrapper, .stats-panel')) {
                if (hitVelocityHandle(mousePos, 14) !== null) {
                    setHoverCursor('grab');
                } else if (hitBody(mousePos) !== null) {
                    setHoverCursor('move');
                } else if (stateRef.current.length >= MAX_BODIES) {
                    setHoverCursor('grab');
                } else {
                    setHoverCursor(null);
                }
            }
            return;
        }

        if (drag.kind === 'pan') {
            cameraRef.current.x = drag.camX + (mousePos.x - drag.startX);
            cameraRef.current.y = drag.camY + (mousePos.y - drag.startY);
        } else if (drag.kind === 'move') {
            if (!drag.moved && Math.hypot(mousePos.x - drag.startX, mousePos.y - drag.startY) < 3) return;
            drag.moved = true;
            const world = toWorld(mousePos);
            stateRef.current = stateRef.current.map((b, i) => {
                if (i !== drag.index) return b;
                return { ...b, x: roundFloat(world.x + drag.dx, 4), y: roundFloat(world.y + drag.dy, 4) };
            });
        } else if (drag.kind === 'velocity') {
            if (!drag.moved && Math.hypot(mousePos.x - drag.startX, mousePos.y - drag.startY) < 3) return;
            drag.moved = true;
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
        if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        const drag = dragRef.current;
        if (drag.kind === 'move') {
            if (drag.moved) {
                commitEdit();
            } else if (e.pointerType !== 'mouse') {
                const now = performance.now();
                if (lastTapRef.current.index === drag.index && now - lastTapRef.current.time < 340) {
                    lastTapRef.current = { time: 0, index: null };
                    openBodyMenu(drag.index);
                } else {
                    lastTapRef.current = { time: now, index: drag.index };
                }
            }
        } else if (drag.kind === 'velocity' && drag.moved) {
            commitEdit();
        }
        dragRef.current = { kind: 'none' };
        setHoverCursor(null);
    };

    const handleDoubleClick = (e) => {
        if (e.target.closest('.body-menu') || e.target.closest('.sim-panel-wrapper') || e.target.closest('.stats-panel')) return;
        const mousePos = getMousePos(e);
        const index = hitBody(mousePos);
        openBodyMenu(index);
    };

    const handleApplyBody = (index, patch) => {
        stateRef.current = stateRef.current.map((b, i) => (i === index ? attachContactRadius({ ...b, ...patch }, i) : b));
        commitEdit();
    };

    const handleDeleteBody = (index) => {
        stateRef.current = stateRef.current.filter((_, i) => i !== index);
        commitEdit();
        setMenu(null);
    };

    const handleOpenSimulation = () => {
        if (stateRef.current.length < 2) return;
        setSimReport(null);
        setShowSimSetup(true);
    };

    return (
        <div className="holst-root">
            <div
                className="canvas-container"
                ref={containerRef}
                style={hoverCursor ? { cursor: hoverCursor } : undefined}
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
                {showSimSetup && (
                    <SimulationSetupMenu
                        onStart={startTimedSimulation}
                        onClose={() => setShowSimSetup(false)}
                    />
                )}
                {simReport && (
                    <SimulationReportModal
                        report={simReport}
                        onClose={() => setSimReport(null)}
                    />
                )}
            </div>

            {simulationError && <div role="alert" className="simulation-error">{simulationError}</div>}

            {showStats ? <StatsPanel stats={statsView} onClose={() => toggleStats(false)} /> :
                <button type="button" className="analytics-reopen" aria-label="Показать аналитику" onClick={() => toggleStats(true)}>◷ Аналитика</button>}

            <ControlPanel
                isPanelCollapsed={isPanelCollapsed}
                setIsPanelCollapsed={setIsPanelCollapsed}
                running={running}
                setRunning={toggleRunning}
                bodyCount={bodyCount}
                timeTextRef={timeTextRef}
                speed={speed}
                setSpeed={(value) => { speedRef.current = value; setSpeed(value); }}
                gravity={gravity}
                setGravity={(value) => { if (value !== gravityRef.current) invalidatePreset(); gravityRef.current = value; setGravity(value); }}
                collisions={collisions}
                onCollisionsChange={(value) => {
                    collisionsRef.current = value;
                    setCollisions(value);
                    if (value) { exactModeRef.current = false; loopModeRef.current = false; }
                }}
                onReset={() => {
                    if (activeSimSessionRef.current) {
                        const session = activeSimSessionRef.current;
                        activeSimSessionRef.current = null;
                        setupRef.current = cloneBodies(session.savedSetup);
                        setupPresetRef.current = session.savedSetupPreset;
                    }
                    runningRef.current = false;
                    setRunning(false);
                    accumulatorRef.current = 0;
                    presetRef.current = setupPresetRef.current;
                    onActivePresetChangeRef.current?.(setupPresetRef.current);
                    stateRef.current = cloneBodies(setupRef.current);
                    trailsRef.current = stateRef.current.map(() => []);
                    simTimeRef.current = 0;
                    trailClockRef.current = 0;
                    setMenu(null);
                    setShowSimSetup(false);
                    resetMeta();
                    resetStats(statsRef.current, stateRef.current, gravityRef.current, softeningRef.current, dtRef.current);
                    setOutcome('unknown');
                    setBodyCount(stateRef.current.length);
                    syncTimeText();
                    refreshStatsView();
                }}
                onClear={() => {
                    activeSimSessionRef.current = null;
                    setShowSimSetup(false);
                    setSimReport(null);
                    runningRef.current = false;
                    setRunning(false);
                    stateRef.current = [];
                    commitEdit();
                }}
                onOpenSimulation={handleOpenSimulation}
            />
        </div>
    );
}
