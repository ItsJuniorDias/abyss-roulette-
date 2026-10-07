import type { SceneManagerProps } from '../../interfaces/components.ts';

import { GameplayScene } from '../../scenes/gameplay/index.tsx';
import { t } from '../../utils/i18n.ts';
export function SceneManager({ store, audio }: SceneManagerProps) {
  if (!audio)
    return (
      <main id="game-shell">
        <p className="startup" role="status">
          {t('loading')}
        </p>
      </main>
    );
  return <GameplayScene store={store} audio={audio} />;
}
