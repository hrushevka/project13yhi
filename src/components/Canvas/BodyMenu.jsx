import { useRef, useState } from 'react';
import { massToRadius, radiusToMass, roundFloat, toFloat } from './utils';

export function BodyMenu({ menu, onApply, onDelete, onClose }) {
    const [pos, setPos] = useState(() => ({
        x: Math.max(10, Math.min(menu.x, window.innerWidth - 260)),
        y: Math.max(60, Math.min(menu.y, window.innerHeight - 340)),
    }));

    const dragOffsetRef = useRef(null);
    const body = menu.body;

    const handleFloatChange = (key, raw) => {
        const parsed = parseFloat(raw);
        if (!Number.isFinite(parsed)) return;

        if (key === 'm') {
            const validMass = Math.max(0.01, roundFloat(parsed, 4));
            onApply(menu.index, { m: validMass });
        } else if (key === 'r') {
            const validMass = roundFloat(radiusToMass(parsed), 4);
            onApply(menu.index, { m: validMass });
        } else {
            onApply(menu.index, { [key]: roundFloat(parsed, 4) });
        }
    };

    const handleMenuPointerDown = (e) => {
        e.stopPropagation();
        if (e.target.closest('input') || e.target.closest('button')) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragOffsetRef.current = {
            dx: e.clientX - pos.x,
            dy: e.clientY - pos.y,
        };
    };

    const handleMenuPointerMove = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        const nextX = Math.max(10, Math.min(window.innerWidth - 250, e.clientX - dragOffsetRef.current.dx));
        const nextY = Math.max(10, Math.min(window.innerHeight - 300, e.clientY - dragOffsetRef.current.dy));
        setPos({ x: nextX, y: nextY });
    };

    const handleMenuPointerUp = (e) => {
        if (!dragOffsetRef.current) return;
        e.stopPropagation();
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragOffsetRef.current = null;
    };

    const currentMass = roundFloat(toFloat(body.m, 1), 4);
    const currentRadius = roundFloat(massToRadius(currentMass), 2);

    return (
        <div
            className="body-menu"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={handleMenuPointerDown}
            onPointerMove={handleMenuPointerMove}
            onPointerUp={handleMenuPointerUp}
            onPointerCancel={handleMenuPointerUp}
        >
            <div className="body-menu-header">
                <span>Тело {menu.index + 1}</span>
                <button type="button" onClick={onClose}>X</button>
            </div>
            <div className="body-menu-grid">
                <div className="body-menu-field">
                    <label>Масса</label>
                    <input
                        type="number"
                        step="0.1"
                        min="0.01"
                        value={currentMass}
                        onChange={(e) => handleFloatChange('m', e.target.value)}
                    />
                </div>
                <div className="body-menu-field">
                    <label>Размер</label>
                    <input
                        type="number"
                        step="0.5"
                        min="2"
                        max="80"
                        value={currentRadius}
                        onChange={(e) => handleFloatChange('r', e.target.value)}
                    />
                </div>
                <div className="body-menu-field">
                    <label>X</label>
                    <input
                        type="number"
                        step="0.1"
                        value={roundFloat(body.x, 4)}
                        onChange={(e) => handleFloatChange('x', e.target.value)}
                    />
                </div>
                <div className="body-menu-field">
                    <label>Y</label>
                    <input
                        type="number"
                        step="0.1"
                        value={roundFloat(body.y, 4)}
                        onChange={(e) => handleFloatChange('y', e.target.value)}
                    />
                </div>
                <div className="body-menu-field">
                    <label>VX</label>
                    <input
                        type="number"
                        step="0.1"
                        value={roundFloat(body.vx, 4)}
                        onChange={(e) => handleFloatChange('vx', e.target.value)}
                    />
                </div>
                <div className="body-menu-field">
                    <label>VY</label>
                    <input
                        type="number"
                        step="0.1"
                        value={roundFloat(body.vy, 4)}
                        onChange={(e) => handleFloatChange('vy', e.target.value)}
                    />
                </div>
            </div>
            <div className="body-menu-actions">
                <button type="button" className="btn-danger" onClick={() => onDelete(menu.index)}>
                    Удалить
                </button>
                <button type="button" className="btn-primary" onClick={onClose}>
                    Готово
                </button>
            </div>
        </div>
    );
}
