export function AppHeader({ theme, toggleTheme }) {
    return (
        <div className="corner-brand">
            <div className="brand-cluster"><span className="brand-logo"><img src={new URL('../assets/cosmos-logo.png', import.meta.url).href} alt="Cosmos lab" /></span></div>
            <button type="button" className="theme-icon-btn" onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}>
                {theme === 'dark' ? '☀' : '☾'}
            </button>
        </div>
    );
}
