import { useState } from 'react';
import { RangeNumber } from './RangeNumber';

const FIELDS = [
    ['m', 'Масса', 0.001, 100, 0.01],
    ['x', 'X', -50, 50, 0.01], ['y', 'Y', -50, 50, 0.01],
    ['vx', 'Скорость X', -20, 20, 0.01], ['vy', 'Скорость Y', -20, 20, 0.01],
];

export function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const [values, setValues] = useState(() => ({ ...menu.body }));
    return (
        <div className="body-menu"
            style={{ left: Math.max(8, Math.min(menu.x, window.innerWidth - 370)), top: Math.max(8, Math.min(menu.y, window.innerHeight - 350)) }}
            onPointerDown={(e) => e.stopPropagation()}>
            <div className="body-menu-header"><span>Тело {menu.index + 1}</span><button onClick={onClose} aria-label="Закрыть редактор">×</button></div>
            <div className="body-menu-grid">
                {FIELDS.map(([key, label, min, max, step]) => <RangeNumber key={key} label={label} value={values[key]}
                    min={Math.min(min, values[key])} max={Math.max(max, values[key])} step={step}
                    onChange={(value) => { setValues((prev) => ({ ...prev, [key]: value })); onApply(menu.index, { [key]: value }); }} />)}
            </div>
            <div className="body-menu-actions">
                <button onClick={() => onDelete(menu.index)} className="btn-danger">Удалить</button>
                <button onClick={onClose} className="btn-primary">Готово</button>
            </div>
        </div>
    );
}
