import { useEffect, useState } from 'react';
import './App.css';
import { api } from './api';
import { HolstCanvas } from './components/HolstCanvas';
import { AuthPage } from './pages/AuthPage';
import { CabinetPage } from './pages/CabinetPage';
import { AdminPage } from './pages/AdminPage';

function resolveHashView(session) {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    if (hash === 'admin' && session?.user.role === 'Admin') return 'admin';
    if (hash === 'cabinet' && session) return 'cabinet';
    if (hash === 'login' || hash === 'register' || hash === 'auth') return 'auth';
    return 'canvas';
}

export function App() {
    const [session, setSession] = useState(() => api.getSession());
    const [view, setView] = useState(() => resolveHashView(api.getSession()));
    const [authMode, setAuthMode] = useState('login');

    useEffect(() => {
        const onHashChange = () => setView(resolveHashView(session));
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, [session]);

    const navigate = (target) => {
        window.location.hash = target === 'canvas' ? '#/' : `#/${target}`;
        setView(target);
    };

    return (
        <div className="app-shell">
            <header className="top-navbar">
                <div className="brand-title" onClick={() => navigate('canvas')}>
                    Cosmos Lab
                </div>

                <div className="header-single-row">
                    <button onClick={() => navigate('canvas')}>Симулятор</button>
                    {!session ? (
                        <>
                            <button onClick={() => { setAuthMode('login'); navigate('auth'); }}>Вход</button>
                            <button onClick={() => { setAuthMode('register'); navigate('auth'); }}>Регистрация</button>
                        </>
                    ) : (
                        <button onClick={() => navigate('cabinet')}>Личный кабинет</button>
                    )}
                </div>
            </header>

            {view === 'canvas' ? (
                <HolstCanvas />
            ) : (
                <main className="page-container">
                    {view === 'auth' || !session ? (
                        <AuthPage key={authMode} initialMode={authMode} onSuccess={(s) => { setSession(s); navigate('cabinet'); }} />
                    ) : view === 'admin' && session.user.role === 'Admin' ? (
                        <AdminPage />
                    ) : (
                        <CabinetPage
                            session={session}
                            onSessionUpdate={(updated) => setSession(updated)}
                            onOpenAdmin={session.user.role === 'Admin' ? () => navigate('admin') : undefined}
                            onLogout={() => { api.saveSession(null); setSession(null); navigate('canvas'); }}
                        />
                    )}
                </main>
            )}
        </div>
    );
}

export default App;