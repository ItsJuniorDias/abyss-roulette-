// Tactile board feedback. The game owns the balance; these effects are presentation only.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
export function chipArrival(cell, amount, color) {
  const from = document.querySelector(`.chip[data-v="${amount}"]`);
  if (reduceMotion.matches || !from) return;
  const source = from.getBoundingClientRect(), target = cell.getBoundingClientRect();
  const shell = document.getElementById('game-shell'), bounds = shell.getBoundingClientRect();
  const chip = document.createElement('span');
  chip.className = 'flying-chip'; chip.textContent = amount; chip.style.background = color;
  chip.setAttribute('aria-hidden', 'true');
  chip.style.left = `${source.left + source.width / 2 - bounds.left - 12}px`;
  chip.style.top = `${source.top + source.height / 2 - bounds.top - 12}px`;
  shell.appendChild(chip);
  const dx = target.right - 13 - (source.left + source.width / 2);
  const dy = target.top + target.height / 2 - (source.top + source.height / 2);
  const animation = chip.animate([
    { transform: 'translate(0, 0) scale(1.3) rotate(-20deg)', opacity: 1 },
    { transform: `translate(${dx * .6}px, ${dy * .65 - 22}px) scale(1.15) rotate(8deg)`, offset: .6 },
    { transform: `translate(${dx}px, ${dy}px) scale(.83) rotate(0deg)`, opacity: 1 },
  ], { duration: 360, easing: 'cubic-bezier(.2,.7,.25,1)' });
  animation.onfinish = () => { chip.remove(); pulseCell(cell); };
  animation.oncancel = () => chip.remove();
}
export function pulseCell(cell) {
  if (reduceMotion.matches) return;
  cell.animate([{ filter: 'brightness(1.65)' }, { filter: 'brightness(1)' }], { duration: 380, easing: 'ease-out' });
  const ripple = document.createElement('span'); ripple.className = 'bet-ripple'; ripple.setAttribute('aria-hidden', 'true'); cell.appendChild(ripple);
  const animation = ripple.animate([{ transform: 'scale(.25)', opacity: .8 }, { transform: 'scale(1.6)', opacity: 0 }], { duration: 450, easing: 'ease-out' });
  animation.onfinish = () => ripple.remove();
}
export function clearTableEffect() {
  if (reduceMotion.matches) return;
  document.querySelectorAll('.chipmark').forEach((mark, i) => {
    const ghost = mark.cloneNode(true); ghost.classList.add('chip-ghost'); ghost.setAttribute('aria-hidden', 'true'); mark.parentElement.appendChild(ghost);
    const animation = ghost.animate([{ transform: 'translateY(-50%)', opacity: 1 }, { transform: 'translateY(-35px) scale(.6)', opacity: 0 }], { duration: 230, delay: Math.min(i * 15, 150), easing: 'ease-in' });
    animation.onfinish = () => ghost.remove();
  });
}
export function resultSweep(number) {
  if (reduceMotion.matches) return;
  const cells = [...document.querySelectorAll('.cell[data-bet^="n"]')];
  cells.forEach((cell, i) => {
    if (cell.dataset.bet === `n${number}`) return;
    cell.animate([{ boxShadow: 'inset 0 0 0 1px #f9e3aa80', filter: 'brightness(1.3)' }, { boxShadow: 'inset 0 0 0 0px transparent', filter: 'brightness(1)' }], { duration: 420, delay: i * 9, easing: 'ease-out' });
  });
}
