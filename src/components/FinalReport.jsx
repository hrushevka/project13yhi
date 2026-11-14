import { getSummary } from '../utils/stats';
import { OUTCOME_LABELS } from './utils';

function fmt(v, digits = 3) {
    if (!Number.isFinite(v)) return '—';
    return Number(v.toFixed(digits)).toString();
}

function fmtTime(t) {
    if (t === null || t === undefined) return '—';
    return `${t.toFixed(2)} с`;
}

export function FinalReport({ stats, outcome, onClose }) {
    const s = getSummary(stats);
    return (
        <div className="report-overlay" onClick={onClose}>
            <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                <div className="report-header">
                    <h2>Отчёт симуляции</h2>
                    <button type="button" onClick={onClose} aria-label="Закрыть отчёт">✕</button>
                </div>
                <div className="report-body">
                    <div className="report-block">
                        <h3>Исход</h3>
                        <p className="report-outcome">{OUTCOME_LABELS[outcome] || outcome}</p>
                    </div>
                    <div className="report-block">
                        <h3>Время</h3>
                        <div className="report-row"><span>Длительность</span><b>{fmtTime(s.elapsed)}</b></div>
                        <div className="report-row"><span>Первое столкновение</span><b>{fmtTime(s.firstCollisionTime)}</b></div>
                        <div className="report-row"><span>Последнее</span><b>{fmtTime(s.lastCollisionTime)}</b></div>
                    </div>
                    <div className="report-block">
                        <h3>Тела</h3>
                        <div className="report-row"><span>Изначально</span><b>{s.initialBodyCount}</b></div>
                        <div className="report-row"><span>В конце</span><b>{s.bodyCount}</b></div>
                        <div className="report-row"><span>Максимум</span><b>{s.maxBodyCount}</b></div>
                        <div className="report-row"><span>Мусора</span><b>{s.debrisCount}</b></div>
                    </div>
                    <div className="report-block">
                        <h3>Столкновения</h3>
                        <div className="report-row"><span>Слияний</span><b>{s.merges}</b></div>
                        <div className="report-row"><span>Распадов</span><b>{s.fragments}</b></div>
                    </div>
                    <div className="report-block">
                        <h3>Расстояния</h3>
                        <div className="report-row"><span>Среднее</span><b>{fmt(s.avgDistance)}</b></div>
                        <div className="report-row"><span>Минимальное</span><b>{fmt(s.minDistance)}</b></div>
                        <div className="report-row"><span>Максимальное</span><b>{fmt(s.maxDistance)}</b></div>
                    </div>
                    <div className="report-block">
                        <h3>Скорости</h3>
                        <div className="report-row"><span>Средняя</span><b>{fmt(s.avgSpeed)}</b></div>
                        <div className="report-row"><span>Максимальная</span><b>{fmt(s.maxSpeed)}</b></div>
                    </div>
                    <div className="report-block report-block-wide">
                        <h3>Энергия</h3>
                        <div className="report-row"><span>Начальная</span><b>{fmt(s.initialEnergy, 5)}</b></div>
                        <div className="report-row"><span>Конечная</span><b>{fmt(s.energy, 5)}</b></div>
                        <div className="report-row">
                            <span>Дрейф</span>
                            <b className={Math.abs(s.energyDrift) > 0.1 ? 'drift-warn' : 'drift-ok'}>
                                {fmt(s.energyDrift, 5)}
                            </b>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
