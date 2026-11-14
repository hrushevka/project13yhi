import { useLayoutEffect, useState } from 'react';
import './App.css';
import { HolstCanvas } from './components/HolstCanvas';
import { OrbitCatalog } from './components/OrbitCatalog';
import { PRESETS } from './utils/presets';

const THEME_STORAGE_KEY = 'cosmos-lab-theme';

function getInitialTheme() {
    try {
        const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }
    } catch {
        return 'dark';
    }
    return 'dark';
}

export function App() {
    const [theme, setTheme] = useState(getInitialTheme);
    const [canvasSession, setCanvasSession] = useState(0);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [activePreset, setActivePreset] = useState(PRESETS[0]);
    const [presetCommand, setPresetCommand] = useState({ preset: null, nonce: 0 });

    useLayoutEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch {
            return undefined;
        }
        return undefined;
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    const handleHome = () => {
        setCatalogOpen(false);
        setPresetCommand({ preset: null, nonce: 0 });
        setActivePreset(PRESETS[0]);
        setCanvasSession((prev) => prev + 1);
    };

    const handleReload = () => {
        window.location.reload();
    };

    const handleSelectPreset = (preset) => {
        setPresetCommand((prev) => ({ preset, nonce: prev.nonce + 1 }));
    };

    return (
        <main className="app-shell">
            <header className="top-navbar">
                <button
                    type="button"
                    className="brand-cluster"
                    onClick={handleHome}
                    aria-label="Cosmos lab — домой"
                >
                    <span className="brand-title">Cosmos lab</span>
                </button>

                <div className="header-single-row">
                    <button
                        type="button"
                        className={`nav-pill nav-pill-catalog ${catalogOpen ? 'active' : ''}`}
                        onClick={() => setCatalogOpen((prev) => !prev)}
                        aria-expanded={catalogOpen}
                        aria-label="Каталог орбит"
                        title="Каталог орбит"
                    >
                        <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="3" />
                            <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-24 12 12)" />
                        </svg>
                        <span>Каталог</span>
                        <span className="count-badge">{PRESETS.length}</span>
                    </button>

                    <button
                        type="button"
                        className="nav-pill nav-pill-home"
                        onClick={handleHome}
                        aria-label="Домой"
                        title="Домой"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M3 10.5 12 3l9 7.5" />
                            <path d="M5.5 9.5V21h13V9.5" />
                        </svg>
                        <span className="nav-pill-label">Домой</span>
                    </button>

                    <button
                        type="button"
                        className="theme-icon-btn"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
                        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
                    >
                        {theme === 'dark' ? (
                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="4.5" />
                                <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
                            </svg>
                        ) : (
                            <svg
                                width="17"
                                height="17"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />
                            </svg>
                        )}
                    </button>

                    <button
                        type="button"
                        className="theme-icon-btn"
                        onClick={handleReload}
                        aria-label="Перезагрузить"
                        title="Перезагрузить"
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                            <path d="M21 3v6h-6" />
                        </svg>
                    </button>
                </div>
            </header>

            {catalogOpen && (
                <OrbitCatalog
                    activePreset={activePreset}
                    onSelect={handleSelectPreset}
                    onClose={() => setCatalogOpen(false)}
                />
            )}

            <div className="workspace-stage">
                <HolstCanvas
                    key={canvasSession}
                    theme={theme}
                    presetCommand={presetCommand}
                    onActivePresetChange={setActivePreset}
                />
            </div>
        </main>
    );
}

export default App;
