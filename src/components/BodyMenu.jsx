import { useEffect, useRef, useState } from 'react';
import { RangeNumber } from './RangeNumber';

const FIELDS = [
    ['m', 'Масса', 0.001, 100, 0.01],
    ['x', 'X', -50, 50, 0.01], ['y', 'Y', -50, 50, 0.01],
    ['vx', 'Скорость X', -20, 20, 0.01], ['vy', 'Скорость Y', -20, 20, 0.01],
];

export function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const menuRef = useRef(null);
    const dragOffsetRef = useRef(null);
    const [values, setValues] = useState(() => ({ ...menu.body }));
    const [pos, setPos] = useState(() => {
        const w = Math.min(320, Math.max(220, window.innerWidth - 16));
        const h = 340;
        return {
            x: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)),
            y: Math.max(64, Math.min(menu.y, window.innerHeight - h - 12)),
        };
    });

    useEffect(() => {
        const clampToViewport = () => {
            const el = menuRef.current;
            const w = el ? el.offsetWidth : Math.min(320, window.innerWidth - 16);
            const h = el ? el.offsetHeight : 340;
            const maxX = Math.max(8, window.innerWidth - w - 8);
            const maxY = Math.max(64, window.innerHeight - h - 8);
            setPos((prev) => ({
                x: Math.max(8, Math.min(maxX, prev.x)),
                y: Math.max(64, Math.min(maxY, prev.y)),
            }));
        };
        clampToViewport();
        window.addEventListener('resize', clampToViewport);
        return () => window.removeEventListener('resize', clampToViewport);
    }, []);

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (e.target.closest('input, button, label')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffsetRef.current = {
            dx: e.clientX - pos.x,
            dy: e.clientY - pos.y,
        };
    };

    const handlePointerMove = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        const el = menuRef.current;
        const w = el ? el.offsetWidth : Math.min(320, window.innerWidth - 16);
        const h = el ? el.offsetHeight : 340;
        const maxX = Math.max(8, window.innerWidth - w - 8);
        const maxY = Math.max(64, window.innerHeight - h - 8);
        const nextX = Math.max(8, Math.min(maxX, e.clientX - dragOffsetRef.current.dx));
        const nextY = Math.max(64, Math.min(maxY, e.clientY - dragOffsetRef.current.dy));
        setPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragOffsetRef.current = null;
    };

    return (
        <div
            ref={menuRef}
            className="body-menu"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
        >
            <div className="body-menu-header">
                <span>Тело {menu.index + 1}</span>
                <button type="button" onClick={onClose} aria-label="Закрыть редактор">×</button>
            </div>
            <div className="body-menu-grid">
                {FIELDS.map(([key, label, min, max, step]) => (
                    <RangeNumber
                        key={key}
                        label={label}
                        value={values[key]}
                        min={Math.min(min, values[key])}
                        max={Math.max(max, values[key])}
                        step={step}
                        onChange={(value) => {
                            setValues((prev) => ({ ...prev, [key]: value }));
                            onApply(menu.index, { [key]: value });
                        }}
                    />
                ))}
            </div>
            <div className="body-menu-actions">
                <button type="button" onClick={() => onDelete(menu.index)} className="btn-danger">Удалить</button>
                <button type="button" onClick={onClose} className="btn-primary">Готово</button>
            </div>
        </div>
    );
}
