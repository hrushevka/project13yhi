import { RangeNumber } from './RangeNumber';

export function ControlPanel({
    isPanelCollapsed,
    setIsPanelCollapsed,
    running,
    setRunning,
    bodyCount,
    timeTextRef,
    speed,
    setSpeed,
    gravity,
    setGravity,
    collisions,
    onCollisionsChange,
    onReset,
    onClear,
    onOpenSimulation,
}) {
    return (
        <div className={`sim-panel-wrapper ${isPanelCollapsed ? 'collapsed' : ''}`}>
            <section className="sim-panel" aria-label="Управление симуляцией">
                <div className="sim-row transport-row">
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setRunning(!running)}
                        disabled={bodyCount < 1}
                    >
                        {running ? 'Пауза' : 'Запуск'}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenSimulation}
                        disabled={bodyCount < 2}
                    >
                        Симуляция
                    </button>
                    <button type="button" onClick={onReset}>Сброс</button>
                    <button type="button" onClick={onClear}>Очистить</button>
                    <span className="sim-label time-display">
                        Время <span className="sim-time" ref={timeTextRef}>0.00 с</span>
                    </span>
                    <button
                        type="button"
                        className="collapse-control"
                        aria-expanded={!isPanelCollapsed}
                        onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                    >
                        {isPanelCollapsed ? 'Настройки ▴' : 'Свернуть ▾'}
                    </button>
                </div>

                {!isPanelCollapsed && (
                    <div className="sim-settings-body">
                        <div className="sim-controls-grid">
                            <RangeNumber
                                label="Скорость (×)"
                                value={speed}
                                onChange={setSpeed}
                                min={0.1}
                                max={10}
                                step={0.1}
                            />
                            <RangeNumber
                                label="Гравитация (G)"
                                value={gravity}
                                onChange={setGravity}
                                min={0}
                                max={5}
                                step={0.01}
                            />
                        </div>

                        <div className="sim-row sim-options">
                            <label className="cosmos-checkbox">
                                <input
                                    type="checkbox"
                                    checked={collisions}
                                    onChange={(e) => onCollisionsChange(e.target.checked)}
                                />
                                <span className="cosmos-checkbox-box" aria-hidden="true">
                                    {collisions && (
                                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                                        </svg>
                                    )}
                                </span>
                                <span>Столкновения</span>
                            </label>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
