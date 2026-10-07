// Compile generated drawings into a sprite atlas, timed alpha video and review package.
const {components,normalize,createCanvas,loadImage}=require('./sprite-tools.cjs');
const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process'),{once}=require('node:events');
const ROOT=path.resolve(__dirname,'..'),DIR=path.join(ROOT,'design-system/sprites/welcome'),OUT=path.join(ROOT,'public/animations/welcome-sprites');
const W=576,H=768,COLS=6,FPS=24;
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(path.join(DIR,'frames'),{recursive:true});fs.mkdirSync(path.join(DIR,'exports'),{recursive:true});
 const poses=[],placement=[];
 for(let key=1;key<=6;key++){
  poses.push({image:await loadImage(path.join(DIR,`keyframes/key-${String(key).padStart(2,'0')}.png`)),kind:'key',source:`key-${key}`});
  if(key===6)break;
  const pair=`${String(key).padStart(2,'0')}-${String(key+1).padStart(2,'0')}`;
  const source=await components(path.join(DIR,`inbetweens/between-${pair}.png`));if(source.regions.length!==4)throw Error(`${pair}: expected 4 sprites, found ${source.regions.length}`);
  const heights=source.regions.map(r=>r.height).sort((a,b)=>a-b),scale=620/heights[2];
  for(let k=0;k<4;k++){
   const n=normalize(source,source.regions[k],{width:W,height:H,footX:254,footY:734,scale});
   const b=n.placement.bounds;if(b.x<0||b.y<0||b.x+b.width>W||b.y+b.height>H)throw Error(`${pair}-${k}: clipped normalized sprite`);
   poses.push({image:n.canvas,kind:'inbetween',source:`${pair}-${k+1}`});placement.push({pair,step:k+1,...n.placement});
  }
 }
 const atlas=createCanvas(W*COLS,H*Math.ceil(poses.length/COLS)),ctx=atlas.getContext('2d');const frames=[];let ticks=0;
 for(let i=0;i<poses.length;i++){
  const pose=poses[i],c=createCanvas(W,H),cx=c.getContext('2d');cx.drawImage(pose.image,0,0);
  const file=`frame-${String(i).padStart(2,'0')}.png`;fs.writeFileSync(path.join(DIR,'frames',file),c.toBuffer('image/png'));
  const hold=i===0?8:i===20?6:i===25?12:2;
  frames.push({index:i,x:i%COLS*W,y:Math.floor(i/COLS)*H,w:W,h:H,ticks:hold,startTick:ticks,kind:pose.kind,source:pose.source,file});ticks+=hold;
  ctx.drawImage(c,i%COLS*W,Math.floor(i/COLS)*H);
 }
 const atlasPng=path.join(DIR,'exports/welcome-atlas.png');fs.writeFileSync(atlasPng,atlas.toBuffer('image/png'));
 const comp=spawnSync('cwebp',['-quiet','-q','94','-alpha_q','100',atlasPng,'-o',path.join(OUT,'atlas.webp')]);if(comp.status!==0)throw Error('WebP atlas encoding failed');
 const spec={name:'Aurum — boas-vindas',version:1,status:'Animatic de sprites para revisão',method:'26 desenhos distintos; reprodução quadro a quadro, sem crossfade, morph ou transformação do recorte',frameWidth:W,frameHeight:H,footPivot:{x:254,y:734},atlas:'atlas.webp',columns:COLS,rows:Math.ceil(poses.length/COLS),timebase:FPS,ticks,duration:ticks/FPS,loop:false,frames};
 fs.writeFileSync(path.join(OUT,'sequence.json'),JSON.stringify(spec,null,2));fs.writeFileSync(path.join(DIR,'exports/sequence.json'),JSON.stringify(spec,null,2));fs.writeFileSync(path.join(DIR,'inbetweens/placement.json'),JSON.stringify(placement,null,2));
 const args=['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size',`${W}x${H}`,'-framerate',String(FPS),'-i','pipe:0','-an','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-b:v','0','-crf','25','-auto-alt-ref','0','-row-mt','1',path.join(OUT,'welcome-preview.webm'),'-an','-c:v','prores_ks','-profile:v','4','-pix_fmt','yuva444p10le','-alpha_bits','16',path.join(DIR,'exports/welcome-master.mov')];
 const ff=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});let err='';ff.stderr.on('data',d=>err+=d);ff.stdin.on('error',()=>{});const done=once(ff,'close');
 for(let i=0;i<poses.length;i++){
  const c=createCanvas(W,H),cx=c.getContext('2d');cx.drawImage(poses[i].image,0,0);const buf=Buffer.from(cx.getImageData(0,0,W,H).data);
  for(let t=0;t<frames[i].ticks;t++)if(!ff.stdin.write(buf))await once(ff.stdin,'drain');
 }
 ff.stdin.end();const [code]=await done;if(code!==0)throw Error(err);
 const webpArgs=['-loop','1','-lossy','-q','80'];let ms=0;
 frames.forEach(f=>{const end=Math.round((f.startTick+f.ticks)/FPS*1000);webpArgs.push('-d',String(end-ms),path.join(DIR,'frames',f.file));ms=end});webpArgs.push('-o',path.join(OUT,'welcome-preview.webp'));
 const anim=spawnSync('img2webp',webpArgs,{encoding:'utf8'});if(anim.status!==0)throw Error(anim.stderr);
 // Contact sheet for art QA, never consumed as a game sprite.
 const contact=createCanvas(1440,Math.ceil(poses.length/6)*340),cc=contact.getContext('2d');cc.fillStyle='#0c271f';cc.fillRect(0,0,contact.width,contact.height);
 poses.forEach((p,i)=>{const x=i%6*240,y=Math.floor(i/6)*340;cc.drawImage(p.image,x,y,240,320);cc.fillStyle='#d8b66c';cc.font='14px sans-serif';cc.fillText(`${String(i).padStart(2,'0')} · ${p.source}`,x+12,y+330)});
 fs.writeFileSync(path.join(ROOT,'tmp/sprites/sequence-contact.png'),contact.toBuffer('image/png'));
 console.log(JSON.stringify({sprites:poses.length,ticks,duration:ticks/FPS,width:W,height:H,atlas:{width:atlas.width,height:atlas.height},outputs:OUT}));
})().catch(e=>{console.error(e);process.exit(1)});
