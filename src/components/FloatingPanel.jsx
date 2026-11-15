import { useLayoutEffect, useRef, useState } from 'react';

export function FloatingPanel({ id, title, children, className = '', onClose, collapsedControls }) {
    const ref = useRef(null);
    const drag = useRef(null);
    const [collapsed, setCollapsed] = useState(() => id === 'controls' && window.innerWidth <= 700);
    const key = 'cosmos.panel.' + id;
    useLayoutEffect(() => {
        if (id !== 'controls') return;
        const query = window.matchMedia('(max-width:700px)');
        const adapt = e => { if (e.matches) setCollapsed(true); };
        query.addEventListener('change', adapt);
        return () => query.removeEventListener('change', adapt);
    }, [id]);
    useLayoutEffect(() => {
        const node = ref.current;
        const clamp = () => {
            const r = node.getBoundingClientRect();
            if (id === 'controls' && innerWidth <= 700) {
                node.style.left = '8px';
                node.style.top = Math.max(8, innerHeight - r.height - 8) + 'px';
                node.style.right = 'auto'; node.style.bottom = 'auto';
                return;
            }
            node.style.left = Math.max(8, Math.min(r.left, innerWidth - r.width - 8)) + 'px';
            const minTop = innerHeight <= 600 ? 8 : 72;
            node.style.top = Math.max(minTop, Math.min(r.top, innerHeight - r.height - 8)) + 'px';
            node.style.right = 'auto'; node.style.bottom = 'auto';
        };
        try {
            const saved = JSON.parse(localStorage.getItem(key));
            if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
                node.style.left = saved.x + 'px'; node.style.top = saved.y + 'px';
            }
        } catch {  }
        clamp();
        const observer = new ResizeObserver(clamp);
        observer.observe(node);
        window.addEventListener('resize', clamp);
        return () => { observer.disconnect(); window.removeEventListener('resize', clamp); };
    }, [key, id]);
    function save() {
        const r = ref.current.getBoundingClientRect();
        try { localStorage.setItem(key, JSON.stringify({ x: r.left, y: r.top })); } catch {  }
    }
    function move(x, y) {
        if (id === 'controls' && innerWidth <= 700) return;
        const node = ref.current, r = node.getBoundingClientRect();
        node.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + 'px';
        node.style.top = Math.max(72, Math.min(y, innerHeight - 48)) + 'px';
    }
    return (
        <aside ref={ref} className={'floating-panel ' + className} data-panel={id} onPointerDown={e => e.stopPropagation()}>
            <div className={'panel-chrome' + (collapsed && collapsedControls ? ' compact-chrome' : '')}>
                <button className="panel-grip" aria-label={'Переместить: ' + title} title="Перетащите или используйте стрелки"
                    onPointerDown={e => {
                        if (e.button !== 0) return;
                        const r = ref.current.getBoundingClientRect();
                        drag.current = { x: e.clientX - r.left, y: e.clientY - r.top };
                        e.currentTarget.setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => { if (drag.current) move(e.clientX - drag.current.x, e.clientY - drag.current.y); }}
                    onPointerUp={() => { drag.current = null; save(); }}
                    onPointerCancel={() => { drag.current = null; }}
                    onKeyDown={e => {
                        const delta = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] }[e.key];
                        if (!delta) return;
                        e.preventDefault(); const r = ref.current.getBoundingClientRect(); move(r.left + delta[0], r.top + delta[1]); save();
                    }}>⠿ {!(collapsed && collapsedControls) && <span>{title}</span>}</button>
                {collapsed && collapsedControls}
                <button aria-label={(collapsed ? 'Развернуть: ' : 'Свернуть: ') + title} aria-expanded={!collapsed} onClick={() => setCollapsed(v => !v)}>{collapsed ? '+' : '−'}</button>
                {onClose && <button aria-label={'Скрыть: ' + title} onClick={onClose}>×</button>}
            </div>
            <div className="panel-content" hidden={collapsed}>{children}</div>
        </aside>
    );
}
