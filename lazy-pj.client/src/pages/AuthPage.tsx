import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { AuthSession } from '../types';
import { translateErrorMessage, validators } from '../utils/validation';

interface AuthPageProps {
    initialMode?: 'login' | 'register';
    onSuccess: (session: AuthSession) => void;
}

const DEMO_USER_ACCOUNT = {
    email: 'user@lazypj.ru',
    password: 'password123',
};

const DEMO_ADMIN_ACCOUNT = {
    email: 'admin@lazypj.ru',
    password: 'adminpassword',
};

const LOGIN_GREETINGS = [
    'Добро пожаловать',
    'Давно не виделись',
    'С возвращением',
    'Рады видеть снова',
];

const REGISTER_GREETINGS = [
    'Здравствуйте',
    'Давайте познакомимся',
    'Приятно познакомиться',
    'Добро пожаловать к нам',
];

function pickRandomPhrase(list: string[], exclude?: string): string {
    const pool = exclude ? list.filter((item) => item !== exclude) : list;
    const source = pool.length > 0 ? pool : list;
    return source[Math.floor(Math.random() * source.length)];
}

export function AuthPage({ initialMode = 'login', onSuccess }: AuthPageProps) {
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invalidField, setInvalidField] = useState<'name' | 'email' | 'password' | null>(null);
    const [loginGreeting, setLoginGreeting] = useState(() => pickRandomPhrase(LOGIN_GREETINGS));
    const [registerGreeting, setRegisterGreeting] = useState(() => pickRandomPhrase(REGISTER_GREETINGS));
    const [isDemoUserAvailable, setIsDemoUserAvailable] = useState<boolean>(false);
    const [isDemoAdminAvailable, setIsDemoAdminAvailable] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;
        const verifyDemoAccounts = async () => {
            const [userOk, adminOk] = await Promise.all([
                api.checkAccountExistsInDb(DEMO_USER_ACCOUNT.email, DEMO_USER_ACCOUNT.password),
                api.checkAccountExistsInDb(DEMO_ADMIN_ACCOUNT.email, DEMO_ADMIN_ACCOUNT.password),
            ]);
            if (!cancelled) {
                setIsDemoUserAvailable(userOk);
                setIsDemoAdminAvailable(adminOk);
            }
        };
        verifyDemoAccounts();
        return () => {
            cancelled = true;
        };
    }, []);

    const activeGreeting = mode === 'login' ? loginGreeting : registerGreeting;

    const handleSwitchMode = (nextMode: 'login' | 'register') => {
        setMode(nextMode);
        setError(null);
        setInvalidField(null);
        if (nextMode === 'login') {
            setLoginGreeting((prev) => pickRandomPhrase(LOGIN_GREETINGS, prev));
        } else {
            setRegisterGreeting((prev) => pickRandomPhrase(REGISTER_GREETINGS, prev));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setInvalidField(null);

        if (mode === 'register') {
            const nameErr = validators.validateName(name);
            if (nameErr) {
                setInvalidField('name');
                setError(nameErr);
                return;
            }
        }

        const emailErr = validators.validateEmail(email);
        if (emailErr) {
            setInvalidField('email');
            setError(emailErr);
            return;
        }

        const passErr = validators.validatePassword(password, 4);
        if (passErr) {
            setInvalidField('password');
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

    const handleDemoLogin = async (role: 'user' | 'admin') => {
        if (role === 'user' && !isDemoUserAvailable) return;
        if (role === 'admin' && !isDemoAdminAvailable) return;

        setError(null);
        setInvalidField(null);
        setLoading(true);
        try {
            const session =
                role === 'admin'
                    ? await api.login(DEMO_ADMIN_ACCOUNT.email, DEMO_ADMIN_ACCOUNT.password)
                    : await api.login(DEMO_USER_ACCOUNT.email, DEMO_USER_ACCOUNT.password);
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
                <div className="auth-header">
                    <div className="handwritten-greeting-wrap">
                        <svg
                            key={`${mode}-${activeGreeting}`}
                            className="handwritten-svg"
                            viewBox="0 0 460 76"
                            xmlns="http://www.w3.org/2000/svg"
                            role="img"
                            aria-label={activeGreeting}
                        >
                            <text
                                x="50%"
                                y="48"
                                textAnchor="middle"
                                className="handwritten-svg-text"
                            >
                                {activeGreeting}
                            </text>
                            <path
                                className="handwritten-underline"
                                d="M 95 62 Q 230 52 365 61"
                            />
                        </svg>
                    </div>
                </div>

                <div className="segmented-tabs" role="tablist">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'login'}
                        className={`segmented-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => handleSwitchMode('login')}
                    >
                        Вход
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'register'}
                        className={`segmented-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => handleSwitchMode('register')}
                    >
                        Регистрация
                    </button>
                </div>

                {error && (
                    <div className="alert-banner" role="alert">
                        <span>{error}</span>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setError(null)}
                        >
                            Закрыть
                        </button>
                    </div>
                )}

                <form className="form-stack" onSubmit={handleSubmit} noValidate>
                    {mode === 'register' && (
                        <div className="field-group">
                            <label className="field-label" htmlFor="auth-name">
                                Имя фамилия
                            </label>
                            <input
                                id="auth-name"
                                className={`input-control ${invalidField === 'name' ? 'validation-shake' : ''}`}
                                type="text"
                                placeholder="Иван Иванов"
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    if (invalidField === 'name') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'name'
                                        ? { borderColor: 'var(--accent)' }
                                        : undefined
                                }
                            />
                        </div>
                    )}

                    <div className="field-group">
                        <label className="field-label" htmlFor="auth-email">
                            Почта
                        </label>
                        <input
                            id="auth-email"
                            className={`input-control ${invalidField === 'email' ? 'validation-shake' : ''}`}
                            type="email"
                            placeholder="example@gmail.com"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                if (invalidField === 'email') setInvalidField(null);
                            }}
                            style={
                                invalidField === 'email'
                                    ? { borderColor: 'var(--accent)' }
                                    : undefined
                            }
                        />
                    </div>

                    <div className="field-group">
                        <label className="field-label" htmlFor="auth-password">
                            Пароль
                        </label>
                        <div className="password-field-wrapper">
                            <input
                                id="auth-password"
                                className={`input-control ${invalidField === 'password' ? 'validation-shake' : ''}`}
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (invalidField === 'password') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'password'
                                        ? { borderColor: 'var(--accent)' }
                                        : undefined
                                }
                            />
                            <button
                                type="button"
                                className="password-eye-btn"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                        <line x1="1" y1="1" x2="23" y2="23" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading
                            ? 'Подождите...'
                            : mode === 'login'
                            ? 'Войти в систему'
                            : 'Создать аккаунт'}
                    </button>
                </form>

                <div className="demo-box">
                    <div className="demo-title">Потестим?</div>
                    <div className="demo-buttons">
                        <div className="demo-btn-wrapper">
                            <button
                                type="button"
                                className={`btn btn-secondary btn-sm demo-role-btn ${
                                    !isDemoUserAvailable ? 'demo-btn-unavailable' : ''
                                }`}
                                onClick={() => handleDemoLogin('user')}
                                disabled={loading || !isDemoUserAvailable}
                            >
                                Войти пользователем
                            </button>
                            {!isDemoUserAvailable && (
                                <span className="demo-tooltip" role="tooltip">
                                    Приносим извенения за неудоства. Тестовый аккаунт скоро будет добавлен.
                                </span>
                            )}
                        </div>

                        <div className="demo-btn-wrapper">
                            <button
                                type="button"
                                className={`btn btn-secondary btn-sm demo-role-btn ${
                                    !isDemoAdminAvailable ? 'demo-btn-unavailable' : ''
                                }`}
                                onClick={() => handleDemoLogin('admin')}
                                disabled={loading || !isDemoAdminAvailable}
                            >
                                Войти администратором
                            </button>
                            {!isDemoAdminAvailable && (
                                <span className="demo-tooltip" role="tooltip">
                                    Приносим извенения за неудоства. Тестовый аккаунт скоро будет добавлен.
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
