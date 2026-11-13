import { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { HolstCanvas } from './components/HolstCanvas';
import { AuthPage } from './pages/AuthPage';
import { CabinetPage } from './pages/CabinetPage';
import { AdminPage } from './pages/AdminPage';

const THEME_STORAGE_KEY = 'lazypj_theme_v1';

function getInitialTheme() {
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
    } catch {
        return 'dark';
    }
    return 'dark';
}

function maskEmail(email) {
    const clean = (email || '').trim();
    const atIndex = clean.indexOf('@');
    if (atIndex <= 0) {
        return clean;
    }
    const local = clean.slice(0, atIndex);
    const domain = clean.slice(atIndex);
    const visibleCount = local.length <= 2 ? 1 : Math.min(3, local.length - 1);
    return `${local.slice(0, visibleCount)}•••${domain}`;
}

function resolveHashView(session) {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash === 'admin' && session?.user.role === 'Admin') {
        return 'admin';
    }
    if (hash === 'cabinet' && session) {
        return 'cabinet';
    }
    if (hash === 'login' || hash === 'register' || hash === 'auth') {
        return 'auth';
    }
    return 'canvas';
}

export function App() {
    const [session, setSession] = useState(() => api.getSession());
    const [view, setView] = useState(() => resolveHashView(api.getSession()));
    const [authMode, setAuthMode] = useState('login');
    const [theme, setTheme] = useState(() => getInitialTheme());

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            void 0;
        }
    }, [theme]);

    useEffect(() => {
        const onHashChange = () => {
            setView(resolveHashView(session));
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [session]);

    const navigate = (target) => {
        window.location.hash = target === 'canvas' ? '#/' : `#/${target}`;
        setView(target);
    };

    const openAuth = (mode) => {
        setAuthMode(mode);
        window.location.hash = `#/${mode}`;
        setView('auth');
    };

    const handleAuthSuccess = (newSession) => {
        setSession(newSession);
        const nextView = newSession.user.role === 'Admin' ? 'admin' : 'cabinet';
        navigate(nextView);
    };

    const handleLogout = () => {
        api.saveSession(null);
        setSession(null);
        navigate('canvas');
    };

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <div className="app-shell">
            {view === 'canvas' && <HolstCanvas theme={theme} />}

            <header className="top-navbar">
                <button
                    type="button"
                    className="brand-cluster"
                    onClick={() => navigate('canvas')}
                >
                    <span className="brand-title">Cosmos lab</span>
                </button>

                <div className="header-single-row">
                    <button
                        type="button"
                        className="nav-pill"
                        onClick={() => navigate('canvas')}
                    >
                        Че-то придумаем.
                    </button>
                    <button
                        type="button"
                        className="nav-pill"
                        onClick={() => navigate('canvas')}
                    >
                        Че-то придумаем.
                    </button>

                    {!session ? (
                        <>
                            <button
                                type="button"
                                className={`nav-pill ${
                                    view === 'auth' && authMode === 'login' ? 'active' : ''
                                }`}
                                onClick={() => openAuth('login')}
                            >
                                Войти
                            </button>
                            <button
                                type="button"
                                className={`account-pill-btn ${
                                    view === 'auth' && authMode === 'register' ? 'active' : ''
                                }`}
                                onClick={() => openAuth('register')}
                            >
                                Зарегистрироваться
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className={`account-pill-btn ${
                                view === 'cabinet' || view === 'admin' ? 'active' : ''
                            }`}
                            onClick={() => navigate('cabinet')}
                            title="Личный кабинет"
                        >
                            {maskEmail(session.user.email)}
                        </button>
                    )}

                    <button
                        type="button"
                        className="theme-icon-btn"
                        onClick={toggleTheme}
                        title={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
                        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
                    >
                        {theme === 'dark' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        )}
                    </button>
                </div>
            </header>

            {view !== 'canvas' && (
                <main className="page-container">
                    {view === 'auth' || !session ? (
                        <AuthPage key={authMode} initialMode={authMode} onSuccess={handleAuthSuccess} />
                    ) : view === 'admin' && session.user.role === 'Admin' ? (
                        <AdminPage />
                    ) : (
                        <CabinetPage
                            session={session}
                            onSessionUpdate={(updated) => setSession(updated)}
                            onOpenAdmin={
                                session.user.role === 'Admin' ? () => navigate('admin') : undefined
                            }
                            onLogout={handleLogout}
                        />
                    )}
                </main>
            )}
        </div>
    );
}

export default App;
