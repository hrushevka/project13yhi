# Cosmos lab

Standalone React gravity simulator. No backend, account, or .NET installation is required.

From this directory:

```powershell
npm install
npm run dev
```

Open http://localhost:2283 in your browser. Keep the terminal running.
Use the HTTP address; opening index.html directly from the filesystem does not run a Vite application.

To verify and preview a production build:

```powershell
npm run lint
npm test
npm run build
npm run preview
```

Open the address printed by the preview command. The `dist` directory can also be served by a static HTTP server.
