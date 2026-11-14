import { FloatingPanel } from './FloatingPanel';
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
    const last = stats.distanceHistory.at(-1);
    const drift = Math.abs(s.initialEnergy) > 1e-9 ? s.energyDrift / Math.abs(s.initialEnergy) * 100 : null;
    const impacts = s.merges + s.fragments;
    const content = (
        <div className="telemetry">
            <div className="telemetry-banner"><span className="live-dot" /> ТЕЛЕМЕТРИЯ <span>{fmtTime(s.elapsed)}</span></div>
            <div className="metric-grid">
                <div className="metric"><small>Тел в системе</small><strong>{s.bodyCount}<em> / {s.initialBodyCount}</em></strong><span>планеты</span></div>
                <div className="metric"><small>События</small><strong>{impacts}<em> ударов</em></strong><span>слияния планет</span></div>
            </div>
            <section className="telemetry-section">
                <div className="telemetry-heading"><h3>Пульс орбиты</h3><span>расстояние · усл. ед.</span></div>
                <DistanceChart history={stats.distanceHistory} height={110} />
                {last && <div className="metric-strip"><span>{fmtTime(stats.distanceHistory[0].t)}</span><span>{fmtTime(last.t)}</span></div>}
                <div className="chart-legend"><span>━ среднее между телами</span><span>▰ диапазон min–max</span></div>
                <div className="metric-strip"><span>Сейчас <b>{last ? fmt(last.avg) : '—'}</b></span><span>Сближение <b>{last ? fmt(s.minDistance) : '—'}</b></span></div>
            </section>
            <section className="energy-card">
                <div className="telemetry-heading"><h3>Баланс энергии</h3><span className={impacts ? '' : Math.abs(drift ?? 0) > 1 ? 'drift-warn' : 'drift-ok'}>{drift === null ? 'ΔE ' + fmt(s.energyDrift, 4) : fmt(drift, 3) + '%'}</span></div>
                <meter min="0" max="1" value={Math.min(1, Math.abs(drift ?? 0) / 100)} aria-label="Относительное изменение энергии" />
                <p>{impacts ? 'При слияниях механическая энергия меняется — это не только ошибка расчёта.' : 'Без столкновений энергия должна сохраняться. Рост отклонения показывает погрешность расчёта.'}</p>
                <div className="metric-strip"><span>Начало <b>{fmt(s.initialEnergy, 4)}</b></span><span>Сейчас <b>{fmt(s.energy, 4)}</b></span></div>
            </section>
            <div className="metric-strip speed-strip"><span>Средняя скорость <b>{stats.avgSpeedSamples ? fmt(s.avgSpeed) : '—'}</b></span><span>Пиковая <b>{stats.avgSpeedSamples ? fmt(s.maxSpeed) : '—'}</b></span></div>
            <div className="insight"><b>{impacts ? 'Зафиксирован контакт' : s.elapsed ? 'Наблюдение за системой' : 'Готовы к исследованию'}</b><p>{impacts ? 'Последний контакт: ' + fmtTime(s.lastCollisionTime) + '.' : 'Запустите движение. График покажет сближения, а энергия — точность расчёта. Все величины в условных единицах.'}</p></div>
        </div>
    );
    return final ? content : <FloatingPanel id="analytics" title="Аналитика полёта" className="analytics-panel" onClose={onClose}>{content}</FloatingPanel>;
}
