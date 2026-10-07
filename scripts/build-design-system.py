"""Editable source for the Aurum Club mobile design-system PDF."""
from pathlib import Path
import math, re, json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
R=Path(__file__).resolve().parents[1]
for n,f in [('Body','manrope-400-normal.ttf'),('Semi','manrope-600-normal.ttf'),('Bold','manrope-700-normal.ttf'),('Display','cormorant-400-normal.ttf'),('Italic','cormorant-500-italic.ttf')]:pdfmetrics.registerFont(TTFont(n,str(R/'public/fonts'/f)))
W,H=841.89,595.28
C=dict(ink='#090d0c',surface='#0c271f',raised='#123127',gold='#d8b66c',light='#f9e3aa',deep='#9d7737',cream='#f4eddf',muted='#b9b5a6',red='#9e2435',green='#147555',coal='#131c1a',warning='#ffc48b')
OUT=R/'output/pdf/aurum-club-design-system.pdf';OUT.parent.mkdir(parents=True,exist_ok=True)
c=canvas.Canvas(str(OUT),pagesize=(W,H));c.setTitle('Aurum Club | Design System Mobile 1.0');c.setAuthor('Aurum Club');c.setSubject('Identidade, componentes, mascote, motion e assets para roleta mobile em retrato.')
def color(k):return HexColor(C.get(k,k))
def box(x,y,w,h,k='surface',stroke=None,r=0):
 c.setFillColor(color(k));c.setStrokeColor(color(stroke or k));c.setLineWidth(.7)
 if r:c.roundRect(x,y,w,h,r,fill=1,stroke=bool(stroke))
 else:c.rect(x,y,w,h,fill=1,stroke=bool(stroke))
def txt(x,y,t,f='Body',s=10,k='cream'):
 c.setFont(f,s);c.setFillColor(color(k));c.drawString(x,y,t)
def para(x,y,t,w=320,s=10,leading=16,k='muted',f='Body'):
 line=''
 for word in t.split():
  test=(line+' '+word).strip()
  if pdfmetrics.stringWidth(test,f,s)>w and line:txt(x,y,line,f,s,k);y-=leading;line=word
  else:line=test
 if line:txt(x,y,line,f,s,k)
 return y-leading
def rule(x,y,x2,y2,k='deep',width=.5):c.setStrokeColor(color(k));c.setLineWidth(width);c.line(x,y,x2,y2)
def diamond(x,y,s=3):
 c.setFillColor(color('gold'));p=c.beginPath();p.moveTo(x,y+s);p.lineTo(x+s,y);p.lineTo(x,y-s);p.lineTo(x-s,y);p.close();c.drawPath(p,fill=1,stroke=0)
def crown(x,y):
 c.saveState();c.translate(x,y);c.setStrokeColor(color('gold'));c.setLineWidth(1)
 p=c.beginPath();p.moveTo(0,20);p.lineTo(10,12);p.lineTo(22,30);p.lineTo(34,12);p.lineTo(44,20);p.lineTo(39,0);p.lineTo(5,0);p.close();c.drawPath(p,stroke=1,fill=0);c.line(5,-5,39,-5);c.restoreState()
def img(file,x,y,w,h,cover=False):
 ir=ImageReader(str(R/file));iw,ih=ir.getSize();scale=max(w/iw,h/ih) if cover else min(w/iw,h/ih);dw,dh=iw*scale,ih*scale
 c.saveState();p=c.beginPath();p.rect(x,y,w,h);c.clipPath(p,stroke=0,fill=0);c.drawImage(ir,x+(w-dw)/2,y+(h-dh)/2,dw,dh,mask='auto');c.restoreState()
def page(n,section,title,desc):
 box(0,0,W,H,'ink');txt(40,559,'AURUM CLUB','Semi',9,'gold');txt(590,559,'DESIGN SYSTEM / MOBILE','Semi',8,'muted');rule(40,544,802,544)
 txt(40,515,section.upper(),'Semi',8,'gold');txt(40,473,title,'Display',37);para(42,447,desc,752,10,15)
 rule(40,35,802,35);txt(40,21,'VERSÃO 1.0  ·  06 OUT 2026','Body',7,'muted');txt(685,21,f'RETRATO / {n:02d}','Semi',7,'gold')
def end():c.showPage()
def chip(x,y,v,k,r=22,selected=False):
 c.setFillColor(color(k));c.setStrokeColor(color('cream'));c.setLineWidth(2);c.circle(x,y,r,fill=1,stroke=1)
 for i in range(12):
  a=i*math.pi/6;rule(x+math.cos(a)*(r-3),y+math.sin(a)*(r-3),x+math.cos(a)*r,y+math.sin(a)*r,'cream',3)
 c.setStrokeColor(color('gold'));c.setLineWidth(.6);c.circle(x,y,r-6,fill=0,stroke=1)
 if selected:c.setLineWidth(1.5);c.circle(x,y,r+5,fill=0,stroke=1)
 c.setFont('Bold',11);c.setFillColor(color('cream'));c.drawCentredString(x,y-4,str(v))
def button(x,y,label,secondary=False,disabled=False,w=175):
 c.saveState()
 if disabled:c.setFillAlpha(.4);c.setStrokeAlpha(.4)
 box(x,y,w,44,'surface' if secondary else 'gold','deep' if secondary else 'light',5);txt(x+14,y+17,label,'Bold',9,'cream' if secondary else 'ink');c.restoreState()
def lum(k):
 vals=[int(C[k][i:i+2],16)/255 for i in (1,3,5)];v=[a/12.92 if a<=.04045 else ((a+.055)/1.055)**2.4 for a in vals];return .2126*v[0]+.7152*v[1]+.0722*v[2]
def ratio(a,b):
 lo,hi=sorted([lum(a),lum(b)]);return (hi+.05)/(lo+.05)

# Cover
img('design-system/assets/originals/lounge.png',0,0,W,H,True);c.saveState();c.setFillAlpha(.8);box(0,0,W,H,'ink');c.restoreState();rule(32,32,W-32,32,'gold');rule(32,H-32,W-32,H-32,'gold')
crown(50,510);txt(110,521,'THE PRIVATE TABLE','Semi',9,'gold');txt(48,405,'AURUM','Display',79,'light');txt(51,340,'CLUB','Display',79);txt(53,282,'O luxo entra em jogo.','Italic',28,'gold')
para(54,230,'Um cassino de ostentação, criado para a palma da mão. A identidade, os componentes e os movimentos de uma nova experiência de roleta.',330,12,19,'cream')
img('design-system/assets/originals/aurum-welcome.png',456,52,329,500);txt(54,91,'DESIGN SYSTEM MOBILE','Semi',11,'gold');txt(54,70,'IDENTIDADE / INTERFACE / MOTION / ASSETS','Body',8,'muted');end()

page(2,'01. Direção criativa','Presença. Prestígio. Personalidade.','Luxo expressivo, acabamento cinematográfico e uma interface que coloca a roleta no centro da experiência.')
for x,num,title,body in [(40,'01','Ostentação com intenção','Ouro nos pontos de valor: molduras, fichas, marca e ação principal. A base escura mantém hierarquia.'),(299,'02','Um anfitrião memorável','Aurum acolhe, espera e comemora. O leão traz carisma adulto, joias, smoking e uma silhueta reconhecível.'),(558,'03','Toque com resposta','A ficha viaja para a aposta, a célula responde e o resultado ganha destaque. Cada ação tem retorno visual.')]:
 box(x,222,242,178,'surface',r=10);txt(x+18,372,num,'Display',35,'gold');txt(x+18,337,title,'Semi',11);para(x+18,311,body,205,10,16)
txt(40,175,'VOZ DA MARCA','Semi',8,'gold');txt(40,144,'“Sua mesa está pronta.”','Italic',28);para(420,172,'Frases curtas, acolhedoras e seguras. Celebrar o resultado sem prometer ganhos. Usar “créditos” e identificar a demonstração.',363,11,18)
txt(40,80,'BASE VISUAL','Semi',8,'gold');txt(165,80,'Art Déco · mármore preto · ouro · esmeralda · cartoon 3D premium','Body',10);end()

page(3,'02. Cores','Uma paleta de salão privé.','Tokens implementados em src/tokens.css. A cor comunica função; o acabamento acrescenta profundidade.')
items=[('ink','Obsidiana','Fundo principal'),('surface','Esmeralda profunda','Superfície / feltro'),('raised','Verde elevado','Apostas externas'),('gold','Ouro Aurum','Ações / assinatura'),('light','Champanhe','Destaques / foco'),('cream','Marfim','Texto principal'),('red','Rubi','Casas vermelhas'),('green','Jade','Zero / ficha 1')]
for i,(k,name,use) in enumerate(items):
 x=40+(i%4)*194;y=286-(i//4)*151;box(x,y+48,180,66,k,'deep',6);txt(x,y+27,name,'Semi',10);txt(x,y+11,C[k].upper(),'Body',9,'gold');txt(x,y-6,use,'Body',8,'muted')
txt(40,83,'CONTRASTES DOS TOKENS','Semi',8,'gold');txt(230,83,f'Marfim / Obsidiana {ratio("cream","ink"):.1f}:1     Ouro / Esmeralda {ratio("gold","surface"):.1f}:1     Obsidiana / Ouro {ratio("ink","gold"):.1f}:1','Body',9)
txt(40,61,'Números, rótulos e contornos completam a informação dada pela cor.','Body',9,'muted');end()

page(4,'03. Tipografia','Elegância na marca. Clareza no jogo.','Cormorant Garamond dá personalidade; Manrope sustenta leitura, valores e controles. Fontes locais acompanham o projeto.')
box(40,150,363,265,'surface',r=10);txt(60,386,'CORMORANT GARAMOND','Semi',9,'gold');txt(60,324,'A sorte tem','Display',45);txt(60,276,'um novo luxo.','Italic',45,'light');para(60,219,'Display 400 / 500 / 600. Usar em assinatura, falas do anfitrião e celebrações. Evitar em saldos ou instruções.',320,10,16)
txt(445,384,'MANROPE','Semi',9,'gold');txt(445,343,'1.000   +350   35:1','Bold',30);txt(445,306,'GIRAR ROLETA','Bold',18,'light');para(445,270,'400 para texto. 600 para labels. 700 e 800 para números, fichas e ações. Valores com algarismos tabulares.',337,10,16)
for y,a,b in [(197,'Marca','24 px / 500'),(176,'Mensagem do anfitrião','21 px / 500'),(155,'Saldo','18 px / 600'),(134,'Número da mesa','13 px / 600'),(113,'Botão principal','10 px / 800')]:txt(445,y,a,'Body',9,'muted');txt(675,y,b,'Semi',9);rule(445,y-7,794,y-7,'surface')
txt(40,80,'FALLBACKS','Semi',8,'gold');txt(142,80,'Georgia para display; sans-serif para interface. Fontes e licenças OFL incluídas.','Body',9,'muted');end()

page(5,'04. Mascote aprovado','Aurum, o dono da noite.','Leão dourado, smoking creme e joias. Um personagem adulto, caloroso e confiante, com acabamento cartoon 3D.')
for x,file,label in [(40,'aurum-welcome.png','BOAS-VINDAS / CORPO INTEIRO'),(280,'aurum-win.png','COMEMORAÇÃO / RETRATO')]:
 box(x,68,224,343,'surface',r=10);img('design-system/assets/originals/'+file,x+7,92,210,304);txt(x+26,83,label,'Semi',7,'gold')
txt(533,387,'ELEMENTOS INVARIÁVEIS','Semi',9,'gold');y=358
for title,body in [('Juba e expressão','Juba volumosa, olhos âmbar e sorriso acolhedor.'),('Traje e joias','Smoking creme, lapela preta, gravata e corrente douradas.'),('Aplicação','Preservar proporções e transparência. Não esticar, recolorir ou cortar a juba.'),('Papel na interface','Acompanhar a rodada sem esconder números, saldo ou controles.')]:txt(533,y,title,'Semi',11);y=para(533,y-20,body,258,10,16)-20
end()

page(6,'05. Componentes','O toque também faz parte do luxo.','Os mesmos tokens constroem botões, fichas, saldo, controles de áudio e estados de interação.')
txt(40,397,'AÇÃO PRINCIPAL','Semi',8,'gold');button(40,336,'GIRAR ROLETA');button(230,336,'GIRANDO...',disabled=True);txt(40,311,'Brilho suave no hover. Deslocamento de 1 px ao pressionar.','Body',9,'muted')
txt(40,267,'AÇÕES SECUNDÁRIAS','Semi',8,'gold')
for x,label in [(40,'DESFAZER'),(164,'LIMPAR'),(288,'REPETIR')]:button(x,207,label,True,w=112)
txt(40,182,'Altura mínima de 44 px. Desabilitados durante o giro.','Body',9,'muted');txt(455,397,'FICHAS TÁTEIS','Semi',8,'gold')
for x,v,k in [(486,1,'green'),(568,5,'red'),(650,25,'coal'),(732,100,'deep')]:chip(x,342,v,k,24,v==5)
para(455,288,'Borda segmentada, aro interno e sombra de apoio. Selecionada: sobe 4 px e recebe um anel dourado externo.',324,10,16)
box(455,118,324,96,'surface','deep',8);txt(474,190,'SEU SALDO','Semi',8,'muted');txt(474,154,'1.000','Semi',30);diamond(596,166,5);txt(639,190,'NA MESA','Semi',8,'muted');txt(639,156,'25','Semi',23,'light')
txt(40,104,'FOCO','Semi',8,'gold');para(100,104,'Contorno champanhe de 2 px, afastado 4 px. Indicação visível para teclado e tecnologias assistivas.',300,9,14);end()

page(7,'06. Tabuleiro','Feltro, metal e feedback.','Grade vertical com zero único, 36 números, dúzias, colunas e apostas externas. Regras e pagamentos preservados.')
img('design-system/previews/mobile-bet.png',43,65,190,350);txt(273,394,'MATERIALIDADE','Semi',8,'gold');para(273,370,'Feltro esmeralda com granulação sutil, dupla moldura dourada e casas em rubi ou verde quase preto. Divisórias finas mantêm os números legíveis.',490,11,18)
txt(273,303,'ESTADOS DE UMA CÉLULA','Semi',8,'gold')
for x,k,label in [(273,'red','Disponível'),(444,'coal','Com aposta'),(615,'green','Resultado')]:
 box(x,224,146,55,k,'gold' if label=='Resultado' else 'deep',3);txt(x+14,244,'0' if label=='Resultado' else '17','Semi',17)
 if label=='Com aposta':chip(x+113,250,25,'coal',16)
 txt(x,204,label,'Semi',9,'muted')
txt(273,166,'COREOGRAFIA','Semi',8,'gold');para(273,143,'Toque: compressão de 160 ms. Ficha: voo de 360 ms, seguido de pulso de 380 ms. Limpar: saída em 230 ms. Resultado: varredura e brilho na casa vencedora.',490,10,17);txt(273,78,'A grade usa alvos compactos; ações principais mantêm 44 px de altura.','Body',9,'muted');end()

page(8,'07. Composição mobile','Desenhado para jogar em pé.','Superfície de até 460 px. A prévia em computador conserva o formato de celular; não existe layout desktop separado.')
img('design-system/previews/mobile-idle.png',40,63,170,354);img('design-system/previews/mobile-spin.png',237,63,170,354)
for yy,label,body in [(393,'01  CABEÇALHO','Marca, saldo, total apostado e som. Hierarquia estável durante toda a rodada.'),(310,'02  PALCO THREE.JS','Roleta com madeira polida, latão, luz quente e reflexos. O leão ocupa uma faixa de boas-vindas acima da cena.'),(211,'03  MESA E CONTROLES','Grade vertical e fichas ao alcance do polegar. Ao girar, o painel desce e libera o palco. Retorna após o resultado.')]:txt(443,yy,label,'Semi',10,'gold');para(443,yy-22,body,348,10,17)
txt(443,109,'ORIENTAÇÃO','Semi',8,'gold');para(443,89,'No celular deitado, uma camada pede que o jogador volte à posição vertical.',348,9,15);end()

page(9,'08. Motion do mascote','Presença em quatro momentos.','Animação 2D de recorte da arte aprovada. Não é um personagem 3D articulado: os movimentos preservam a ilustração.')
rows=[('IDLE','4 s','Respiração suave','Escala de 0,7%, leve oscilação e brilho discreto. Loop.'),('WELCOME','2,5 s','Entrada do anfitrião','Aproximação curta com fade e acomodação. Uma vez.'),('SPIN','3 s','Espera pela rodada','Inclinação suave e pequenos diamantes orbitais. Loop.'),('WIN','3 s','Comemoração','Retrato, pequeno impulso e partículas douradas. Uma vez.')]
for i,(key,dur,title,body) in enumerate(rows):
 y=316-i*69;box(40,y,758,60,'surface' if i%2==0 else 'raised',r=6);txt(57,y+36,key,'Bold',10,'gold');txt(57,y+16,dur,'Body',9,'muted');txt(181,y+36,title,'Semi',11);txt(181,y+16,body,'Body',9,'muted')
txt(40,85,'512 × 768 / 24 FPS / ALPHA REAL','Semi',10,'gold');txt(40,63,'WebM VP9 para o jogo · WebP animado como fallback · ProRes 4444 para edição.','Body',10,'muted');end()

page(10,'09. Comportamento','Sutileza na resposta. Clareza no resultado.','Áudio, tabuleiro e mascote acompanham a mesma rodada. O resultado vem da lógica do jogo, nunca da animação.')
img('design-system/previews/mobile-win.png',42,65,182,350);txt(269,390,'MOVIMENTO DA INTERFACE','Semi',9,'gold')
for i,(label,val) in enumerate([('Resposta curta','160-180 ms'),('Ficha até a casa','360 ms'),('Transição do painel','500 ms'),('Entrada do resultado','650 ms'),('Número premiado','1,2 s, até 3 pulsos')]):
 yy=360-i*31;txt(269,yy,label,'Body',10);txt(596,yy,val,'Semi',10,'gold');rule(269,yy-11,795,yy-11,'surface')
txt(269,179,'REDUZIR MOVIMENTO','Semi',9,'gold');para(269,157,'A preferência do sistema troca os vídeos pelo mascote estático e elimina voos de fichas, pulsos, partículas, tremor e flashes. A roleta mantém o movimento necessário para mostrar a rodada.',519,10,17)
txt(269,88,'SOM','Semi',9,'gold');para(317,88,'Acordes suaves de lounge, fichas e bola física. Mudo persistente. Reprodução após interação.',475,9,15);end()

page(11,'10. Biblioteca de produção','Tudo o que compõe o novo jogo.','O pacote acompanha originais, versões otimizadas, fontes locais, tokens, vídeos com alpha e masters de edição.')
items=[('CENÁRIO','lounge.webp','Salão Art Déco com mármore, ouro e lustres.'),('MASCOTE / BASE','mascot-welcome.webp','Leão Aurum de corpo inteiro, com transparência.'),('MASCOTE / VITÓRIA','mascot-win.webp','Retrato comemorativo com transparência.'),('VETORES','crest.svg + felt-grain.svg','Coroa da marca e granulação do tabuleiro.'),('MOTION','aurum-{estado}.webm / .webp','Idle, welcome, spin e win. Masters .mov incluídos.'),('FONTES E TOKENS','fonts/ + tokens.json + tokens.css','Cormorant Garamond, Manrope e valores do sistema.')]
for i,(label,file,use) in enumerate(items):
 y=384-i*45;txt(40,y,label,'Semi',8,'gold');txt(208,y,file,'Semi',10);txt(208,y-17,use,'Body',9,'muted');rule(40,y-27,797,y-27,'surface')
para(40,88,'Roleta, fichas 3D, reflexos e partículas são desenhados em Three.js. A grade e seus estados são componentes HTML/CSS; não dependem de imagens chapadas.',753,10,17);end()

page(12,'11. Handoff','Um sistema que continua no código.','O PDF apresenta a linguagem visual; os tokens e os componentes do projeto são a referência de implementação.')
box(40,165,368,244,'surface',r=10)
for i,(a,b) in enumerate([('src/tokens.css','Cores, tipografia, espaçamento, raios e durações'),('src/style.css','Tabuleiro, controles e composição em retrato'),('src/scene.js','Materiais, luz, geometria e partículas Three.js'),('src/board-effects.js','Voos de fichas, pulsos, limpeza e resultado'),('src/mascot.js','Vídeo transparente, fallback e movimento reduzido')]):
 y=381-i*44;txt(58,y,a,'Semi',10,'gold');txt(58,y-17,b,'Body',8,'muted')
txt(449,389,'REGRAS DE CONSISTÊNCIA','Semi',9,'gold');y=360
for t in ['Usar os tokens existentes antes de criar uma cor.', 'Reservar dourado sólido para ações e destaques.', 'Manter silhueta, traje e joias do leão.', 'Não alterar probabilidades por efeitos visuais.', 'Exportar motion com alpha e versão estática.', 'Validar em uma tela vertical real.']:
 diamond(452,y+3,2);y=para(464,y,t,322,10,17)-14
txt(40,105,'AURUM CLUB','Display',31,'light');txt(42,80,'Sua mesa. Seu momento.','Italic',18,'gold');txt(449,81,'Arte gerada com a ferramenta image_gen integrada.','Body',8,'muted');txt(449,66,'Prompts completos em design-system/art-direction.json.','Body',8,'muted');end()
c.save()
tokens={m.group(1):m.group(2).strip() for m in re.finditer(r'--([\w-]+):\s*([^;]+);',(R/'src/tokens.css').read_text())}
system={'name':'Aurum Club','version':'1.0','platform':'mobile portrait','tokens':tokens,'typography':{'display':'Cormorant Garamond','body':'Manrope'},'components':{'primaryButton':{'height':44,'fontSize':10,'weight':800,'states':['default','hover','pressed','disabled','focus']},'chip':{'values':[1,5,25,100],'diameter':42,'selectedLift':4},'board':{'orientation':'portrait','numberFontSize':13,'arrivalMs':360,'pressMs':160,'resultPulseMs':1200},'mascot':{'name':'Aurum','species':'lion','type':'2D cutout','states':['welcome','idle','spin','win'],'width':512,'height':768,'fps':24}},'artDirection':'art-direction.json'}
(R/'design-system/tokens.json').write_text(json.dumps(system,ensure_ascii=False,indent=2));print(OUT)
