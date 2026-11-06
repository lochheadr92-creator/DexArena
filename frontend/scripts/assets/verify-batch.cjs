const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const {PNG}=require('pngjs');
const {parseGIF,decompressFrames}=require('gifuct-js');
const root=path.resolve(__dirname,'../..');
const batch=process.argv.includes('--production')?'batch-02':'batch-01';
const jobs=require('./'+batch+'.json').filter(j=>!process.argv.includes('--available') || fs.existsSync(path.join(root,'public/originals/v1',j.slug,'back.gif')));
const manifest=require('../../../docs/original-creatures/designs/assets.json');
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const rows=[];
assert.equal(jobs.length,process.argv.includes('--available')?jobs.length:batch==='batch-01'?12:138);
for(const job of jobs){
  const a=manifest.find(a=>a.slug===job.slug);
  assert.ok(a.assetVersion && a.sourceSha256);
  const hashes=[];
  for(const view of ['front','back']){
    const bytes=fs.readFileSync(path.join(root,'public',a[view==='front'?'animatedFront':'animatedBack']));
    const gif=parseGIF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const frames=decompressFrames(gif,true);
    const png=PNG.sync.read(fs.readFileSync(path.join(root,'public',a[view])));
    assert.equal(gif.lsd.width,96);assert.equal(gif.lsd.height,96);
    assert.equal(frames.length,6);assert.ok(bytes.includes(Buffer.from('NETSCAPE2.0')));
    const unique=new Set(),shapes=new Set(),bounds=[];
    frames.forEach((f,i)=>{
      assert.equal(f.delay,140);assert.equal(f.disposalType,2);
      assert.deepEqual(f.dims,{top:0,left:0,width:96,height:96});
      const p=f.patch, colors=new Set();let left=96,right=0,top=96,bottom=0,opaque=0;
      for(let y=0;y<96;y++)for(let x=0;x<96;x++){
        const k=(y*96+x)*4;
        assert.ok(p[k+3]===0||p[k+3]===255);
        if(p[k+3]){opaque++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);colors.add([p[k],p[k+1],p[k+2]].join(','));}
        if(i===0){assert.equal(p[k+3],png.data[k+3]);if(p[k+3])assert.deepEqual(Array.from(p.slice(k,k+3)),Array.from(png.data.slice(k,k+3)));}
      }
      assert.ok(left>=4&&right<=91&&top>=4&&bottom<=91,`${job.slug}/${view}/${i}: clipped`);
      assert.equal(bottom,86,`${job.slug}/${view}/${i}: ground anchor`);
      assert.ok(opaque>100&&opaque<6000,`${job.slug}/${view}/${i}: invalid silhouette`);
      assert.ok(colors.size<=24);
      const crop=[];for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)crop.push(...p.slice((y*96+x)*4,(y*96+x+1)*4));
      shapes.add(sha(Buffer.from(crop)));unique.add(sha(p));bounds.push({left,right,top,bottom,opaque,colors:colors.size});
    });
    assert.equal(unique.size,6,`${job.slug}/${view}: repeated frame`);
    assert.equal(shapes.size,6,`${job.slug}/${view}: translated duplicate`);
    hashes.push(sha(frames[0].patch));
    rows.push({species:job.slug,view,frames:6,uniqueDrawings:6,loopMs:840,sha256:sha(bytes),bounds});
  }
  assert.notEqual(hashes[0],hashes[1],`${job.slug}: reused front as back`);
}
fs.writeFileSync(path.resolve(root,'../docs/original-creatures',batch,'asset-verification.json'),JSON.stringify({scope:batch+' structural checks; visual review is separate',species:jobs.length,animations:jobs.length*2,frames:jobs.length*12,rows},null,2)+'\n');
console.log(`PASS: ${jobs.length} species, ${jobs.length*2} GIFs, ${jobs.length*12} distinct drawings; 96x96, transparent margins, baseline 86, <=24 colours, 140ms, looping; static PNGs match first GIF frames.`);
