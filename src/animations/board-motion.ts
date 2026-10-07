export function chipFlight(dx: number, dy: number): Keyframe[] {
  return [
    { transform: 'translate(0,0) scale(1.3) rotate(-20deg)', opacity: 1 },
    {
      transform: `translate(${dx * 0.6}px,${dy * 0.65 - 22}px) scale(1.15) rotate(8deg)`,
      offset: 0.6,
    },
    { transform: `translate(${dx}px,${dy}px) scale(.83) rotate(0deg)`, opacity: 1 },
  ];
}
