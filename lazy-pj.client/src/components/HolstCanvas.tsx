import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';

export function HolstCanvas() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

    const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.button !== 1) return;
        if ((e.target as HTMLElement).closest('.holst-hud')) return;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            ox: offset.x,
            oy: offset.y,
        };
    };

    const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setOffset({
            x: dragStartRef.current.ox + dx,
            y: dragStartRef.current.oy + dy,
        });
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
        }
    };

    const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;

        const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
        const nextScale = Math.min(3, Math.max(0.25, Number((scale * zoomFactor).toFixed(3))));
        const ratio = nextScale / scale;

        setOffset((prev) => ({
            x: cursorX - (cursorX - prev.x) * ratio,
            y: cursorY - (cursorY - prev.y) * ratio,
        }));
        setScale(nextScale);
    };

    const adjustZoom = (delta: number) => {
        const nextScale = Math.min(3, Math.max(0.25, Number((scale + delta).toFixed(2))));
        const ratio = nextScale / scale;
        setOffset((prev) => ({
            x: prev.x * ratio,
            y: prev.y * ratio,
        }));
        setScale(nextScale);
    };

    const resetView = () => {
        setOffset({ x: 0, y: 0 });
        setScale(1);
    };

    const gridStep = 28 * scale;
    const dotRadius = Math.max(1, 1.35 * Math.min(scale, 1.4));

    return (
        <div
            ref={containerRef}
            className={`holst-viewport ${isDragging ? 'is-dragging' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            <div
                className="holst-grid-layer"
                style={{
                    backgroundSize: `${gridStep}px ${gridStep}px`,
                    backgroundPosition: `calc(50% + ${offset.x}px) calc(50% + ${offset.y}px)`,
                    backgroundImage: `radial-gradient(circle, var(--holst-dot-color) ${dotRadius}px, transparent ${dotRadius + 0.5}px)`,
                }}
            />

            <div
                className="holst-world"
                style={{
                    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
                }}
            >
                <div className="holst-origin-cross" />
            </div>

            <div className="holst-hud">
                <button
                    type="button"
                    className="holst-hud-btn"
                    onClick={() => adjustZoom(-0.15)}
                    title="Отдалить"
                    aria-label="Отдалить"
                >
                    −
                </button>
                <button
                    type="button"
                    className="holst-hud-scale"
                    onClick={resetView}
                    title="Сбросить масштаб и позицию"
                >
                    {Math.round(scale * 100)}%
                </button>
                <button
                    type="button"
                    className="holst-hud-btn"
                    onClick={() => adjustZoom(0.15)}
                    title="Приблизить"
                    aria-label="Приблизить"
                >
                    +
                </button>
            </div>
        </div>
    );
}
