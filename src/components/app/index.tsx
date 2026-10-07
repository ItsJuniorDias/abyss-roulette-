import { Component } from 'react';

import { useAudioSession } from '../../hooks/use-audio-session.ts';
import { SceneManager } from '../scene-manager/index.tsx';
import type {
  AppProps,
  ErrorBoundaryProps,
  ErrorBoundaryState,
} from '../../interfaces/components.ts';
import { t } from '../../utils/i18n.ts';
export function App({ store }: AppProps) {
  const audio = useAudioSession();
  return (
    <AppErrorBoundary>
      <SceneManager store={store} audio={audio} />
    </AppErrorBoundary>
  );
}
class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main id="game-shell">
        <p className="startup" role="alert">
          {t('startupFailed')}
        </p>
      </main>
    ) : (
      this.props.children
    );
  }
}
