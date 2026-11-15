import { RangeNumber } from './RangeNumber';
import { FloatingPanel } from './FloatingPanel';

export function ControlPanel({
    running,
    setRunning,
    bodyCount,
    timeTextRef,
    speed,
    setSpeed,
    gravity,
    setGravity,
    collisions,
    onOpenCatalog,
    configuration,
    onCollisionsChange,
    onReset,
    onClear,
    onOpenSimulation,
}) {
    return (
        <FloatingPanel id="controls" title="Центр управления" className="controls-panel" collapsedControls={
            <div className="compact-transport">
                <button type="button" className="compact-catalog" onClick={onOpenCatalog}>Каталог</button>
                <button type="button" className="compact-play" onClick={() => setRunning(!running)} disabled={bodyCount < 1}>{running ? 'Пауза' : 'Старт'}</button>
                <button type="button" onClick={onReset} title="Остановить и сбросить">Финиш</button>
                <label className="compact-speed">
                    <span>{speed.toFixed(1)}×</span>
                    <input type="range" min="0.1" max="10" step="0.1" value={speed} aria-label="Скорость в свёрнутой панели" onChange={e => setSpeed(Number(e.target.value))} />
                </label>
            </div>
        }>
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
                </div>

                {(
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

                        <button type="button" onClick={onOpenCatalog} aria-label="Каталог орбит">Каталог орбит</button>
                        {!collisions && <div className="collision-note">{configuration.exactSolution ? 'Точная орбита: коллизии выключены. Численную проверку можно выбрать в параметрах симуляции.' : configuration.isPreset ? 'Коллизии выключены: устойчивость пресета не подтверждена.' : 'Коллизии выключены вручную.'}</div>}
                        <div className="sim-row sim-options">
                            <label className="cosmos-checkbox">
                                <input
                                    type="checkbox"
                                    checked={collisions}
                                    disabled={configuration.isPreset}
                                    onChange={e => onCollisionsChange(e.target.checked)}
                                />
                                <span className="cosmos-checkbox-box" aria-hidden="true">
                                    {collisions && (
                                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                                        </svg>
                                    )}
                                </span>
                                <span>Коллизии: {collisions ? 'включены' : 'выключены'}{configuration.isPreset ? ' · авто' : ''}</span>
                            </label>
                        </div>
                    </div>
                )}
            </section>
        </FloatingPanel>
    );
}
