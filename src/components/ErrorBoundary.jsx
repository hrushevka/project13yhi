import { Component } from 'react';

export class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Cosmos lab could not render', error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <section className="sim-panel" role="alert">
                <h1>Не удалось открыть симулятор</h1>
                <p>Попробуйте сбросить рабочую область или перезагрузить страницу.</p>
                <p>{this.state.error.message}</p>
                <button type="button" onClick={this.props.onReset ?? (() => window.location.reload())}>
                    Попробовать снова
                </button>
            </section>
        );
    }
}
