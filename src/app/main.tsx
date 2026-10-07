import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../components/app/index.tsx';
import { createGameSession } from './bootstrap.ts';
import '../style.css';
const element = document.getElementById('root');
if (!element) throw new Error('Missing root element');
try {
  const store = createGameSession(),
    root = createRoot(element);
  root.render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
  import.meta.hot?.dispose(() => {
    root.unmount();
    store.dispose();
  });
} catch (error) {
  element.setAttribute('role', 'alert');
  element.textContent = error instanceof Error ? error.message : 'The game could not start.';
}
