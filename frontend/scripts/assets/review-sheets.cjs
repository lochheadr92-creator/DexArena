const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs');
const jobs=require('./batch-01.json');
const root=path.resolve(__dirname,'../..'),outDir=path.resolve(root,'../docs/original-creatures/batch-01');
const contact=new PNG({width:1152,height:768});
const small=new PNG({width:288,height:192});
function copyScaled(src,dst,dx,dy,scale=2){for(let y=0;y<src.height*scale;y++)for(let x=0;x<src.width*scale;x++){
  const si=(Math.floor(y/scale)*src.width+Math.floor(x/scale))*4,di=((dy+y)*dst.width+dx+x)*4;
  if(src.data[si+3])dst.data.set(src.data.subarray(si,si+4),di);
}}
function background(p){for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4,v=(Math.floor(x/16)+Math.floor(y/16))%2?32:43;p.data.set([v,v+15,v+20,255],i);}}
background(contact);
background(small);
for(let group=0;group<4;group++){
  const sheet=new PNG({width:1152,height:1152});background(sheet);
  jobs.slice(group*3,group*3+3).forEach((j,row)=>['front','back'].forEach((view,k)=>{
    const dir=path.join(root,'public/originals/v1',j.slug);
    copyScaled(PNG.sync.read(fs.readFileSync(path.join(dir,view+'-strip.png'))),sheet,0,(row*2+k)*192);
    const index=group*3+row;
    copyScaled(PNG.sync.read(fs.readFileSync(path.join(dir,view+'.png'))),contact,(index%3)*384+k*192,Math.floor(index/3)*192);
    copyScaled(PNG.sync.read(fs.readFileSync(path.join(dir,view+'.png'))),small,(index%3)*96+k*48,Math.floor(index/3)*48,0.5);
  }));
  fs.writeFileSync(path.join(outDir,`frames-${group+1}.png`),PNG.sync.write(sheet));
}
fs.writeFileSync(path.join(outDir,'contact-sheet.png'),PNG.sync.write(contact));
fs.writeFileSync(path.join(outDir,'contact-sheet-48px.png'),PNG.sync.write(small));
