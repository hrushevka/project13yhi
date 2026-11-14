import { useState } from 'react';
import { OUTCOME_LABELS } from './utils';
import { PRESETS } from '../utils/presets';
import previews from '../utils/orbit-previews.json' with { type: 'json' };
import { RangeNumber } from './RangeNumber';

function OrbitPreview({ name }) {
    return <svg className="orbit-preview" viewBox="0 0 100 100" aria-hidden="true">
        {(previews[name] ?? []).map((d, i) => <path key={i} d={d} fill="none" stroke={['#ff8276', '#73cfff', '#b7a1ff'][i]} strokeWidth="1.15" />)}
    </svg>;
}

export function ControlPanel({
    isPanelCollapsed, setIsPanelCollapsed, running, setRunning, bodyCount,
    outcome, timeTextRef, speed, setSpeed, dt, setDt, gravity, setGravity,
    softening, setSoftening, onReset, onClear, onStep, onCenter, onPresetSelect,
    renderEnergy, activePreset, exactMode, onExactModeChange, collisions,
    onCollisionsChange, showStats, setShowStats, onShowReport, loopMode, onLoopModeChange,
}) {
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [group, setGroup] = useState('Все');
    const groups = ['Все', 'Классические', 'Овалы Шина', 'Хореографии'];
    return (
        <div className={`sim-panel-wrapper ${isPanelCollapsed ? 'collapsed' : ''}`}>
            <section className="sim-panel" aria-label="Управление симуляцией">
                <div className="sim-row transport-row">
                    <button className="btn-primary" onClick={() => setRunning(!running)} disabled={bodyCount < 1}>
                        {running ? 'Пауза' : 'Запуск'}
                    </button>
                    <button onClick={onReset}>Сброс</button>
                    <button onClick={onStep} disabled={running || bodyCount < 1}>Шаг</button>
                    <button onClick={onCenter}>Центр</button>
                    <span className="sim-label time-display">Время <span className="sim-time" ref={timeTextRef}>0.00 с</span></span>
                    <button className="collapse-control" aria-expanded={!isPanelCollapsed} onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
                        {isPanelCollapsed ? 'Настройки ▴' : 'Свернуть ▾'}
                    </button>
                </div>
                {!isPanelCollapsed && <>
                    <div className="orbit-selection">
                        <OrbitPreview name={activePreset?.name} />
                        <div className="orbit-selection-copy"><span className="eyebrow">{activePreset?.group ?? 'Своя система'}</span>
                            <strong>{activePreset?.name ?? 'Свободное движение'}</strong>
                            <span className="orbit-description">{activePreset?.description ?? 'Двойной щелчок по телу открывает его параметры.'}</span>
                        </div>
                        <button className="gallery-toggle" aria-expanded={galleryOpen} onClick={() => setGalleryOpen(!galleryOpen)}>
                            {galleryOpen ? 'Закрыть каталог' : 'Выбрать орбиту'} <span className="count-badge">{PRESETS.length}</span>
                        </button>
                    </div>
                    {galleryOpen && <div className="orbit-gallery">
                        <div className="orbit-groups" aria-label="Семейства орбит">
                            {groups.map((name) => <button key={name} aria-pressed={group === name} onClick={() => setGroup(name)}>{name}</button>)}
                        </div>
                        <div className="orbit-cards" aria-label="Пресеты">
                            {PRESETS.filter((p) => group === 'Все' || p.group === group).map((p) =>
                                <button className="orbit-card" key={p.name} aria-pressed={activePreset?.name === p.name}
                                    onClick={() => { onPresetSelect(p); setGalleryOpen(false); }}>
                                    <OrbitPreview name={p.name} /><span>{p.name}</span>
                                    <small>{p.solution ? 'Точное решение' : p.period ? `Период ≈ ${p.period.toFixed(2)}` : 'Численная орбита'}</small>
                                </button>)}
                        </div>
                    </div>}
                    <div className="sim-controls-grid">
                        <RangeNumber label="Скорость (×)" value={speed} onChange={setSpeed} min={0.1} max={10} step={0.1} />
                        <RangeNumber label="Шаг времени" value={dt} onChange={setDt} min={0.00001} max={0.01} step={0.00001} />
                        <RangeNumber label="Гравитация (G)" value={gravity} onChange={setGravity} min={0} max={5} step={0.01} />
                        <RangeNumber label="Сглаживание" value={softening} onChange={setSoftening} min={0} max={1} step={0.001} />
                    </div>
                    <div className="sim-row sim-options">
                        {activePreset?.solution && <label><input type="checkbox" checked={exactMode} onChange={(e) => onExactModeChange(e.target.checked)} /> Точное решение пресета</label>}
                        {activePreset?.period && <label><input type="checkbox" checked={loopMode} onChange={(e) => onLoopModeChange(e.target.checked)} /> Повтор периода</label>}
                        <label><input type="checkbox" checked={collisions} onChange={(e) => onCollisionsChange(e.target.checked)} /> Столкновения</label>
                        <label><input type="checkbox" checked={showStats} onChange={(e) => setShowStats(e.target.checked)} /> Аналитика</label>
                        <button className="quiet-button" onClick={onShowReport}>Отчёт</button>
                        <button className="quiet-button" onClick={onClear}>Очистить</button>
                    </div>
                    <div className="simulation-footer">
                        <span className="mode-badge" role="status">{exactMode ? 'Точное решение Ньютона' : loopMode ? 'Повтор численного периода' : 'Численное решение Ньютона'}</span>
                        <span className="energy-label">E <b>{renderEnergy()}</b></span>
                        <span className="outcome-label">{exactMode || loopMode ? 'Периодическая демонстрация' : OUTCOME_LABELS[outcome]}</span>
                    </div>
                    <details className="mode-help"><summary>О режиме движения</summary>
                        <p>{loopMode ? 'Повторяется один рассчитанный период опубликованной орбиты. Это численная демонстрация с небольшой погрешностью замыкания, а не точное аналитическое решение. Снимите флажок, чтобы продолжить свободную эволюцию.'
                            : exactMode ? 'Точное решение для выбранной конфигурации. Изменение тел, G или сглаживания включает численное движение.'
                                : 'Система движется по уравнениям Ньютона. Неустойчивые орбиты могут распадаться. Изменение параметров меняет движение.'}</p>
                    </details>
                </>}
            </section>
        </div>
    );
}
