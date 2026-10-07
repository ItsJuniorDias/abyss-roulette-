// Lossless sprite isolation and fixed foot-pivot placement; artwork is generated separately.
const root = process.env.CODEX_NODE_MODULES;
const {createCanvas,loadImage}=require(root ? `${root}/@napi-rs/canvas` : '@napi-rs/canvas');
const fs=require('node:fs');
async function components(file){
 const im=await loadImage(file),w=im.width,h=im.height,c=createCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(im,0,0);
 const pixels=ctx.getImageData(0,0,w,h),d=pixels.data,labels=new Int32Array(w*h),queue=new Int32Array(w*h);let id=0,regions=[];
 for(let i=0;i<w*h;i++){
  if(labels[i]||d[i*4+3]<9)continue;
  id++;let start=0,end=0;queue[end++]=i;labels[i]=id;
  let minX=w,minY=h,maxX=0,maxY=0,count=0;
  while(start<end){const p=queue[start++],x=p%w,y=Math.floor(p/w);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(const n of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(n>=0&&!labels[n]&&d[n*4+3]>=9){labels[n]=id;queue[end++]=n}
  }
  if(count>3000)regions.push({id,count,minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1});
 }
 regions.sort((a,b)=>Math.abs(a.minY-b.minY)>h*.2?a.minY-b.minY:a.minX-b.minX);
 return {image:im,pixels,labels,regions,w,h};
}
function normalize(source,region,{width=576,height=768,footX=254,footY=734,scale}={}){
 const {pixels,labels,w,h}=source,d=pixels.data;
 const crop=createCanvas(region.width+8,region.height+8),cx=crop.getContext('2d'),out=cx.createImageData(crop.width,crop.height);
 // Include the main connected silhouette, preserving its original RGBA.
 for(let y=region.minY;y<=region.maxY;y++)for(let x=region.minX;x<=region.maxX;x++){
  const p=y*w+x;if(labels[p]!==region.id)continue;
  const q=((y-region.minY+4)*crop.width+x-region.minX+4)*4;
  out.data.set(d.subarray(p*4,p*4+4),q);
 }
 cx.putImageData(out,0,0);
 let lowX=Infinity,highX=-Infinity;
 for(let y=Math.max(0,region.maxY-28);y<=region.maxY;y++)for(let x=region.minX;x<=region.maxX;x++)if(labels[y*w+x]===region.id&&d[(y*w+x)*4+3]>128){lowX=Math.min(lowX,x);highX=Math.max(highX,x)}
 const pivotX=(lowX+highX)/2-region.minX+4,pivotY=region.height+3;
 const c=createCanvas(width,height),ctx=c.getContext('2d');
 scale??=680/region.height;
 const x=footX-pivotX*scale,y=footY-pivotY*scale;
 ctx.drawImage(crop,x,y,crop.width*scale,crop.height*scale);
 return {canvas:c,placement:{scale,footX,footY,bounds:{x,y,width:crop.width*scale,height:crop.height*scale},source:region}};
}
module.exports={components,normalize,createCanvas,loadImage};
if(require.main===module)(async()=>{
 const file=process.argv[2];const source=await components(file);console.log(JSON.stringify(source.regions));
 const heights=source.regions.map(r=>r.height).sort((a,b)=>a-b);const scale=620/heights[Math.floor(heights.length/2)];
 const placements=[];
 for(let i=0;i<source.regions.length;i++){const r=normalize(source,source.regions[i],{scale});fs.writeFileSync(`design-system/sprites/welcome/keyframes/key-${String(i+1).padStart(2,'0')}.png`,r.canvas.toBuffer('image/png'));placements.push(r.placement)}
 fs.writeFileSync('design-system/sprites/welcome/keyframes/placement.json',JSON.stringify(placements,null,2));
 const contact=createCanvas(1728,1536),cx=contact.getContext('2d');cx.fillStyle='#0c271f';cx.fillRect(0,0,1728,1536);
 for(let i=0;i<6;i++){const im=await loadImage(`design-system/sprites/welcome/keyframes/key-${String(i+1).padStart(2,'0')}.png`);cx.drawImage(im,(i%3)*576,Math.floor(i/3)*768);cx.strokeStyle='#d8b66c';cx.beginPath();cx.moveTo(i%3*576,Math.floor(i/3)*768+734);cx.lineTo(i%3*576+576,Math.floor(i/3)*768+734);cx.stroke()}
 fs.writeFileSync('tmp/sprites/aligned-keyframes.png',contact.toBuffer('image/png'));
})().catch(e=>{console.error(e);process.exit(1)});
