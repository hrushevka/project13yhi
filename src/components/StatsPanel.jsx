import { useEffect, useRef, useState } from 'react';
import { getSummary } from '../utils/stats';

function fmt(v, digits = 3) {
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(digits)).toString();
}

function fmtTime(t) {
    if (t === null || t === undefined) return '—';
    return `${t.toFixed(2)} с`;
}

function getMinStatsTop() {
    return window.innerWidth <= 680 ? 46 : 52;
}

function getInitialStatsBox() {
    const top = getMinStatsTop();
    if (window.innerWidth <= 900) {
        const width = Math.max(220, Math.min(340, window.innerWidth - 16));
        return {
            left: Math.max(8, Math.floor((window.innerWidth - width) / 2)),
            top,
            width,
            height: null,
        };
    }
    const width = 290;
    return {
        left: Math.max(8, window.innerWidth - width - 14),
        top,
        width,
        height: null,
    };
}

function clampStatsBox(box, renderedHeight = 240) {
    const minTop = getMinStatsTop();
    const maxWidth = Math.max(220, window.innerWidth - 16);
    const width = Math.max(220, Math.min(maxWidth, box.width));
    const maxHeight = Math.max(170, window.innerHeight - minTop - 8);
    const height = box.height === null ? null : Math.max(170, Math.min(maxHeight, box.height));
    const effectiveHeight = height ?? Math.min(renderedHeight, maxHeight);
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const maxTop = Math.max(minTop, window.innerHeight - effectiveHeight - 8);
    return {
        left: Math.max(8, Math.min(maxLeft, box.left)),
        top: Math.max(minTop, Math.min(maxTop, box.top)),
        width,
        height,
    };
}

function DistanceChart({ history, height = 80 }) {
    if (!history || history.length < 2) {
        return <div className="stats-chart-empty">Нет данных — запустите симуляцию</div>;
    }
    const width = 260;
    const pad = 4;
    let minV = Infinity, maxV = -Infinity;
    for (const h of history) {
        if (h.min < minV) minV = h.min;
        if (h.max > maxV) maxV = h.max;
    }
    if (minV === maxV) { minV -= 0.1; maxV += 0.1; }
    const range = maxV - minV || 1;
    const xStep = (width - pad * 2) / (history.length - 1);
    const yOf = (v) => pad + (height - pad * 2) * (1 - (v - minV) / range);
    const xOf = (i) => pad + i * xStep;

    const avgPath = history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(h.avg)}`).join(' ');
    const areaPath =
        history.map((h, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(h.max)}`).join(' ') +
        ' ' +
        history.slice().reverse().map((h, i) => `L ${xOf(history.length - 1 - i)} ${yOf(h.min)}`).join(' ') +
        ' Z';

    return (
        <svg className="stats-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <path d={areaPath} fill="var(--accent-soft)" fillOpacity="0.65" stroke="none" />
            <path d={avgPath} fill="none" stroke="var(--accent)" strokeWidth="1.6" />
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--border)" strokeWidth="0.75" />
            <text x={pad + 2} y={pad + 8} fill="var(--text-muted)" fontSize="8">max {fmt(maxV, 2)}</text>
            <text x={pad + 2} y={height - pad - 2} fill="var(--text-muted)" fontSize="8">min {fmt(minV, 2)}</text>
        </svg>
    );
}

const RESIZE_DIRS = ['w', 'e', 's', 'sw', 'se'];

export function StatsPanel({ stats, final = false, onClose }) {
    const s = getSummary(stats);
    const panelRef = useRef(null);
    const customizedRef = useRef(false);
    const interactionRef = useRef(null);
    const [box, setBox] = useState(getInitialStatsBox);

    useEffect(() => {
        if (final) return undefined;
        const handleResize = () => {
            if (!customizedRef.current) {
                setBox(getInitialStatsBox());
                return;
            }
            const h = panelRef.current ? panelRef.current.offsetHeight : 240;
            setBox((prev) => clampStatsBox(prev, h));
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [final]);

    const handleDragStart = (e) => {
        if (final) return;
        e.stopPropagation();
        if (e.target.closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = panelRef.current ? panelRef.current.getBoundingClientRect() : null;
        interactionRef.current = {
            kind: 'drag',
            startX: e.clientX,
            startY: e.clientY,
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            renderedHeight: rect ? rect.height : 240,
        };
    };

    const handleResizeStart = (dir) => (e) => {
        if (final) return;
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = panelRef.current ? panelRef.current.getBoundingClientRect() : null;
        interactionRef.current = {
            kind: 'resize',
            dir,
            startX: e.clientX,
            startY: e.clientY,
            left: box.left,
            top: box.top,
            width: rect ? rect.width : box.width,
            height: rect ? rect.height : (box.height ?? 320),
        };
    };

    const handlePointerMove = (e) => {
        const active = interactionRef.current;
        if (!active) return;
        e.stopPropagation();
        customizedRef.current = true;
        const dx = e.clientX - active.startX;
        const dy = e.clientY - active.startY;
        if (active.kind === 'drag') {
            setBox(clampStatsBox({
                left: active.left + dx,
                top: active.top + dy,
                width: active.width,
                height: active.height,
            }, active.renderedHeight));
            return;
        }
        const minTop = getMinStatsTop();
        let left = active.left;
        let width = active.width;
        let height = box.height;
        if (active.dir.includes('e')) {
            const maxW = Math.max(220, window.innerWidth - active.left - 8);
            width = Math.max(220, Math.min(maxW, active.width + dx));
        } else if (active.dir.includes('w')) {
            const rightEdge = active.left + active.width;
            const maxW = Math.max(220, rightEdge - 8);
            width = Math.max(220, Math.min(maxW, active.width - dx));
            left = rightEdge - width;
        }
        if (active.dir.includes('s')) {
            const maxH = Math.max(170, window.innerHeight - Math.max(minTop, active.top) - 8);
            height = Math.max(170, Math.min(maxH, active.height + dy));
        }
        setBox({ left, top: active.top, width, height });
    };

    const handlePointerEnd = (e) => {
        if (!interactionRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        interactionRef.current = null;
    };

    const panelStyle = final ? undefined : {
        left: box.left,
        top: box.top,
        width: box.width,
        ...(box.height !== null
            ? { height: box.height, maxHeight: 'none' }
            : { maxHeight: `calc(100dvh - ${box.top + 12}px)` }),
    };

    return (
        <div
            ref={panelRef}
            className="stats-panel"
            style={panelStyle}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
        >
            <div
                className="stats-title"
                onPointerDown={handleDragStart}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
            >
                <span>{final ? 'Итоговый отчёт' : 'Аналитика'}</span>
                {onClose && <button type="button" className="stats-close" aria-label="Скрыть аналитику" onClick={onClose}>×</button>}
            </div>

            <div className="stats-body">
                <div className="stats-section">
                    <div className="stats-section-title">Время</div>
                    <div className="stats-row"><span>Прошло</span><b>{fmtTime(s.elapsed)}</b></div>
                    <div className="stats-row"><span>Первое столкновение</span><b>{fmtTime(s.firstCollisionTime)}</b></div>
                    <div className="stats-row"><span>Последнее</span><b>{fmtTime(s.lastCollisionTime)}</b></div>
                </div>

                <div className="stats-section">
                    <div className="stats-section-title">Тела</div>
                    <div className="stats-row"><span>Сейчас</span><b>{s.bodyCount}</b></div>
                    <div className="stats-row"><span>Было</span><b>{s.initialBodyCount}</b></div>
                    <div className="stats-row"><span>Макс. в кадре</span><b>{s.maxBodyCount}</b></div>
                    <div className="stats-row"><span>Мусора</span><b>{s.debrisCount}</b></div>
                </div>

                <div className="stats-section">
                    <div className="stats-section-title">Столкновения</div>
                    <div className="stats-row"><span>Слияний</span><b>{s.merges}</b></div>
                    <div className="stats-row"><span>Распадов</span><b>{s.fragments}</b></div>
                </div>

                <div className="stats-section">
                    <div className="stats-section-title">Расстояния</div>
                    <div className="stats-row"><span>Среднее</span><b>{fmt(s.avgDistance)}</b></div>
                    <div className="stats-row"><span>Мин.</span><b>{fmt(s.minDistance)}</b></div>
                    <div className="stats-row"><span>Макс.</span><b>{fmt(s.maxDistance)}</b></div>
                    <DistanceChart history={stats.distanceHistory} />
                </div>

                <div className="stats-section">
                    <div className="stats-section-title">Скорости</div>
                    <div className="stats-row"><span>Средняя</span><b>{fmt(s.avgSpeed)}</b></div>
                    <div className="stats-row"><span>Макс.</span><b>{fmt(s.maxSpeed)}</b></div>
                </div>

                <div className="stats-section">
                    <div className="stats-section-title">Энергия</div>
                    <div className="stats-row"><span>Начальная</span><b>{fmt(s.initialEnergy, 4)}</b></div>
                    <div className="stats-row"><span>Текущая</span><b>{fmt(s.energy, 4)}</b></div>
                    <div className="stats-row">
                        <span>Дрейф</span>
                        <b className={Math.abs(s.energyDrift) > 0.1 ? 'drift-warn' : 'drift-ok'}>
                            {fmt(s.energyDrift, 4)}
                        </b>
                    </div>
                </div>
            </div>

            {!final && RESIZE_DIRS.map((dir) => (
                <div
                    key={dir}
                    className={`stats-resize-handle stats-resize-${dir}`}
                    onPointerDown={handleResizeStart(dir)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                    aria-hidden="true"
                />
            ))}
        </div>
    );
}
