import { OUTCOME_LABELS, roundFloat, toFloat } from './utils';
import { PRESETS } from '../../utils/presets';

const MIN_SPEED = 0.1;
const MAX_SPEED = 10;
const SPEED_STEP = 0.1;
const MIN_G = 0.1;
const MAX_G = 5;
const G_STEP = 0.1;

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
    gravity,
    setGravity,
    onReset,
    onClear,
    onPresetSelect,
}) {
    const handleCustomSpeedChange = (e) => {
        const num = parseFloat(e.target.value);
        if (Number.isFinite(num) && num > 0) {
            setSpeed(roundFloat(num, 3));
        }
    };

    const handleCustomGravityChange = (e) => {
        const num = parseFloat(e.target.value);
        if (Number.isFinite(num) && num >= 0) {
            setGravity(roundFloat(num, 3));
        }
    };

    const numericSpeed = toFloat(speed, 1);
    const numericGravity = toFloat(gravity, 1);

    return (
        <div className="sim-panel-wrapper">
            <div className="sim-panel">
                <div className="sim-panel-top">
                    <div className="sim-top-actions">
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                                if (bodyCount === maxBodies) setRunning(!running);
                            }}
                            disabled={bodyCount !== maxBodies}
                        >
                            {running ? 'Пауза' : 'Запуск'}
                        </button>
                        <button type="button" onClick={onReset}>
                            Сброс
                        </button>
                        <button type="button" onClick={onClear}>
                            Очистить
                        </button>
                        <span className="sim-time" ref={timeTextRef}>0.00 с</span>
                    </div>

                    <button
                        type="button"
                        className="sim-toggle-btn"
                        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                    >
                        {isPanelCollapsed ? '▲' : '▼'}
                    </button>
                </div>

                {!isPanelCollapsed && (
                    <div className="sim-panel-body">
                        <div className="sim-row">
                            <span className="sim-label">Время:</span>
                            <input
                                type="range"
                                min={MIN_SPEED}
                                max={MAX_SPEED}
                                step={SPEED_STEP}
                                value={Math.min(MAX_SPEED, Math.max(MIN_SPEED, numericSpeed))}
                                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                            />
                            <div className="sim-input-unit">
                                <input
                                    type="number"
                                    step={SPEED_STEP}
                                    min="0.01"
                                    className="sim-value-input"
                                    value={numericSpeed}
                                    onChange={handleCustomSpeedChange}
                                />
                                <span>с</span>
                            </div>

                            <span className="sim-label">Гравитация:</span>
                            <input
                                type="range"
                                min={MIN_G}
                                max={MAX_G}
                                step={G_STEP}
                                value={Math.min(MAX_G, Math.max(MIN_G, numericGravity))}
                                onChange={(e) => setGravity(parseFloat(e.target.value))}
                            />
                            <input
                                type="number"
                                step={G_STEP}
                                min="0"
                                className="sim-value-input"
                                value={numericGravity}
                                onChange={handleCustomGravityChange}
                            />

                            <span className="sim-status">
                                {OUTCOME_LABELS[outcome]}
                            </span>
                        </div>

                        <div className="sim-row">
                            <div className="sim-presets">
                                {PRESETS.map((p) => (
                                    <button
                                        key={p.name}
                                        type="button"
                                        onClick={() => onPresetSelect(p)}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
