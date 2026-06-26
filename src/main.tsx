import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { initDB } from './db.js';
import { runLLMMigration } from './llm/factory.js';
import { runContentMigration } from './markdown/contentMigration';
import { Providers } from './app/providers';
import { App } from './app/App';

async function showWindow(): Promise<void> {
  try {
    await getCurrentWindow().show();
  } catch (e) {
    console.error('show window failed', e);
  }
}

async function bootstrap(): Promise<void> {
  const safetyTimer = setTimeout(() => void showWindow(), 3000);
  try {
    await initDB();
    await runLLMMigration();
    await runContentMigration();

    const root = createRoot(document.getElementById('root')!);
    root.render(
      <StrictMode>
        <Providers>
          <App />
        </Providers>
      </StrictMode>
    );
  } catch (e) {
    console.error('CapLog init failed', e);
    document.body.innerHTML = `<div style="color:#eee;background:#0e0e0e;padding:24px;font-family:monospace;white-space:pre-wrap;">CapLog failed to start:\n\n${String(
      (e as Error)?.stack || e
    )}</div>`;
  } finally {
    clearTimeout(safetyTimer);
    await showWindow();
  }
}

void bootstrap();
