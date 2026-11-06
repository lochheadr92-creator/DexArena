// Asset packaging only. All anatomical frames are drawn by image_gen; this
// script does not manufacture motion, mirror views or interpolate new frames.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PNG}=require('pngjs');
const {GIFEncoder,quantize,applyPalette}=require('gifenc');
const root=path.resolve(__dirname,'../..');
const batch=process.argv.includes('--production')?'batch-02':'batch-01';
const only=process.argv.find(x=>x.startsWith('--slug='))?.slice(7);
const jobs=require('./'+batch+'.json').filter(j=>!only||j.slug===only);
const roster=require('../../../docs/original-creatures/designs/roster.json');
const manifestPath=path.resolve(root,'../docs/original-creatures/designs/assets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath));
const sourceDir=path.resolve(root,'../docs/original-creatures',batch,'source');
fs.mkdirSync(sourceDir,{recursive:true});
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const sizes={reedlet:52,thimblereed:64,sedgewarden:76,cindrick:50,hearthorn:74,rillip:52,prismantis:66,voltrivet:60,breakerbill:76,bastilimp:68,drakarn:76,bathyridge:76};
const report=[];
for(const job of jobs){
  const creature=roster.find(c=>c.name===job.slug);
  const savedSource=path.join(sourceDir,job.slug+'.png');
  if(!fs.existsSync(savedSource)) fs.copyFileSync(job.source,savedSource);
  const sourceBytes=fs.readFileSync(savedSource), src=PNG.sync.read(sourceBytes);
  if(src.width%3||src.height%4) throw Error(`Wrong source grid: ${job.slug}`);
  const cw=src.width/3,ch=src.height/4, cells=[];
  for(let n=0;n<12;n++){
    const x0=(n%3)*cw,y0=Math.floor(n/3)*ch;
    let left=cw,top=ch,right=-1,bottom=-1;
    for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(src.data[((y+y0)*src.width+x+x0)*4+3]>=128){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right<left)throw Error(`Empty source cell: ${job.slug}/${n}`);
    let footX=0,footCount=0;
    for(let y=bottom-3;y<=bottom;y++)for(let x=left;x<=right;x++)if(src.data[((y+y0)*src.width+x+x0)*4+3]>=128){footX+=x;footCount++;}
    cells.push({x0,y0,left,top,right,bottom,anchorX:footX/footCount});
  }
  const maxHeight=Math.max(...cells.map(c=>c.bottom-c.top+1));
  // One scale for all twelve drawings, never separately resize each pose.
  const leftExtent=Math.max(...cells.map(c=>c.anchorX-c.left));
  const rightExtent=Math.max(...cells.map(c=>c.right-c.anchorX));
  const targetHeight=sizes[job.slug] || (creature.stage==='base'?52:creature.stage==='middle'?64:76);
  const scale=Math.min(targetHeight/maxHeight,42/leftExtent,42/rightExtent);
  const frames=cells.map(c=>{
    const frame=new PNG({width:96,height:96});
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const sx=Math.round((x-48)/scale+c.anchorX),sy=Math.round((y-86)/scale+c.bottom);
      if(sx<0||sx>=cw||sy<0||sy>=ch)continue;
      const si=((sy+c.y0)*src.width+sx+c.x0)*4,di=(y*96+x)*4;
      if(src.data[si+3]<128)continue;
      frame.data[di]=src.data[si];frame.data[di+1]=src.data[si+1];frame.data[di+2]=src.data[si+2];frame.data[di+3]=255;
    }
    // Nearest-neighbour sampling can miss a thin source foot on the last row.
    // Align the rasterized silhouette, rather than assuming source bounds survive.
    let bottom=0;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(frame.data[(y*96+x)*4+3])bottom=y;
    if(bottom!==86){
      const aligned=new PNG({width:96,height:96});
      PNG.bitblt(frame,aligned,0,0,96,bottom+1,0,86-bottom);
      return aligned;
    }
    return frame;
  });
  const combined=Buffer.concat(frames.map(f=>f.data));
  const palette=quantize(combined,24,{format:'rgba4444',oneBitAlpha:true});
  const transparentIndex=palette.findIndex(c=>c[3]===0);
  if(transparentIndex<0)throw Error('Transparent palette entry missing');
  const dir=path.join(root,'public/originals/v1',job.slug);fs.mkdirSync(dir,{recursive:true});
  const nativeFrames=frames.map(frame=>{
    const index=applyPalette(frame.data,palette,'rgba4444');
    for(let p=0;p<index.length;p++){
      if(frame.data[p*4+3]===0)index[p]=transparentIndex;
      frame.data.set(palette[index[p]],p*4);
    }
    return {frame,index};
  });
  for(const [view,offset] of [['front',0],['back',6]]){
    const six=nativeFrames.slice(offset,offset+6);
    if(new Set(six.map(f=>hash(f.frame.data))).size!==6)throw Error(`Duplicate frames: ${job.slug}/${view}`);
    fs.writeFileSync(path.join(dir,view+'.png'),PNG.sync.write(six[0].frame));
    const strip=new PNG({width:96*6,height:96});
    const gif=GIFEncoder();
    six.forEach(({frame,index},i)=>{
      PNG.bitblt(frame,strip,0,0,96,96,i*96,0);
      gif.writeFrame(index,96,96,{palette:palette.map(c=>c.slice(0,3)),transparent:true,transparentIndex,delay:140,repeat:0,dispose:2});
    });gif.finish();
    fs.writeFileSync(path.join(dir,view+'.gif'),gif.bytes());
    fs.writeFileSync(path.join(dir,view+'-strip.png'),PNG.sync.write(strip));
  }
  const c=roster.find(c=>c.name===job.slug), a=manifest.find(a=>a.id===c.id);
  const base='/originals/v1/'+job.slug+'/';
  const assetVersion=hash(Buffer.concat(nativeFrames.map(f=>f.frame.data))).slice(0,16);
  const unchanged=a.assetVersion===assetVersion;
  Object.assign(a,{status:unchanged?a.status:'review',front:base+'front.png',back:base+'back.png',animatedFront:base+'front.gif',animatedBack:base+'back.gif',frameCount:6,frameDelayMs:140,assetVersion,sourceSha256:hash(sourceBytes),visualReview:unchanged?a.visualReview:null});
  report.push({slug:job.slug,id:c.id,scale,sourceSize:[src.width,src.height],sourceSha256:a.sourceSha256,assetVersion:a.assetVersion,frames:12,colors:palette.length});
}
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const reportPath=path.join(sourceDir,'../packaging.json');
const previous=only&&fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)).filter(r=>r.slug!==only):[];
fs.writeFileSync(reportPath,JSON.stringify([...previous,...report],null,2)+'\n');
fs.writeFileSync(path.join(sourceDir,'../prompts.json'),JSON.stringify(require('./'+batch+'.json').map(({slug,prompt})=>({slug,prompt})),null,2)+'\n');
console.log(`Packaged ${report.length} species as 96x96 PNG/GIF assets; pending visual review.`);
