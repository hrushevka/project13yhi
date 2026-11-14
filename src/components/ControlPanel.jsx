import { OUTCOME_LABELS } from './utils';
import { PRESETS } from '../utils/presets';

const MIN_SPEED = 1;
const MAX_SPEED = 500;
const MIN_G = 0.1;
const MAX_G = 5;
const G_STEP = 0.1;
const MIN_SOFTENING = 0;
const MAX_SOFTENING = 1;
const SOFTENING_STEP = 0.01;

export function ControlPanel({
    isPanelCollapsed,
    setIsPanelCollapsed,
    running,
    setRunning,
    bodyCount,
    maxBodies,
    outcome,
    timeTextRef,
    speed,
    setSpeed,
    dt,
    setDt,
    gravity,
    setGravity,
    softening,
    setSoftening,
    onReset,
    onClear,
    onStep,
    onCenter,
    onPresetSelect,
    renderEnergy,
}) {
    const handleSpeedChange = (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 1;
        if (val < MIN_SPEED) val = MIN_SPEED;
        if (val > MAX_SPEED) val = MAX_SPEED;
        setSpeed(val);
    };

    const handleDtChange = (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val <= 0) val = 0.0001;
        setDt(val);
    };

    return (
        <div className={`sim-panel-wrapper ${isPanelCollapsed ? 'collapsed' : ''}`}>
            <div className="sim-panel">
                <div className="sim-panel-header" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
                    <div className="sim-panel-title">
                        <span style={{ color: running ? '#4dff88' : '#888' }}>●</span>
                        Панель управления
                    </div>
                    <div className="sim-panel-toggle" style={{ transform: isPanelCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        ▼
                    </div>
                </div>

                <div className="sim-row">
                    <button className="btn-primary" onClick={() => {
                        if (bodyCount >= 1) setRunning(!running);
                    }} disabled={bodyCount < 1}>
                        {running ? 'Пауза' : 'Запуск'}
                    </button>
                    <button onClick={onReset}>Сброс</button>
                    <button onClick={onClear}>Очистить</button>
                    <button onClick={onStep} disabled={running || bodyCount < 1}>Шаг</button>
                    <button onClick={onCenter}>Центр</button>

                    <span className="sim-label" style={{ marginLeft: 'auto' }}>
                        Исход: <b style={{ color: outcome === 'stable' ? '#4dff88' : outcome === 'collision' || outcome === 'ejection' ? '#ff4d4d' : '#fff' }}>
                            {OUTCOME_LABELS[outcome]}
                        </b>
                    </span>
                    <span className="sim-label">
                        Время: <span className="sim-time" ref={timeTextRef}>0.00 с</span>
                    </span>
                </div>

                <div className="sim-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                    <span className="sim-label">Шагов за кадр:</span>
                    <input
                        type="number"
                        min={MIN_SPEED}
                        max={MAX_SPEED}
                        value={speed}
                        onChange={handleSpeedChange}
                        style={{ width: '70px' }}
                    />

                    <span className="sim-label" style={{ marginLeft: '20px' }}>dt (шаг физики):</span>
                    <input
                        type="number"
                        step="0.00001"
                        min="0.00001"
                        value={dt}
                        onChange={handleDtChange}
                        style={{ width: '90px' }}
                    />
                </div>

                <div className="sim-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                    <span className="sim-label">Гравитация (G):</span>
                    <input type="range" min={MIN_G} max={MAX_G} step={G_STEP} value={gravity} onChange={(e) => setGravity(Number(e.target.value))} />
                    <span className="sim-value">{gravity.toFixed(1)}</span>

                    <span className="sim-label" style={{ marginLeft: '20px' }}>Сглаживание:</span>
                    <input type="range" min={MIN_SOFTENING} max={MAX_SOFTENING} step={SOFTENING_STEP} value={softening} onChange={(e) => setSoftening(Number(e.target.value))} />
                    <span className="sim-value">{softening.toFixed(2)}</span>
                </div>

                <div className="sim-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                    <span className="sim-label">Энергия:</span>
                    <span className="sim-value" style={{ minWidth: '100px' }}>{renderEnergy()}</span>
                </div>

                <div className="sim-row" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '15px' }}>
                    <span className="sim-label">Пресеты:</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {PRESETS.map((p) => (
                            <button key={p.name} onClick={() => onPresetSelect(p)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
