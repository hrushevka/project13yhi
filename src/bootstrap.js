// Keep startup failures visible even when React or an application module fails to load.
import('./main.jsx').catch(error => {
    console.error('Cosmos lab startup failed', error);
    const root = document.getElementById('root');
    const message = document.createElement('p');
    message.textContent = 'Не удалось загрузить Cosmos lab. Запустите npm run dev и откройте http://localhost:2283.';
    const retry = document.createElement('button');
    retry.textContent = 'Перезагрузить';
    retry.addEventListener('click', () => window.location.reload());
    root.replaceChildren(message, retry);
});
