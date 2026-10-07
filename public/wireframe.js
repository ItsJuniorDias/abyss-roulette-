/* Layout prototype only: no persistent balance, payment, or live roulette outcomes. */
const $ = id => document.getElementById(id);
const phone = $('phone');
const redNumbers = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const order = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const states = {
  welcome:{name:'Boas-vindas',eyebrow:'AURUM · YOUR HOST',title:'Your table<br>is ready.',detail:'Make yourself at home.',description:'O leão recebe o jogador. A roleta já está visível e a primeira aposta fica a um toque.'},
  idle:{name:'Espera',eyebrow:'PLACE YOUR BETS',title:'A table<br>of your own.',detail:'Choose a chip. Make your move.',description:'Respiração e pequenos gestos no mesmo enquadramento. A escolha de apostas continua livre, sem elementos sobre o leão.'},
  spin:{name:'Giro',eyebrow:'NO MORE BETS',title:'The wheel<br>is in motion.',detail:'Your bets are locked.',description:'O leão acompanha a roleta com o olhar. As apostas ficam bloqueadas e a composição permanece estável, sem deslocar o vídeo.'},
  win:{name:'Vitória',eyebrow:'ROUND COMPLETE',title:'A golden<br>moment.',detail:'',description:'A celebração acontece no mesmo espaço. O resultado aparece à direita, a roleta perde ênfase e não surge um segundo mascote.'},
  loss:{name:'Sem prêmio',eyebrow:'ROUND COMPLETE',title:'The round<br>is complete.',detail:'',description:'O anfitrião reage de forma discreta. O número fica legível, sem celebrar uma perda nem cobrir os controles.'}
};
let phase='welcome', chip=5, bets={}, previousFocus=null, activeSheet=null, spinTimer;
const total=()=>Object.values(bets).reduce((sum,value)=>sum+value,0);
const money=value=>new Intl.NumberFormat('en-US').format(value);

// A schematic, drawn in code, reserves the future Three.js wheel's visual footprint.
const ns='http://www.w3.org/2000/svg';
const point=(angle,r)=>[Math.cos(angle)*r,Math.sin(angle)*r];
order.forEach((n,i)=>{
  const a=(i/order.length)*Math.PI*2, b=((i+1)/order.length)*Math.PI*2;
  const p=point(a,99),q=point(b,99),s=point(b,75),t=point(a,75);
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',`M${p} A99 99 0 0 1 ${q} L${s} A75 75 0 0 0 ${t}Z`);
  path.setAttribute('fill',n===0?'#b8bfae':redNumbers.has(n)?'#c1b9a6':'#817c70');
  path.setAttribute('stroke','#efebe2');path.setAttribute('stroke-width','.5');
  const text=document.createElementNS(ns,'text'), mid=(a+b)/2;
  const [x,y]=point(mid,87);text.setAttribute('x',x);text.setAttribute('y',y);
  text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','central');
  text.setAttribute('fill',n===0||redNumbers.has(n)?'#39352c':'#fffdf5');
  text.setAttribute('font-size','6');text.textContent=n;
  $('wheel-segments').append(path,text);
});

function boardCell(key,label,column,row,colSpan=1,rowSpan=1,extra=''){
  const button=document.createElement('button');
  button.dataset.bet=key;button.textContent=label;button.dataset.label=label;
  button.style.gridColumn=`${column} / span ${colSpan}`;button.style.gridRow=`${row} / span ${rowSpan}`;
  button.className=extra;
  const name=key.startsWith('n')?`Number ${label}`:key.startsWith('c')?`Column ${key.slice(1)}`:label;
  button.setAttribute('aria-label',name);button.dataset.accessibleLabel=name;
  $('full-board').append(button);
}
boardCell('n0','0',3,1,3,1,'zero');
for(let n=1;n<=36;n++)boardCell(`n${n}`,String(n),3+(n-1)%3,2+Math.floor((n-1)/3),1,1,redNumbers.has(n)?'red-cell':'');
for(let n=1;n<=3;n++){
  boardCell(`c${n}`,'2:1',2+n,14);
  boardCell(`d${n}`,['1st 12','2nd 12','3rd 12'][n-1],2,2+(n-1)*4,1,4,'external');
}
['low','even','red','black','odd','high'].forEach((key,i)=>boardCell(key,['1–18','EVEN','RED','BLACK','ODD','19–36'][i],1,2+i*2,1,2,'external'));
document.querySelectorAll('[data-bet]').forEach(button=>{
  button.dataset.accessibleLabel ||= button.textContent.trim();
  button.addEventListener('click',()=>{
    if(phase==='spin')return;
    bets[button.dataset.bet]=(bets[button.dataset.bet]||0)+chip;
    if(['welcome','win','loss'].includes(phase))setState('idle');
    renderBets();
  });
});
function renderBets(){
  const locked=phase==='spin', amount=total();
  $('total-bet').textContent=money(amount);$('sheet-total').textContent=money(amount);
  document.querySelectorAll('[data-bet]').forEach(button=>{
    button.disabled=locked;
    const value=bets[button.dataset.bet]||0;
    button.setAttribute('aria-pressed',String(value>0));
    button.setAttribute('aria-label',button.dataset.accessibleLabel+(value?`, ${value} credits placed`:''));
    button.querySelector('.bet-mark')?.remove();
    if(value){const mark=document.createElement('span');mark.className='bet-mark';mark.textContent=value;mark.setAttribute('aria-hidden','true');button.append(mark);}
  });
  document.querySelectorAll('[data-chip]').forEach(button=>{button.disabled=locked;button.setAttribute('aria-pressed',String(Number(button.dataset.chip)===chip));});
  $('clear-bets').disabled=locked||!amount;$('full-table-open').disabled=locked;
  $('spin-button').disabled=locked||!amount;
  $('spin-button').innerHTML=(locked?'SPINNING':amount?'SPIN THE WHEEL':'PLACE A BET')+' <span aria-hidden="true">↗</span>';
  $('play-note').textContent=locked?'No more bets · Layout prototype':'Play credits · Layout prototype';
}
function setState(name){
  clearTimeout(spinTimer);phase=name;const state=states[name];phone.dataset.state=name;
  $('stage-eyebrow').textContent=state.eyebrow;$('stage-title').innerHTML=state.title;$('stage-detail').textContent=state.detail;
  $('state-name').textContent=state.name;$('state-description').textContent=state.description;
  $('stage-result').hidden=!['win','loss'].includes(name);
  $('stage-result').querySelector('small').textContent=name==='loss'?'RESULT':'YOU WIN';
  $('stage-result').querySelector('strong').textContent=name==='loss'?'17':'+180';
  $('stage-result').querySelector('.result-copy>span').textContent=name==='loss'?'NO WIN THIS ROUND':'PLAY CREDITS';
  document.querySelectorAll('.state-picker [data-state]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.state===name)));
  renderBets();
}
document.querySelectorAll('.state-picker [data-state]').forEach(button=>button.addEventListener('click',()=>{closeSheet();setState(button.dataset.state);closeReview();}));
document.querySelectorAll('[data-chip]').forEach(button=>button.addEventListener('click',()=>{chip=Number(button.dataset.chip);renderBets();}));
$('clear-bets').addEventListener('click',()=>{bets={};renderBets();});
$('spin-button').addEventListener('click',()=>{
  if(!total()||phase==='spin')return;
  setState('spin');spinTimer=setTimeout(()=>{bets={};setState('win');},3500);
});
function openSheet(id){
  previousFocus=document.activeElement;activeSheet=$(id);$('sheet-backdrop').hidden=false;activeSheet.hidden=false;
  [...phone.children].filter(el=>el!==activeSheet&&el!==$('sheet-backdrop')).forEach(el=>el.inert=true);
  activeSheet.querySelector('button').focus();
}
function closeSheet(){
  if(!activeSheet)return;
  activeSheet.hidden=true;$('sheet-backdrop').hidden=true;
  [...phone.children].forEach(el=>el.inert=false);
  activeSheet=null;previousFocus?.focus();
}
$('full-table-open').addEventListener('click',()=>openSheet('table-sheet'));
$('menu-open').addEventListener('click',()=>openSheet('menu-sheet'));
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',closeSheet));
$('table-done').addEventListener('click',closeSheet);$('sheet-backdrop').addEventListener('click',closeSheet);
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){closeSheet();closeReview();}
  if(event.key==='Tab'&&activeSheet){
    const elements=[...activeSheet.querySelectorAll('button:not(:disabled),input,[tabindex="0"]')];
    const first=elements[0],last=elements[elements.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
$('screen-size').addEventListener('change',event=>{
  const [w,h]=event.target.value.split(',').map(Number);
  document.documentElement.style.setProperty('--phone-width',`${w}px`);document.documentElement.style.setProperty('--phone-height',`${h}px`);
  phone.classList.toggle('compact',h<780);$('viewport-caption').textContent=`${w} × ${h} · RETRATO`;
});
$('show-guides').addEventListener('change',event=>phone.classList.toggle('guides',event.target.checked));
$('show-color').addEventListener('change',event=>phone.classList.toggle('color-reference',event.target.checked));
$('show-background').addEventListener('change',event=>phone.classList.toggle('background-preview',event.target.checked));
$('framing').addEventListener('change',event=>{
  const bust=event.target.value==='bust';phone.dataset.framing=event.target.value;
  document.querySelector('.frame-label').textContent=bust?'BUSTO · ÁREA DO VÍDEO':'CORPO INTEIRO · VÍDEO';
  document.querySelector('.baseline').textContent=bust?'CORTE FIXO NA CINTURA':'BASE FIXA DOS PÉS';
  document.querySelector('.character').alt=`Aurum, the lion host in a cream tuxedo. ${bust?'Waist-up':'Full-body'} static framing reference.`;
});
function closeReview(){
  const open=$('review-notes').classList.contains('open');
  $('review-notes').classList.remove('open');$('review-toggle').setAttribute('aria-expanded','false');$('review-toggle').textContent='Revisar layout';
  phone.inert=false;
  if(open)$('review-toggle').focus();
}
$('review-toggle').addEventListener('click',()=>{
  if($('review-notes').classList.contains('open'))return closeReview();
  closeSheet();$('review-notes').classList.add('open');$('review-toggle').setAttribute('aria-expanded','true');$('review-toggle').textContent='Voltar ao wireframe';phone.inert=true;
});
matchMedia('(max-width:700px)').addEventListener('change',closeReview);
if(new URLSearchParams(location.search).get('background')==='1'){
  $('show-background').checked=true;phone.classList.add('background-preview');
}
renderBets();
