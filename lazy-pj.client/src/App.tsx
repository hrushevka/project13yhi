import { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import type { AuthSession } from './types';
import { ShaderBackground } from './components/ShaderBackground';
import { LiquidBlob } from './components/LiquidBlob';
import { AuthPage } from './pages/AuthPage';
import { CabinetPage } from './pages/CabinetPage';
import { AdminPage } from './pages/AdminPage';

type ActiveView = 'cabinet' | 'admin';

function resolveHashView(session: AuthSession | null): ActiveView {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash === 'admin' && session?.user.role === 'Admin') {
        return 'admin';
    }
    return 'cabinet';
}

export function App() {
    const [session, setSession] = useState<AuthSession | null>(() => api.getSession());
    const [view, setView] = useState<ActiveView>(() => resolveHashView(api.getSession()));

    useEffect(() => {
        const onHashChange = () => {
            setView(resolveHashView(session));
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [session]);

    const navigate = (target: ActiveView) => {
        window.location.hash = `#/${target}`;
        setView(target);
    };

    const handleAuthSuccess = (newSession: AuthSession) => {
        setSession(newSession);
        const nextView: ActiveView = newSession.user.role === 'Admin' ? 'admin' : 'cabinet';
        navigate(nextView);
    };

    const handleLogout = () => {
        api.saveSession(null);
        setSession(null);
        window.location.hash = '#/login';
    };

    return (
        <div className="app-shell">
            <ShaderBackground />

            {session && (
                <header className="top-navbar">
                    <div className="brand-cluster">
                        <LiquidBlob size={40} />
                        <div>
                            <span className="brand-title">Lazy PJ</span>
                            <span className="brand-subtitle">Система заявок и ролей</span>
                        </div>
                    </div>

                    <nav className="nav-links" aria-label="Основная навигация">
                        <button
                            type="button"
                            className={`nav-pill ${view === 'cabinet' ? 'active' : ''}`}
                            onClick={() => navigate('cabinet')}
                        >
                            Личный кабинет
                        </button>

                        {session.user.role === 'Admin' && (
                            <button
                                type="button"
                                className={`nav-pill ${view === 'admin' ? 'active' : ''}`}
                                onClick={() => navigate('admin')}
                            >
                                Админ-панель
                            </button>
                        )}
                    </nav>

                    <div className="user-chip">
                        <span className="role-badge">
                            {session.user.role === 'Admin' ? 'Admin' : 'User'}
                        </span>
                        <span style={{ fontSize: '0.86rem', fontWeight: 600 }}>
                            {session.user.name}
                        </span>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleLogout}
                        >
                            Выйти
                        </button>
                    </div>
                </header>
            )}

            <main className="page-container">
                {!session ? (
                    <AuthPage onSuccess={handleAuthSuccess} />
                ) : view === 'admin' && session.user.role === 'Admin' ? (
                    <AdminPage />
                ) : (
                    <CabinetPage
                        session={session}
                        onSessionUpdate={(updated) => setSession(updated)}
                        onOpenAdmin={
                            session.user.role === 'Admin' ? () => navigate('admin') : undefined
                        }
                    />
                )}
            </main>
        </div>
    );
}

export default App;
