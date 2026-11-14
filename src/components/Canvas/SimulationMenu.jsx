import { useEffect, useId, useRef, useState } from 'react';
import { OUTCOME_LABELS, roundFloat, toFloat, COLORS } from './utils';

const EXPECTED_OPTIONS = [
    { value: 'stable', label: 'Стабильно' },
    { value: 'collision', label: 'Столкновение' },
    { value: 'ejection', label: 'Выброс' },
];

function LineChart({ title, series, duration, isExpanded, onToggleExpand }) {
    const clipId = useId();
    const svgRef = useRef(null);
    const dragRef = useRef(null);

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [hoverT, setHoverT] = useState(null);

    const width = isExpanded ? 860 : 300;
    const height = isExpanded ? 170 : 135;
    const padL = 48;
    const padR = 12;
    const padT = 10;
    const padB = 20;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;

    let rawMinY = Infinity;
    let rawMaxY = -Infinity;

    for (const s of series) {
        for (const pt of s.points) {
            if (Number.isFinite(pt.y)) {
                if (pt.y < rawMinY) rawMinY = pt.y;
                if (pt.y > rawMaxY) rawMaxY = pt.y;
            }
        }
    }

    if (!Number.isFinite(rawMinY) || !Number.isFinite(rawMaxY)) {
        rawMinY = 0;
        rawMaxY = 1;
    } else if (Math.abs(rawMaxY - rawMinY) < 1e-6) {
        rawMinY -= 0.5;
        rawMaxY += 0.5;
    } else {
        const margin = (rawMaxY - rawMinY) * 0.06;
        rawMinY -= margin;
        rawMaxY += margin;
    }

    const maxT = Math.max(0.01, duration);
    const baseSpanY = rawMaxY - rawMinY;

    const spanT = maxT / zoom;
    const viewMinT = pan.x * maxT;
    const viewMaxT = viewMinT + spanT;

    const spanY = baseSpanY / zoom;
    const viewMinY = rawMinY + pan.y * baseSpanY;
    const viewMaxY = viewMinY + spanY;

    const toX = (t) => padL + ((t - viewMinT) / spanT) * plotW;
    const toY = (v) => padT + plotH - ((v - viewMinY) / spanY) * plotH;

    const applyZoom = (factor, anchorX = 0.5, anchorY = 0.5) => {
        setZoom((prevZoom) => {
            const nextZoom = Math.min(25, Math.max(1, roundFloat(prevZoom * factor, 3)));
            if (nextZoom === 1) {
                setPan({ x: 0, y: 0 });
                return 1;
            }
            setPan((prevPan) => {
                const normX = prevPan.x + anchorX / prevZoom;
                const normY = prevPan.y + anchorY / prevZoom;
                const maxOffset = Math.max(0, 1 - 1 / nextZoom);
                return {
                    x: Math.min(maxOffset, Math.max(0, normX - anchorX / nextZoom)),
                    y: Math.min(maxOffset, Math.max(0, normY - anchorY / nextZoom)),
                };
            });
            return nextZoom;
        });
    };

    const resetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    useEffect(() => {
        const el = svgRef.current;
        if (!el) return undefined;

        const onWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = el.getBoundingClientRect();
            const svgX = ((e.clientX - rect.left) / rect.width) * width;
            const svgY = ((e.clientY - rect.top) / rect.height) * height;
            const relX = Math.min(1, Math.max(0, (svgX - padL) / plotW));
            const relY = Math.min(1, Math.max(0, 1 - (svgY - padT) / plotH));
            const factor = e.deltaY < 0 ? 1.25 : 0.8;
            applyZoom(factor, relX, relY);
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [width, height, plotW, plotH]);

    const handleSvgPointerDown = (e) => {
        e.stopPropagation();
        const el = svgRef.current;
        if (!el) return;
        el.setPointerCapture(e.pointerId);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPanX: pan.x,
            startPanY: pan.y,
        };
    };

    const handleSvgPointerMove = (e) => {
        e.stopPropagation();
        const el = svgRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * width;
        const relX = (svgX - padL) / plotW;
        if (relX >= 0 && relX <= 1) {
            setHoverT(viewMinT + relX * spanT);
        } else {
            setHoverT(null);
        }

        if (!dragRef.current || zoom <= 1) return;
        const dxSvg = ((e.clientX - dragRef.current.startX) / rect.width) * width;
        const dySvg = ((e.clientY - dragRef.current.startY) / rect.height) * height;
        const dNormX = -dxSvg / plotW / zoom;
        const dNormY = dySvg / plotH / zoom;
        const maxOffset = Math.max(0, 1 - 1 / zoom);

        setPan({
            x: Math.min(maxOffset, Math.max(0, dragRef.current.startPanX + dNormX)),
            y: Math.min(maxOffset, Math.max(0, dragRef.current.startPanY + dNormY)),
        });
    };

    const handleSvgPointerUp = (e) => {
        e.stopPropagation();
        if (dragRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragRef.current = null;
    };

    const handleSvgPointerLeave = () => {
        setHoverT(null);
    };

    let hoverSampleIdx = -1;
    if (hoverT !== null && series[0]?.points?.length) {
        const pts = series[0].points;
        let bestDist = Infinity;
        for (let i = 0; i < pts.length; i++) {
            const d = Math.abs(pts[i].t - hoverT);
            if (d < bestDist) {
                bestDist = d;
                hoverSampleIdx = i;
            }
        }
    }

    return (
        <div className={`sim-chart-block ${isExpanded ? 'is-expanded' : ''}`}>
            <div className="sim-chart-header">
                <span className="sim-chart-title">{title}</span>
                <div className="sim-chart-zoom-controls">
                    <span className="sim-zoom-badge">{zoom.toFixed(1)}x</span>
                    <button type="button" onClick={() => applyZoom(1.35)}>+</button>
                    <button type="button" onClick={() => applyZoom(1 / 1.35)} disabled={zoom <= 1}>-</button>
                    <button type="button" onClick={resetZoom} disabled={zoom <= 1}>1:1</button>
                    <button type="button" onClick={onToggleExpand}>
                        {isExpanded ? 'Свернуть' : 'Шире'}
                    </button>
                </div>
            </div>

            <div className="sim-chart-legend">
                {series.map((s) => {
                    const val = hoverSampleIdx >= 0 ? s.points[hoverSampleIdx]?.y : null;
                    return (
                        <span key={s.label} className="sim-legend-item">
                            <span className="sim-legend-dot" style={{ background: s.color }} />
                            {s.label}
                            {Number.isFinite(val) ? `: ${val.toFixed(2)}` : ''}
                        </span>
                    );
                })}
            </div>

            <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className={`sim-chart-svg ${zoom > 1 ? 'is-zoomed' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                onPointerDown={handleSvgPointerDown}
                onPointerMove={handleSvgPointerMove}
                onPointerUp={handleSvgPointerUp}
                onPointerCancel={handleSvgPointerUp}
                onPointerLeave={handleSvgPointerLeave}
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect x={padL} y={padT} width={plotW} height={plotH} />
                    </clipPath>
                </defs>

                <rect x={padL} y={padT} width={plotW} height={plotH} fill="#141414" />

                <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#333" strokeWidth="1" />
                <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#333" strokeWidth="1" />
                <line
                    x1={padL}
                    y1={padT + plotH / 2}
                    x2={padL + plotW}
                    y2={padT + plotH / 2}
                    stroke="#222"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                />
                <line
                    x1={padL + plotW / 2}
                    y1={padT}
                    x2={padL + plotW / 2}
                    y2={padT + plotH}
                    stroke="#222"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                />

                <text x={padL - 4} y={padT + 8} textAnchor="end" fill="#888" fontSize="9">
                    {viewMaxY.toFixed(2)}
                </text>
                <text x={padL - 4} y={padT + plotH / 2 + 3} textAnchor="end" fill="#666" fontSize="8">
                    {((viewMaxY + viewMinY) / 2).toFixed(2)}
                </text>
                <text x={padL - 4} y={padT + plotH} textAnchor="end" fill="#888" fontSize="9">
                    {viewMinY.toFixed(2)}
                </text>

                <text x={padL} y={height - 4} textAnchor="start" fill="#888" fontSize="9">
                    {viewMinT.toFixed(1)}с
                </text>
                <text x={padL + plotW / 2} y={height - 4} textAnchor="middle" fill="#666" fontSize="8">
                    {((viewMinT + viewMaxT) / 2).toFixed(1)}с
                </text>
                <text x={padL + plotW} y={height - 4} textAnchor="end" fill="#888" fontSize="9">
                    {viewMaxT.toFixed(1)}с
                </text>

                <g clipPath={`url(#${clipId})`}>
                    {series.map((s) => {
                        if (s.points.length < 2) return null;
                        const d = s.points
                            .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(pt.t).toFixed(1)} ${toY(pt.y).toFixed(1)}`)
                            .join(' ');
                        return (
                            <path
                                key={s.label}
                                d={d}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="1.5"
                            />
                        );
                    })}

                    {hoverSampleIdx >= 0 && series[0]?.points?.[hoverSampleIdx] && (
                        <line
                            x1={toX(series[0].points[hoverSampleIdx].t)}
                            y1={padT}
                            x2={toX(series[0].points[hoverSampleIdx].t)}
                            y2={padT + plotH}
                            stroke="#555"
                            strokeDasharray="2 2"
                            strokeWidth="1"
                        />
                    )}
                </g>
            </svg>
        </div>
    );
}

export function SimulationSetupMenu({ onStart, onClose }) {
    const [pos, setPos] = useState(() => ({
        x: Math.max(10, Math.floor((window.innerWidth - 280) / 2)),
        y: Math.max(60, Math.floor((window.innerHeight - 280) / 2)),
    }));
    const [targetTime, setTargetTime] = useState(10);
    const [expectedOutcome, setExpectedOutcome] = useState('stable');

    const dragOffsetRef = useRef(null);

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (e.target.closest('input') || e.target.closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffsetRef.current = {
            dx: e.clientX - pos.x,
            dy: e.clientY - pos.y,
        };
    };

    const handlePointerMove = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        const nextX = Math.max(10, Math.min(window.innerWidth - 290, e.clientX - dragOffsetRef.current.dx));
        const nextY = Math.max(56, Math.min(window.innerHeight - 260, e.clientY - dragOffsetRef.current.dy));
        setPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragOffsetRef.current = null;
    };

    const handleTimeChange = (e) => {
        const parsed = parseFloat(e.target.value);
        if (Number.isFinite(parsed) && parsed > 0) {
            setTargetTime(roundFloat(parsed, 2));
        }
    };

    return (
        <div
            className="body-menu sim-modal"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="body-menu-header">
                <span>Параметры симуляции</span>
                <button type="button" onClick={onClose}>X</button>
            </div>

            <div className="body-menu-grid">
                <div className="body-menu-field">
                    <label>Время (с)</label>
                    <input
                        type="number"
                        step="1"
                        min="0.5"
                        max="500"
                        value={targetTime}
                        onChange={handleTimeChange}
                    />
                </div>

                <div className="sim-expect-group">
                    <label>Ожидаемый результат</label>
                    <div className="sim-expect-options">
                        {EXPECTED_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                className={expectedOutcome === opt.value ? 'btn-primary' : ''}
                                onClick={() => setExpectedOutcome(opt.value)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="body-menu-actions">
                <button type="button" onClick={onClose}>
                    Отмена
                </button>
                <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onStart(Math.max(0.5, toFloat(targetTime, 10)), expectedOutcome)}
                >
                    Запустить
                </button>
            </div>
        </div>
    );
}

export function SimulationReportModal({ report, onClose }) {
    const modalRef = useRef(null);
    const [expandedIdx, setExpandedIdx] = useState(null);

    const [pos, setPos] = useState(() => {
        const w = Math.min(920, window.innerWidth - 24);
        const h = 390;
        return {
            x: Math.max(12, Math.floor((window.innerWidth - w) / 2)),
            y: Math.max(58, Math.min(Math.max(58, window.innerHeight - h - 16), Math.floor((window.innerHeight - h) / 2))),
        };
    });

    const dragOffsetRef = useRef(null);

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (e.target.closest('button') || e.target.closest('.sim-chart-svg')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffsetRef.current = {
            dx: e.clientX - pos.x,
            dy: e.clientY - pos.y,
        };
    };

    const handlePointerMove = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        const el = modalRef.current;
        const w = el ? el.offsetWidth : Math.min(920, window.innerWidth - 24);
        const h = el ? el.offsetHeight : 380;
        const maxX = Math.max(10, window.innerWidth - w - 10);
        const maxY = Math.max(56, window.innerHeight - h - 10);
        const nextX = Math.max(10, Math.min(maxX, e.clientX - dragOffsetRef.current.dx));
        const nextY = Math.max(56, Math.min(maxY, e.clientY - dragOffsetRef.current.dy));
        setPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragOffsetRef.current = null;
    };

    const samples = report.samples;
    const duration = report.elapsedTime;

    const charts = [
        {
            title: 'Расстояния r(t)',
            series: [
                {
                    label: 'r12',
                    color: '#f59e0b',
                    points: samples.map((s) => ({ t: s.t, y: s.d12 })),
                },
                {
                    label: 'r23',
                    color: '#38bdf8',
                    points: samples.map((s) => ({ t: s.t, y: s.d23 })),
                },
                {
                    label: 'r13',
                    color: '#a855f7',
                    points: samples.map((s) => ({ t: s.t, y: s.d13 })),
                },
            ],
        },
        {
            title: 'Скорости v(t)',
            series: [
                {
                    label: 'Т1',
                    color: COLORS[0],
                    points: samples.map((s) => ({ t: s.t, y: s.v1 })),
                },
                {
                    label: 'Т2',
                    color: COLORS[1],
                    points: samples.map((s) => ({ t: s.t, y: s.v2 })),
                },
                {
                    label: 'Т3',
                    color: COLORS[2],
                    points: samples.map((s) => ({ t: s.t, y: s.v3 })),
                },
            ],
        },
        {
            title: 'Энергия E(t)',
            series: [
                {
                    label: 'K',
                    color: '#4dff88',
                    points: samples.map((s) => ({ t: s.t, y: s.kinetic })),
                },
                {
                    label: 'U',
                    color: '#ff4d4d',
                    points: samples.map((s) => ({ t: s.t, y: s.potential })),
                },
                {
                    label: 'E',
                    color: '#ffffff',
                    points: samples.map((s) => ({ t: s.t, y: s.totalE })),
                },
            ],
        },
    ];

    return (
        <div
            ref={modalRef}
            className="body-menu sim-report-modal"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="body-menu-header">
                <span>Статистика и графики (колесо — зум, ЛКМ — сдвиг)</span>
                <button type="button" onClick={onClose}>X</button>
            </div>

            <div className={`sim-modal-result ${report.matched ? 'matched' : 'mismatched'}`}>
                <div>
                    Ожидание: <b>{OUTCOME_LABELS[report.expected]}</b> | Реальный исход: <b>{OUTCOME_LABELS[report.actual]}</b>
                </div>
                <div>
                    {report.matched ? 'Прогноз совпал' : 'Прогноз не совпал'}
                </div>
            </div>

            <div className="sim-stats-grid">
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Время</span>
                    <span className="sim-stat-val">{report.elapsedTime.toFixed(2)} / {report.targetTime.toFixed(2)} с</span>
                </div>
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Мин. r</span>
                    <span className="sim-stat-val">{report.minDist.toFixed(4)}</span>
                </div>
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Макс. r</span>
                    <span className="sim-stat-val">{report.maxDist.toFixed(4)}</span>
                </div>
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Макс. v</span>
                    <span className="sim-stat-val">{report.maxSpeed.toFixed(4)}</span>
                </div>
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Энергия E0</span>
                    <span className="sim-stat-val">{report.initialEnergy.toFixed(4)}</span>
                </div>
                <div className="sim-stat-box">
                    <span className="sim-stat-label">Дрейф ΔE</span>
                    <span className="sim-stat-val">{report.energyDrift.toExponential(2)}</span>
                </div>
            </div>

            <div className={`sim-charts-list ${expandedIdx !== null ? 'has-expanded' : ''}`}>
                {charts.map((cfg, idx) => {
                    if (expandedIdx !== null && expandedIdx !== idx) return null;
                    return (
                        <LineChart
                            key={cfg.title}
                            title={cfg.title}
                            series={cfg.series}
                            duration={duration}
                            isExpanded={expandedIdx === idx}
                            onToggleExpand={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        />
                    );
                })}
            </div>

            <div className="body-menu-actions">
                <button type="button" className="btn-primary" onClick={onClose}>
                    Закрыть
                </button>
            </div>
        </div>
    );
}
