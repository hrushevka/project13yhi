import { useEffect, useState } from 'react';

export function StabilityIndicator({ configuration, onResult }) {
    const [result, setResult] = useState(null);
    useEffect(() => {
        const worker = new Worker(new URL('../utils/stability.worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = ({ data }) => {
            setResult({ configuration, ...data });
            onResult(data.kind, configuration.revision);
        };
        worker.onerror = () => {
            setResult({ configuration, kind: 'unknown', text: 'Не удалось рассчитать оценку' });
            onResult('unknown', configuration.revision);
        };
        const timer = setTimeout(() => worker.postMessage(configuration), 250);
        return () => { clearTimeout(timer); worker.terminate(); };
    }, [configuration, onResult]);
    const current = result?.configuration === configuration ? result : { kind: 'pending', text: 'Проверяем конфигурацию…' };
    return <div className={'stability-indicator ' + current.kind} role="status">
        <strong>{current.kind === 'stable' ? '● Условно устойчива' : current.kind === 'unstable' ? '● Неустойчива' : '◌ Оценка устойчивости'}</strong>
        <span>{current.text}</span>
        <small>Прогноз на 10 с модельного времени. Скорость × меняет только темп воспроизведения.</small>
    </div>;
}
