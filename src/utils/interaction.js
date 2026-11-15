
export function pinchCamera(camera, start, points, width, height, minZoom, maxZoom) {
    const midpoint = p => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 });
    const distance = p => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
    const from = midpoint(start), to = midpoint(points);
    const zoom = Math.max(minZoom, Math.min(maxZoom, camera.zoom * distance(points) / Math.max(1, distance(start))));
    return {
        zoom,
        x: to.x - width / 2 - (from.x - width / 2 - camera.x) * zoom / camera.zoom,
        y: to.y - height * .35 - (from.y - height * .35 - camera.y) * zoom / camera.zoom,
    };
}

export function boundedStep(time, step, deadline = Infinity) {
    const tick = Math.round(time / step);
    const onGrid = Math.abs(time - tick * step) <= 1e-10 * step;
    const next = onGrid ? (tick + 1) * step : time + step;
    if (next >= deadline - 1e-12) return { dt: Math.max(0, deadline - time), time: deadline };
    return { dt: step, time: next };
}
