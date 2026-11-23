let video; let canvas, ctx; let foods = []; let currentFood = -1; let biteCount = 0; let started = false; let finished = false; let foodImg = null;

function preloadFoods(){
  foods = [
    {name:'멜론', path:'assets/한정선 멜론.png'},
    {name:'통귤', path:'assets/한정선_통귤.png'},
    {name:'파인애플', path:'assets/한정선_파인애플.png'},
    {name:'하미과멜론', path:'assets/한정선_하미과멜론.png'}
  ];
}

function loadFoodImage(index){ foodImg = new Image(); foodImg.onload = ()=>{ drawStage(); }; foodImg.src = foods[index].path; }

function setup(){
  canvas = document.getElementById('stage'); ctx = canvas.getContext('2d');
  preloadFoods();
  document.querySelectorAll('.card').forEach((card, idx)=>{ card.addEventListener('click', ()=>{ currentFood = idx; biteCount = 0; finished = false; started = false; document.getElementById('bite').textContent = '(0/3)'; loadFoodImage(currentFood); drawStage(); }); });
  document.getElementById('start').addEventListener('click', ()=>{ if(currentFood>=0){ started = true; finished=false; biteCount=0; document.getElementById('bite').textContent='(0/3)'; drawStage(); startCamera(); } });
  document.getElementById('reset').addEventListener('click', ()=>{ started=false; finished=false; biteCount=0; currentFood=-1; foodImg=null; document.getElementById('bite').textContent='(0/3)'; drawStage(); if(video && video.srcObject){ video.srcObject.getTracks().forEach(t=>t.stop()); } });
  // camera
  video = document.createElement('video'); video.autoplay = true; video.muted = true; video.playsInline = true;
  navigator.mediaDevices.getUserMedia({ video: true }).then((stream)=>{ video.srcObject = stream; video.play(); }).catch(()=>{});
  // bite on stage click
  canvas.addEventListener('click', ()=>{ if(started && !finished && currentFood>=0){ biteCount = Math.min(3, biteCount+1); document.getElementById('bite').textContent = "("+biteCount+"/3)"; if(biteCount>=3){ finished = true; setTimeout(()=>{ started=false; currentFood=-1; foodImg=null; biteCount=0; document.getElementById('bite').textContent='(0/3)'; drawStage(); }, 600); } } });
  requestAnimationFrame(loop);
}

function startCamera(){ /* already started in setup */ }

function drawStage(){
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  if(video && video.readyState >= 2){ ctx.drawImage(video, 0, 0, w, h); }
  // food image
  if(foodImg && currentFood>=0 && biteCount<3){ const scales=[1.0,0.88,0.75,0.0]; const s = scales[Math.min(biteCount,3)]; if(s>0){ const fw = foodImg.width * s * (canvas.width/640); const fh = foodImg.height * s * (canvas.height/480); const x = (w - fw)/2; const y = h*0.6 - fh/2; ctx.drawImage(foodImg, x, y, fw, fh); } }
  if(started && currentFood>=0 && biteCount<3){ ctx.fillStyle='white'; ctx.font='14px Arial'; ctx.fillText('bite: '+biteCount+' / 3', 10,20); }
  if(!started && currentFood<0){ ctx.fillStyle='white'; ctx.font='16px Arial'; ctx.fillText('카드를 선택하고 Start를 누르면 체험이 시작됩니다', w/2-240, 40); }
}

function loop(){ drawStage(); requestAnimationFrame(loop); }

setup();
