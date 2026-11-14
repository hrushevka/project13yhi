import { useEffect, useState } from 'react';
import { PRESETS } from '../utils/presets';
import previews from '../utils/orbit-previews.json' with { type: 'json' };

const GROUPS = ['Все', 'Классические', 'Овалы Шина', 'Хореографии'];

export function OrbitPreview({ name }) {
    return (
        <svg className="orbit-preview" viewBox="0 0 100 100" aria-hidden="true">
            {(previews[name] ?? []).map((d, i) => (
                <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={['var(--body-color-1)', 'var(--body-color-2)', 'var(--body-color-3)'][i % 3]}
                    strokeWidth="1.2"
                />
            ))}
        </svg>
    );
}

export function OrbitCatalog({ activePreset, onSelect, onClose }) {
    const [group, setGroup] = useState('Все');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const visiblePresets = PRESETS.filter((p) => group === 'Все' || p.group === group);

    return (
        <div className="catalog-backdrop" onClick={onClose}>
            <section
                className="catalog-popover"
                aria-label="Каталог орбит"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <div className="catalog-header">
                    <div className="catalog-title-wrap">
                        <h2>Каталог орбит</h2>
                        <span className="count-badge">{PRESETS.length}</span>
                    </div>
                    <button
                        type="button"
                        className="catalog-close-btn"
                        onClick={onClose}
                        aria-label="Закрыть каталог"
                    >
                        ×
                    </button>
                </div>

                {activePreset && (
                    <div className="catalog-active-row">
                        <OrbitPreview name={activePreset.name} />
                        <div className="orbit-selection-copy">
                            <span className="eyebrow">{activePreset.group}</span>
                            <strong>{activePreset.name}</strong>
                            <span className="orbit-description">{activePreset.description}</span>
                        </div>
                    </div>
                )}

                <div className="orbit-groups" aria-label="Семейства орбит">
                    {GROUPS.map((name) => (
                        <button
                            key={name}
                            type="button"
                            aria-pressed={group === name}
                            onClick={() => setGroup(name)}
                        >
                            {name}
                        </button>
                    ))}
                </div>

                <div className="orbit-cards" aria-label="Пресеты">
                    {visiblePresets.map((p) => (
                        <button
                            key={p.name}
                            type="button"
                            className="orbit-card"
                            aria-pressed={activePreset?.name === p.name}
                            onClick={() => {
                                onSelect(p);
                                onClose();
                            }}
                        >
                            <OrbitPreview name={p.name} />
                            <span>{p.name}</span>
                            <small>
                                {p.solution
                                    ? 'Точное решение'
                                    : p.period
                                        ? `Период ≈ ${p.period.toFixed(2)}`
                                        : 'Орбита'}
                            </small>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
