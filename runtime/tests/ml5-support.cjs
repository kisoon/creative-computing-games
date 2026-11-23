const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const calls = [], events = {}, raf = new Map(), vfc = new Map();
let nextId = 0, copies = 0;
const canvas = () => ({width:300,height:150,getContext:()=>({drawImage:()=>copies++})});
const context = { URL, Request, console,
  location:{href:'https://example.org/app/'},
  document:{currentScript:{src:'https://example.org/runtime/ml5-support.js'},createElement:canvas},
  addEventListener:(name,fn)=>events[name]=fn,
  requestAnimationFrame:fn=>{const id=++nextId;raf.set(id,fn);return id},
  cancelAnimationFrame:id=>raf.delete(id),
};
context.window = context;
context.fetch = async (...args) => calls.push(args);
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../ml5-support.js'),'utf8'), context);
function video(modern=true) {
  const v = {tagName:'VIDEO',readyState:2,videoWidth:640,videoHeight:480,currentTime:0,
    frames:1,srcObject:{active:true},getVideoPlaybackQuality(){return {totalVideoFrames:this.frames}}};
  if (modern) {
    v.requestVideoFrameCallback=fn=>{const id=++nextId;vfc.set(id,fn);return id};
    v.cancelVideoFrameCallback=id=>vfc.delete(id);
  }
  return v;
}
function model(ready=Promise.resolve()) {
  return {ready,starts:0,stops:0,inputs:[],detectStart(input,cb){this.starts++;this.inputs.push(input);this.cb=cb},
    detectStop(){this.stops++},async detect(input){this.inputs.push(input);return [{value:42}]}};
}
function frame(queue) { const list=[...queue.values()];queue.clear();list.forEach(fn=>fn()); }
(async()=>{
  await context.fetch('https://tfhub.dev/mediapipe/tfjs-model/handpose_3d/detector/full/1/model.json?tfjs-format=file');
  assert.equal(String(calls.pop()[0]),'https://example.org/vendor/models/mediapipe/tfjs-model/handpose_3d/detector/full/1/model.json');
  await context.fetch('https://other.example/model.json');
  assert.equal(calls.pop()[0],'https://other.example/model.json');
  let resolve;const pendingModel=model(new Promise(r=>resolve=r));
  const pending=context.Ml5Runtime.start(pendingModel,video(),()=>{});
  pendingModel.detectStop();resolve();await pending;
  assert.equal(pendingModel.starts,0,'cancel during loading must not restart');
  const v=video(), a=model(), b=model(), c=model();
  const countBefore=copies;
  let result;
  await context.Ml5Runtime.start(a,v,r=>result=r);
  await context.Ml5Runtime.start(b,{elt:v},()=>{});
  await context.Ml5Runtime.start(c,v,()=>{});
  assert.equal(copies-countBefore,1,'three models share one frame copy');
  assert.equal(vfc.size,1,'one video callback shared by all models');
  assert.equal(a.inputs[0],b.inputs[0]);
  assert.equal(a.inputs[0].width,640);assert.equal(a.inputs[0].height,480);
  const original=[{keypoints:[{x:21,y:17}]}];a.cb(original);
  assert.equal(result,original,'no landmark transformation or callback substitution');
  frame(vfc);assert.equal(copies-countBefore,1,'unchanged frame is not recopied');
  v.frames++;frame(vfc);assert.equal(copies-countBefore,2);
  assert.deepEqual([a.starts,b.starts,c.starts],[1,1,1],'inference loops never restarted per frame');
  a.detectStop();assert.equal(vfc.size,1,'other models retain their frame supply');
  b.detectStop();c.detectStop();assert.equal(vfc.size,0,'last consumer cancels video callback');
  const d=model();const beforeDetect=copies;
  await context.Ml5Runtime.detect(d,v);await context.Ml5Runtime.detect(d,v);
  assert.equal(copies,beforeDetect,'one-shot inference shares existing current frame');
  v.frames++;await context.Ml5Runtime.detect(d,v);
  assert.equal(copies,beforeDetect+1,'one-shot inference refreshes each new frame');
  v.videoWidth=1280;v.videoHeight=720;await context.Ml5Runtime.detect(d,v);
  assert.equal(d.inputs.at(-1).width,1280);assert.equal(d.inputs.at(-1).height,720);
  const fallback=video(false), e=model();fallback.readyState=0;
  await context.Ml5Runtime.start(e,fallback,()=>{});assert.equal(e.starts,0);
  fallback.readyState=2;frame(raf);assert.equal(e.starts,1);
  const beforeFallback=copies;frame(raf);assert.equal(copies,beforeFallback);
  fallback.frames++;frame(raf);assert.equal(copies,beforeFallback+1);
  fallback.srcObject.active=false;frame(raf);assert.equal(raf.size,0);
  // Browsers without playback-quality counters still follow media time.
  const old=video(false);delete old.getVideoPlaybackQuality;
  const f=model();await context.Ml5Runtime.start(f,old,()=>{});
  const beforeOld=copies;old.currentTime=.1;frame(raf);assert.equal(copies,beforeOld+1);
  events.pagehide();assert.equal(raf.size,0);assert.equal(vfc.size,0);
  const nonvideo=model(), image={tagName:'CANVAS'};
  await context.Ml5Runtime.start(nonvideo,image,()=>{});assert.equal(nonvideo.inputs[0],image);
  events.pagehide();
  console.log('PASS: model URLs, pending cancellation, shared frames, unchanged callbacks/dimensions, new frames, resize, reference-counted stop, video/rAF fallback, inactive camera, pagehide');
})().catch(error=>{console.error(error);process.exitCode=1});
