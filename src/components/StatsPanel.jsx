import { StabilityIndicator } from './StabilityIndicator';
import { FloatingPanel } from './FloatingPanel';
import { getSummary } from '../utils/stats';

export function StatsPanel({ stats, final = false, onClose, stability, exactSolution = false, collisions = false, running = false }) {
    const s = getSummary(stats);
    const live = stats.live;
    const closest = live?.pairs[0];
    const status = exactSolution ? 'Точная орбита' : !closest ? 'Нет пары для сближения' : closest.gap <= 0 ? (collisions ? 'Контакт тел' : 'Тела проходят друг сквозь друга') : closest.radialSpeed < -.001 ? `Сближаются тела ${closest.label}` : closest.radialSpeed > .001 ? `Расходятся тела ${closest.label}` : 'Расстояние почти не меняется';
    const content = <div className="telemetry">
        <div className="telemetry-banner"><span className="live-dot" />{running ? 'В ДВИЖЕНИИ' : 'ПАУЗА'}<span>{fmtTime(s.elapsed)}</span></div>
        <section className="live-status"><strong>{status}</strong><p>{exactSolution ? 'Идеальная траектория без накопления отклонений. Коллизии выключены. Это не проверка устойчивости к возмущениям.' : collisions ? 'Контакты приводят к слиянию тел.' : 'Коллизии выключены: пересечение радиусов не останавливает движение.'}</p></section>
        <div className="metric-grid">
            <div className="metric"><small>Зазор между телами</small><strong>{fmt(closest?.gap)}</strong><span>{closest ? `ближайшая пара ${closest.label} · усл. ед.` : 'нужно хотя бы два тела'}</span></div>
            <div className="metric"><small>Размер системы</small><strong>{fmt(live?.sizeRatio, 2)}<em> ×</em></strong><span>относительно начала</span></div>
        </div>
        <section className="telemetry-section"><div className="telemetry-heading"><h3>Сближения сейчас</h3><span>зазор / движение</span></div>
            <div className="pair-list">{live?.pairs.map(pair => <div key={pair.label}><b>{pair.label}</b><span>{fmt(pair.gap)}</span><small>{Math.abs(pair.radialSpeed) < .001 ? '≈ без изменения' : `${pair.radialSpeed < 0 ? '↘ ближе' : '↗ дальше'} ${fmt(Math.abs(pair.radialSpeed))}/с`}</small></div>)}</div>
            <p className="solution-note">Зазор отсчитывается между поверхностями. Отрицательный — пересечение радиусов. Направление измерено сейчас, а не предсказано.</p>
        </section>
        <section className="telemetry-section"><div className="telemetry-heading"><h3>Расстояния за последние 30 с</h3></div><DistanceChart history={stats.distanceHistory} height={90} /><div className="chart-legend">Линия — среднее; область — от min до max</div></section>
        <section className="telemetry-section"><div className="telemetry-heading"><h3>Скорости тел</h3><span>усл. ед./с</span></div><div className="speed-cards">{live?.speeds.map(b => <span key={b.label}>Т{b.label} <b>{fmt(b.speed)}</b></span>)}</div></section>
        <section className="telemetry-section"><div className="telemetry-heading"><h3>События</h3><span>{s.bodyCount} из {s.initialBodyCount} тел</span></div>
            {stats.events?.length ? <ol className="event-list">{[...stats.events].reverse().map((event, i) => <li key={i}><time>{fmtTime(event.time)}</time> {event.kind === 'merge' ? 'Слияние тел' : 'Фрагментация'}</li>)}</ol> : <p className="solution-note">Столкновений пока не было.</p>}
        </section>
        <details className="analytics-details"><summary>Прогноз начальной конфигурации</summary>{stability && <StabilityIndicator result={stability} />}<p className="solution-note">Оценка на 10 с от последнего изменения параметров. Не является прогнозом от текущего момента.</p></details>
        <details className="analytics-details"><summary>Точность расчёта</summary><p className="solution-note">ΔE = {fmt(s.energyDrift, 8)}. После слияний энергия меняется физически; это не только погрешность.</p></details>
    </div>;
    return final ? content : <FloatingPanel id="analytics" title="Аналитика полёта" className="analytics-panel" onClose={onClose}>{content}</FloatingPanel>;
}

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

