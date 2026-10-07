// Deterministic 2D cutout animation of the approved mascot, with real alpha output.
// CODEX_NODE_MODULES can point to the bundled Node modules, or install @napi-rs/canvas locally.
const {createCanvas, loadImage} = require(process.env.CODEX_NODE_MODULES ? `${process.env.CODEX_NODE_MODULES}/@napi-rs/canvas` : '@napi-rs/canvas');
const {spawn, spawnSync} = require('node:child_process');
const {once} = require('node:events');
const {mkdirSync, writeFileSync} = require('node:fs');
const path = require('node:path');
const ROOT=path.resolve(__dirname,'..');
const W=512,H=768,FPS=24;
const variants=[['idle',4,true],['welcome',2.5,false],['spin',3,true],['win',3,false]];
const ease=t=>1-(1-t)**3;
function star(ctx,x,y,size,alpha,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;ctx.fillStyle='#f9e3aa';ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;const r=i%2?size*.25:size;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r)}ctx.closePath();ctx.fill();ctx.restore()}
(async()=>{
 const welcome=await loadImage(path.join(ROOT,'design-system/assets/originals/aurum-welcome.png'));
 const win=await loadImage(path.join(ROOT,'design-system/assets/originals/aurum-win.png'));
 mkdirSync(path.join(ROOT,'public/animations'),{recursive:true});
 mkdirSync(path.join(ROOT,'design-system/animations/masters'),{recursive:true});
 for(const [name,duration,loop] of variants){
  const c=createCanvas(W,H),ctx=c.getContext('2d'),frames=Math.round(FPS*duration);
  const out=path.join(ROOT,'public/animations',`aurum-${name}`);
  const master=path.join(ROOT,'design-system/animations/masters',`aurum-${name}.mov`);
  const frameDir=path.join(ROOT,'tmp/animation-frames',name);mkdirSync(frameDir,{recursive:true});const framePaths=[];
  const args=['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an',
   '-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','31','-auto-alt-ref','0','-row-mt','1',out+'.webm',
   '-an','-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le','-alpha_bits','16',master];
  const ff=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let stderr='';ff.stderr.on('data',x=>{stderr+=x; process.stderr.write(x);});ff.stdin.on('error',()=>{});const done=once(ff,'close');
  for(let frame=0;frame<frames;frame++){
   const t=frame/FPS,u=frame/(frames-1),phase=u*Math.PI*2;
   ctx.clearRect(0,0,W,H);ctx.save();
   let y=0,scale=1,rotation=0,alpha=1;
   if(name==='idle'){scale=1+Math.sin(phase)*.007;y=Math.sin(phase)*2;rotation=Math.sin(phase)*.004;}
   if(name==='welcome'){const k=ease(Math.min(1,t/.65));y=(1-k)*46;scale=.94+k*.06;alpha=Math.min(1,t/.3);rotation=(1-k)*-.025;}
   if(name==='spin'){rotation=Math.sin(phase)*.018;y=Math.cos(phase)*2;scale=1+Math.sin(phase)*.006;}
   if(name==='win'){const k=ease(Math.min(1,t/.5));scale=.88+k*.12+Math.sin(Math.max(0,t-.5)*6)*Math.exp(-Math.max(0,t-.5)*2)*.015;alpha=Math.min(1,t/.18);y=(1-k)*18;}
   const img=name==='win'?win:welcome;
   ctx.globalAlpha=alpha;ctx.translate(W/2,H-28+y);ctx.rotate(rotation);ctx.scale(scale,scale);
   const ratio=Math.min((W-44)/img.width,(H-62)/img.height);
   ctx.drawImage(img,-img.width*ratio/2,-img.height*ratio,img.width*ratio,img.height*ratio);ctx.restore();
   if(name==='idle'||name==='welcome'){const glint=Math.max(0,Math.sin(phase))**12;star(ctx,263,268,5+glint*6,glint*.8,phase*.15);}
   if(name==='spin'){for(let i=0;i<3;i++){const a=phase+i*Math.PI*2/3;star(ctx,W/2+Math.cos(a)*205,360+Math.sin(a)*100,6,.4,phase);}}
   if(name==='win'){for(let i=0;i<34;i++){const a=i*2.399,age=t-(i%6)*.045;if(age<0)continue;const speed=50+(i*23%120);const x=W/2+Math.cos(a)*speed*age;const yy=280+Math.sin(a)*speed*age+42*age*age;const opacity=Math.max(0,1-age/2.7)*.9;star(ctx,x,yy,3+i%4,opacity,a+t);}}
   const framePath=path.join(frameDir,`${String(frame).padStart(4,'0')}.png`);writeFileSync(framePath,c.toBuffer('image/png'));framePaths.push(framePath);
   const buffer=Buffer.from(ctx.getImageData(0,0,W,H).data);
   if(!ff.stdin.write(buffer))await once(ff.stdin,'drain');
  }
  ff.stdin.end();const [code]=await done;if(code!==0)throw Error(stderr);
  const webp=spawnSync('img2webp',['-loop',loop?'0':'1','-d',String(Math.round(1000/FPS)),'-lossy','-q','75',...framePaths,'-o',out+'.webp'],{encoding:'utf8'});if(webp.status!==0)throw Error(webp.stderr);
  console.log(`${name}: ${duration}s, ${FPS} fps, alpha WebM + animated WebP + ProRes 4444`);
 }
 writeFileSync(path.join(ROOT,'public/animations/manifest.json'),JSON.stringify({type:'2D cutout',width:W,height:H,fps:FPS,alpha:true,states:Object.fromEntries(variants.map(([name,duration,loop])=>[name,{duration,loop,video:`aurum-${name}.webm`,fallback:`aurum-${name}.webp`,poster:name==='win'?'../assets/luxury/mascot-win.webp':'../assets/luxury/mascot-welcome.webp'}]))},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
