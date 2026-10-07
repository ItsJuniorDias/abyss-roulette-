import { t } from '../../utils/i18n.ts';
import { useMascot } from '../../hooks/use-mascot.ts';
import type { MascotProps } from '../../interfaces/components.ts';
import { ASSETS } from '../../config/assets.ts';
export function Mascot({ state }: MascotProps) {
  const refs = useMascot(state);
  return (
    <div className="mascot-stage" ref={refs.stage}>
      <img id="mascot" ref={refs.still} src={ASSETS.poster} alt={t('mascotAlt')} />
      <canvas id="mascot-canvas" ref={refs.canvas} width={640} height={480} aria-hidden="true" />
      <video
        id="mascot-video-a"
        ref={refs.a}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <video
        id="mascot-video-b"
        ref={refs.b}
        autoPlay
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    </div>
  );
}
