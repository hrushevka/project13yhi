export function StabilityIndicator({ result: current }) {
    return <div className={'stability-indicator ' + current.kind} role="status">
        <strong>{current.kind === 'stable' ? '● Условно устойчива' : current.kind === 'unstable' ? '● Неустойчива' : '◌ Оценка устойчивости'}</strong>
        <span>{current.text}</span>
        <small>Прогноз на 10 с модельного времени. Скорость × меняет только темп воспроизведения.</small>
    </div>;
}
