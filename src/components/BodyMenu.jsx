import { useState } from 'react';
import { formatNumber } from './utils';

export function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const [drafts, setDrafts] = useState(() => ({
        m: formatNumber(menu.body.m),
        x: formatNumber(menu.body.x),
        y: formatNumber(menu.body.y),
        vx: formatNumber(menu.body.vx),
        vy: formatNumber(menu.body.vy),
    }));

    const handleChange = (key, raw) => {
        setDrafts((prev) => ({ ...prev, [key]: raw }));
        const value = Number(raw.replace(',', '.'));
        if (raw.trim() !== '' && Number.isFinite(value) && (key !== 'm' || value > 0)) {
            onApply(menu.index, { [key]: value });
        }
    };

    return (
        <div
            className="body-menu"
            style={{ left: Math.min(menu.x, window.innerWidth - 260), top: Math.min(menu.y, window.innerHeight - 350) }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="body-menu-header">
                <span>Планета {menu.index + 1}</span>
                <button onClick={onClose} style={{ padding: '0 8px', borderRadius: '50%', background: 'transparent', border: 'none', boxShadow: 'none' }}>X</button>
            </div>
            <div className="body-menu-grid">
                {['m', 'x', 'y', 'vx', 'vy'].map((key) => (
                    <div key={key} className="body-menu-field">
                        <label>{key === 'm' ? 'Масса' : key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'vx' ? 'Скор. X' : 'Скор. Y'}</label>
                        <input type="text" value={drafts[key]} onChange={(e) => handleChange(key, e.target.value)} />
                    </div>
                ))}
            </div>
            <div className="body-menu-actions">
                <button onClick={() => onDelete(menu.index)} className="btn-danger">Удалить</button>
                <button onClick={onClose} className="btn-primary">Готово</button>
            </div>
        </div>
    );
}
