import { getSummary } from '../utils/stats';

function fmt(v, digits = 3) {
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(digits)).toString();
}

function fmtTime(t) {
    if (t === null || t === undefined) return '—';
    return `${t.toFixed(2)} с`;
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

export function StatsPanel({ stats, final = false, onClose }) {
    const s = getSummary(stats);
    return (
        <div className="stats-panel">
            <div className="stats-title">
                <span>{final ? 'Итоговый отчёт' : 'Аналитика'}</span>
                {onClose && <button type="button" className="stats-close" aria-label="Скрыть аналитику" onClick={onClose}>×</button>}
            </div>

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
    );
}
