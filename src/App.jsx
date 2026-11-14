import { useLayoutEffect, useState } from 'react';
import './App.css';
import './mission.css';
import { AppHeader } from './components/AppHeader';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HolstCanvas } from './components/HolstCanvas';
import { OrbitCatalog } from './components/OrbitCatalog';
import { PRESETS } from './utils/presets';

const THEME_KEY = 'cosmos-lab-theme';

function readTheme() {
    try { return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
}

export default function App() {
    const [theme, setTheme] = useState(readTheme);
    const [generation, setGeneration] = useState(0);
    const [catalogOpen, setCatalogOpen] = useState(false);
    const [activePreset, setActivePreset] = useState(PRESETS[0]);
    const [presetCommand, setPresetCommand] = useState({ preset: null, nonce: 0 });

    useLayoutEffect(() => {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem(THEME_KEY, theme); } catch { /* Storage is optional. */ }
    }, [theme]);

    function resetWorkspace() {
        setCatalogOpen(false);
        setActivePreset(PRESETS[0]);
        setPresetCommand({ preset: null, nonce: 0 });
        setGeneration(value => value + 1);
    }

    function selectPreset(preset) {
        setPresetCommand(command => ({ preset, nonce: command.nonce + 1 }));
        setCatalogOpen(false);
    }

    return (
        <main className="app-shell">
            <AppHeader
                theme={theme}
                toggleTheme={() => setTheme(value => value === 'dark' ? 'light' : 'dark')}
            />
            <ErrorBoundary key={generation} onReset={resetWorkspace}>
                {catalogOpen && (
                    <OrbitCatalog activePreset={activePreset} onSelect={selectPreset} onClose={() => setCatalogOpen(false)} />
                )}
                <div className="workspace-stage">
                    <HolstCanvas theme={theme} presetCommand={presetCommand} onActivePresetChange={setActivePreset} onOpenCatalog={() => setCatalogOpen(true)} />
                </div>
            </ErrorBoundary>
        </main>
    );
}
