import { useState } from 'react';
import { api } from '../api';
import { translateErrorMessage, validators } from '../utils/validation';

export function AuthPage({ initialMode = 'login', onSuccess }) {
    const [mode, setMode] = useState(initialMode);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSwitchMode = (nextMode) => {
        setMode(nextMode);
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (mode === 'register') {
            const nameErr = validators.validateName(name);
            if (nameErr) {
                setError(nameErr);
                return;
            }
        }

        const emailErr = validators.validateEmail(email);
        if (emailErr) {
            setError(emailErr);
            return;
        }

        const passErr = validators.validatePassword(password, 4);
        if (passErr) {
            setError(passErr);
            return;
        }

        setLoading(true);
        try {
            const session =
                mode === 'login'
                    ? await api.login(email, password)
                    : await api.register(name, email, password);
            onSuccess(session);
        } catch (err) {
            setError(translateErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="auth-card">
                <div className="auth-tabs">
                    <button
                        type="button"
                        className={mode === 'login' ? 'btn-primary' : ''}
                        onClick={() => handleSwitchMode('login')}
                    >
                        Вход
                    </button>
                    <button
                        type="button"
                        className={mode === 'register' ? 'btn-primary' : ''}
                        onClick={() => handleSwitchMode('register')}
                    >
                        Регистрация
                    </button>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    {mode === 'register' && (
                        <div className="auth-field">
                            <label htmlFor="auth-name">Имя</label>
                            <input
                                id="auth-name"
                                type="text"
                                placeholder="Иван Иванов"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <label htmlFor="auth-email">Почта</label>
                        <input
                            id="auth-email"
                            type="email"
                            placeholder="example@mail.ru"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="auth-password">Пароль</label>
                        <input
                            id="auth-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                        {loading
                            ? 'Загрузка...'
                            : mode === 'login'
                            ? 'Войти'
                            : 'Создать аккаунт'}
                    </button>
                </form>
            </div>
        </div>
    );
}
