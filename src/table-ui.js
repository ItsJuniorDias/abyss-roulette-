// The board and menu share one accessible sheet layer; the stage never moves.
const shell = document.getElementById('game-shell');
const backdrop = document.getElementById('sheet-backdrop');
let sheet = null, trigger = null;
export function closeSheet() {
  if (!sheet) return;
  sheet.hidden = true; backdrop.hidden = true;
  [...shell.children].forEach(child => { child.inert = false; });
  sheet = null; trigger?.focus();
}
function openSheet(id) {
  closeSheet(); trigger = document.activeElement; sheet = document.getElementById(id);
  sheet.hidden = false; backdrop.hidden = false;
  [...shell.children].forEach(child => { child.inert = child !== sheet && child !== backdrop; });
  sheet.querySelector('button').focus();
}
document.getElementById('full-table-open').onclick = () => openSheet('table-sheet');
document.getElementById('menu-open').onclick = () => openSheet('menu-sheet');
document.getElementById('table-done').onclick = closeSheet;
document.querySelectorAll('[data-close-sheet]').forEach(button => { button.onclick = closeSheet; });
backdrop.onclick = closeSheet;
document.addEventListener('keydown', event => {
  if (!sheet) return;
  if (event.key === 'Escape') { event.preventDefault(); closeSheet(); return; }
  if (event.key !== 'Tab') return;
  const elements = [...sheet.querySelectorAll('button:not(:disabled),[tabindex="0"]')].filter(el => !el.hidden);
  const first = elements[0], last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
