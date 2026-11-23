/*
 * NINJUTSU LOCAL — p5.js + ml5.js HandPose 1.4.0
 * Based on the official handPose-keypoints sample:
 * https://editor.p5js.org/ml5/sketches/QGH3dwJ1A
 * No webcam frames or hand keypoints are uploaded by this application.
 */

const CW = 960;
const CH = 540;
const TRAIN_KEY = 'ninjutsu-local-training-v1';
const SEALS = [
  ['쥐','子','NE'],['소','丑','USHI'],['호랑이','寅','TORA'],['토끼','卯','U'],
  ['용','辰','TATSU'],['뱀','巳','MI'],['말','午','UMA'],['양','未','HITSUJI'],
  ['원숭이','申','SARU'],['닭','酉','TORI'],['개','戌','INU'],['돼지','亥','I'],
];
const SPELLS = [
  { id:'fire',name:'화둔 · 호화구',kanji:'火',chain:['뱀','말','호랑이'],color:'#ff845e' },
  { id:'water',name:'수둔 · 수룡탄',kanji:'水',chain:['용','뱀','호랑이'],color:'#65d9ff' },
  { id:'lightning',name:'뇌둔 · 치도리',kanji:'雷',chain:['소','토끼','원숭이'],color:'#b4b7ff' },
  { id:'wind',name:'풍둔 · 열풍',kanji:'風',chain:['닭','말','양'],color:'#80edb6' },
  { id:'earth',name:'토둔 · 토류벽',kanji:'土',chain:['개','돼지','소'],color:'#ddb589' },
];
const BONES = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17]
];
const get = id => document.getElementById(id);

let video = null;
let handPose = null;
let hands = [];
let cameraReady = false;
let detecting = false;
let cameraStarting = false;
let modelReady = false;
let callbackCount = 0;
let lastCallback = 0;
let manualDemo = false;
let selectedSeal = '뱀';
let learned = loadTraining();
let training = null;
let lastCandidate = null;
let candidateSince = 0;
let lastAccepted = null;
let lastSeenTime = 0;
let sequence = [];
let resetTimer = null;
let fx = null;
let fxParticles = [];
let watchdog = null;

function loadTraining() {
  try {
    const val = JSON.parse(localStorage.getItem(TRAIN_KEY) || '{}');
    return val && typeof val === 'object' && !Array.isArray(val) ? val : {};
  } catch { return {}; }
}
function saveTraining() {
  try { localStorage.setItem(TRAIN_KEY, JSON.stringify(learned)); }
  catch { get('train-message').textContent = '저장 실패: 브라우저 저장 공간을 확인하세요.'; }
}
function safeText(id, value) { get(id).textContent = value; }

function setup() {
  const canvas = createCanvas(CW, CH);
  canvas.parent('canvas-host');
  pixelDensity(1);
  frameRate(30);
  textFont('sans-serif');
  get('seal-select').innerHTML = SEALS.map(s => `<option value="${s[0]}">${s[0]} / ${s[2]}</option>`).join('');
  get('seal-select').value = selectedSeal;
  get('start-camera').addEventListener('click', startCamera);
  get('demo-mode').addEventListener('click', toggleDemo);
  get('reset-sequence').addEventListener('click', () => resetSequence('수인 조합을 초기화했습니다.'));
  get('seal-select').addEventListener('change', event => { selectedSeal = event.target.value; renderSeals(); });
  get('train').addEventListener('click', beginTraining);
  get('erase-all').addEventListener('click', () => {
    if (!confirm('이 브라우저에 저장된 모든 수인 학습 데이터를 삭제할까요?')) return;
    learned = {};
    saveTraining();
    renderSeals();
    safeText('train-message','수인 학습 데이터를 초기화했습니다.');
  });
  get('seal-grid').addEventListener('click', event => {
    const button = event.target.closest('[data-seal]');
    if (!button) return;
    selectedSeal = button.dataset.seal;
    get('seal-select').value = selectedSeal;
    renderSeals();
    if (manualDemo) submitSeal(selectedSeal);
    else safeText('train-message', `${selectedSeal} 수인을 선택했어요. 카메라에서 양손을 인식한 뒤 학습하세요.`);
  });
  get('spell-list').addEventListener('click', event => {
    const button = event.target.closest('[data-spell]');
    if (!button) return;
    const spell = SPELLS.find(s => s.id === button.dataset.spell);
    if (spell) castSpell(spell);
  });
  renderSeals();
  renderSpells();
  renderSequence();
  watchdog = setInterval(updateHealth, 1100);
}

async function startCamera() {
  if (cameraStarting) return;
  if (cameraReady) stopCamera();
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    safeText('health-hint','웹캠 사용을 위해 http://localhost:8000 또는 HTTPS 주소로 접속하세요.');
    return;
  }
  if (typeof ml5 === 'undefined') {
    safeText('model-status','라이브러리 로딩 실패');
    safeText('health-hint','ml5.js 스크립트를 불러오지 못했어요. 인터넷 연결과 브라우저 콘솔(F12)을 확인하세요.');
    return;
  }
  cameraStarting = true;
  safeText('camera-status','연결 중');
  safeText('model-status','LOADING');
  safeText('health-hint','모델을 불러오는 중입니다. 처음에는 외부 모델 파일 다운로드로 시간이 걸릴 수 있습니다.');
  get('start-camera').disabled = true;
  try {
    if (!modelReady) {
      // p5.js + ml5.js official setup: load HandPose, then capture VIDEO.
      if (typeof ml5.setBackend === 'function') await ml5.setBackend('webgl');
      if (typeof ml5.tf?.ready === 'function') await ml5.tf.ready();
      handPose = await ml5.handPose({maxHands:2,modelType:'full'});
      modelReady = true;
    }
    safeText('model-status','READY');
    safeText('camera-status','권한 대기');
    // IMPORTANT: pass the original p5.MediaElement to HandPose, not the raw HTML video.
    video = createCapture(VIDEO, onCameraReady);
    video.size(CW,CH);
    video.hide();
    video.elt.addEventListener('loadeddata', onCameraReady);
    video.elt.addEventListener('error', event => {
      safeText('health-hint','카메라 프레임 오류가 발생했습니다. 브라우저 카메라 권한을 확인하세요.');
      console.warn('[NINJUTSU] video error',event);
    });
    // Permission can stay pending; show an actionable message rather than a false READY state.
    setTimeout(() => {
      if (!cameraReady && video) safeText('health-hint','카메라 연결 대기 중입니다. 주소창 왼쪽 카메라 권한을 허용했는지 확인하세요.');
    },9000);
  } catch (error) {
    console.error('[NINJUTSU] HandPose startup error',error);
    safeText('model-status','ERROR');
    safeText('health-hint',`HandPose 오류: ${String(error?.message || error).slice(0,170)}`);
  } finally {
    cameraStarting = false;
    get('start-camera').disabled = false;
    get('start-camera').textContent = '↻ 카메라 다시 연결';
  }
}

function onCameraReady() {
  if (!video || detecting || !handPose || video.elt.readyState < 2) return;
  cameraReady = true;
  detecting = true;
  safeText('camera-status','CONNECTED');
  safeText('camera-caption','CAMERA CONNECTED');
  get('camera-led').classList.add('active');
  get('diagnostic-indicator').classList.add('active');
  safeText('diagnostic-indicator','TRACKING');
  safeText('health-hint','손바닥 하나를 펼쳐 보여주세요. 초록 점 21개가 보이면 ml5 손 추적 성공입니다.');
  get('train').disabled = false;
  try {
    handPose.detectStart(video, gotHands);
  } catch(error) {
    console.error('[NINJUTSU] detectStart error',error);
    safeText('model-status','DETECT ERROR');
    safeText('health-hint',String(error?.message || error));
  }
}

function stopCamera() {
  try { handPose?.detectStop?.(); } catch {}
  detecting = false;
  cameraReady = false;
  hands = [];
  callbackCount = 0;
  if (video) {
    const stream = video.elt?.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    video.remove();
    video = null;
  }
  get('camera-led').classList.remove('active');
  safeText('camera-status','대기');
  safeText('hands-status','0 / 2');
  get('train').disabled = true;
}

function gotHands(results) {
  callbackCount++;
  lastCallback = millis();
  const raw = Array.isArray(results) ? results : [];
  hands = raw.filter(h => Array.isArray(h.keypoints) && h.keypoints.length >= 21);
  safeText('callback-status',String(callbackCount));
  safeText('hands-status',`${hands.length} / 2`);
  safeText('frame-count',`${hands.length} HAND${hands.length === 1 ? '' : 'S'}`);
  if (raw.length > 0 && !hands.length) {
    safeText('health-hint','손 검출 결과는 왔지만 keypoints[21] 형식이 아닙니다. F12 콘솔을 확인하세요.');
    if (callbackCount < 3) console.warn('Unexpected HandPose result keys:',Object.keys(raw[0] || {}));
  } else if (hands.length) {
    safeText('health-hint',`손 ${hands.length}개 감지 성공! 관절이 따라오는지 확인한 뒤, 양손 수인을 학습하세요.`);
  }
  if (training) collectTrainingSample();
  else recognizeSeal();
}

function updateHealth() {
  if (!detecting) return;
  if (!callbackCount && cameraReady) {
    safeText('health-hint','카메라는 연결됐지만 AI 콜백이 없습니다. F12 콘솔에서 모델 오류를 확인하고 카메라 다시 연결을 눌러주세요.');
  } else if (callbackCount && millis() - lastCallback > 5000) {
    safeText('health-hint','AI 추적 콜백이 5초 이상 멈췄습니다. 카메라 다시 연결을 시도하세요.');
  } else if (callbackCount && !hands.length) {
    safeText('health-hint','AI는 영상을 분석하고 있으나 손이 검출되지 않아요. 밝은 곳에서 손바닥 하나를 펼쳐 천천히 보여주세요.');
  }
}

function draw() {
  background(8,19,31);
  if (cameraReady && video && video.elt?.readyState >= 2) {
    // No mirroring or object-fit crop: coordinates remain aligned to the official example.
    image(video,0,0,width,height);
    noStroke();fill(4,14,26,45);rect(0,0,width,height);
    drawTrackedHands();
  } else {
    drawStandby();
  }
  drawVisualEffects();
}

function drawStandby() {
  push();translate(width/2,height/2);noFill();
  for (let i=0;i<3;i++) { stroke(92,190,217,30+i*9);strokeWeight(1);circle(0,0,210+i*66); }
  stroke(241,148,116,110);arc(0,0,240,240,frameCount*.006,frameCount*.006+PI*.48);
  noStroke();fill(201,228,240,160);textAlign(CENTER,CENTER);textSize(75);text('印',0,-25);
  fill(154,183,198,190);textSize(17);text('CAMERA OFFLINE',0,70);pop();
}

function drawTrackedHands() {
  for (const hand of hands) {
    const points = hand.keypoints;
    push();stroke(67,225,255);strokeWeight(3);
    for (const [a,b] of BONES) {
      if (points[a] && points[b]) line(points[a].x,points[a].y,points[b].x,points[b].y);
    }
    noStroke();
    for (const point of points) {
      fill(59,255,173);circle(point.x,point.y,9);
      fill(230,255,246);circle(point.x,point.y,3);
    }
    pop();
  }
}

function gestureFeatures(sourceHands) {
  if (sourceHands.length !== 2) return null;
  const ordered = [...sourceHands].sort((a,b)=>a.keypoints[0].x-b.keypoints[0].x);
  const points = ordered.flatMap(h=>h.keypoints.slice(0,21));
  if (!points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))) return null;
  const xs = points.map(p=>p.x),ys=points.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.max(maxX-minX,maxY-minY,30),centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
  return points.flatMap(p=>[(p.x-centerX)/scale,(p.y-centerY)/scale]);
}
function featureDistance(a,b) {
  if (!Array.isArray(a)||!Array.isArray(b)||a.length!==84||b.length!==84) return Infinity;
  let d=0;for(let i=0;i<84;i++)d+=(a[i]-b[i])**2;
  return Math.sqrt(d/84);
}
function beginTraining() {
  if (!cameraReady || hands.length !== 2) {
    safeText('train-message','학습하려면 우선 양손이 2 / 2로 인식되어야 합니다.');
    return;
  }
  if (training) return;
  training={label:selectedSeal,samples:[],lastSample:0};
  get('train').disabled=true;
  safeText('train-message',`${selectedSeal} 자세를 2초 정도 유지하세요. 손 위치를 조금씩 움직여도 좋아요.`);
}
function collectTrainingSample() {
  if (!training) return;
  const now=millis();
  if (now-training.lastSample<75) return;
  const features=gestureFeatures(hands);
  if (!features) { safeText('train-message','양손이 모두 보여야 합니다.');return; }
  training.samples.push(features);training.lastSample=now;
  get('train-progress').style.width=`${Math.min(100,training.samples.length/24*100)}%`;
  safeText('train-message',`${training.label} 데이터 ${training.samples.length} / 24 프레임 수집 중...`);
  if (training.samples.length<24) return;
  const label=training.label;
  learned[label]=[...(learned[label]||[]),...training.samples].slice(-96);
  saveTraining();training=null;
  get('train').disabled=false;
  safeText('train-message',`${label} 수인 학습 완료! 다른 수인도 학습해 보세요.`);
  renderSeals();
}

function recognizeSeal() {
  if (hands.length!==2) {lastCandidate=null;if(millis()-lastSeenTime>500)lastAccepted=null;return;}
  const features=gestureFeatures(hands);
  if(!features) return;
  const distances=[];
  for(const [name] of SEALS) {
    const samples=(learned[name]||[]).filter(s=>Array.isArray(s)&&s.length===84);
    if(samples.length<12)continue;
    const nearest=samples.map(s=>featureDistance(features,s)).sort((a,b)=>a-b).slice(0,5);
    distances.push({name,d:nearest.reduce((a,b)=>a+b,0)/nearest.length});
  }
  distances.sort((a,b)=>a.d-b.d);
  if(!distances.length||distances[0].d>.16||(distances.length>1&&distances[1].d-distances[0].d<.008)) {
    lastCandidate=null;return;
  }
  const choice=distances[0].name,now=millis();lastSeenTime=now;
  if(lastCandidate!==choice){lastCandidate=choice;candidateSince=now;}
  if(now-candidateSince>650&&lastAccepted!==choice){lastAccepted=choice;submitSeal(choice);}
}

function toggleDemo() {
  manualDemo=!manualDemo;
  get('demo-mode').textContent=manualDemo?'■ 데모 모드 종료':'▶ 데모 모드';
  get('demo-mode').style.borderColor=manualDemo?'#ff987a':'#3c5666';
  safeText('sequence-message',manualDemo?'아래 수인 버튼을 눌러 조합을 입력하세요.':'실제 손동작을 입력하려면 카메라에서 수인을 학습하세요.');
}
function renderSeals() {
  get('seal-grid').innerHTML=SEALS.map((s,i)=>`<button type="button" class="seal-btn ${selectedSeal===s[0]?'selected':''}" data-seal="${s[0]}"><span class="no">${String(i+1).padStart(2,'0')} / SEAL</span><span class="kanji">${s[1]}</span><strong>${s[0]}</strong><small>${s[2]}</small>${learned[s[0]]?.length>=12?'<i class="trained-dot" title="학습 완료"></i>':''}</button>`).join('');
}
function renderSpells() {
  get('spell-list').innerHTML=SPELLS.map(s=>`<button type="button" class="spell" data-spell="${s.id}"><span class="icon" style="color:${s.color}">${s.kanji}</span><span class="labels"><strong>${s.name}</strong><small>${s.chain.join(' → ')} / 이펙트 미리보기</small></span></button>`).join('');
}
function renderSequence() {
  get('sequence-output').innerHTML=sequence.length?sequence.map((s,i)=>`${i?'<span>→</span>':''}<span class="seal-token">${s}</span>`).join(''):'아직 입력된 수인이 없습니다.';
}
function resetSequence(message) {
  clearTimeout(resetTimer);sequence=[];renderSequence();
  if(message)safeText('sequence-message',message);
}
function submitSeal(label) {
  clearTimeout(resetTimer);sequence.push(label);
  if(sequence.length>3)sequence=[label];
  renderSequence();
  const spell=SPELLS.find(s=>s.chain.length===sequence.length&&s.chain.every((entry,i)=>entry===sequence[i]));
  if(spell){castSpell(spell);resetTimer=setTimeout(()=>resetSequence('다음 인술을 입력할 수 있습니다.'),1600);return;}
  const possible=SPELLS.some(s=>sequence.every((entry,i)=>entry===s.chain[i]));
  safeText('sequence-message',possible?`${label} 인식 성공 · 다음 수인을 입력하세요.`:'등록되지 않은 조합입니다. 1초 후 초기화합니다.');
  resetTimer=setTimeout(()=>resetSequence('새 수인 조합을 시작하세요.'),possible?9000:1100);
}

function castSpell(spell) {
  fx={spell,start:millis(),duration:3800};fxParticles=[];
  safeText('sequence-message',`${spell.name} 발동!`);
  playEffectSound(spell.id);
}
function playEffectSound(id) {
  try{
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    if(!window.ninjutsuAudio)window.ninjutsuAudio=new Audio();
    const audio=window.ninjutsuAudio;
    if(audio.state==='suspended')audio.resume();
    const oscillator=audio.createOscillator(),volume=audio.createGain();
    oscillator.type=id==='lightning'?'square':'sawtooth';
    oscillator.frequency.setValueAtTime(id==='earth'?80:280,audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(id==='lightning'?800:80,audio.currentTime+.6);
    volume.gain.setValueAtTime(.04,audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.62);
    oscillator.connect(volume).connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.65);
  }catch{/* muted or unsupported audio is noncritical */}
}

function drawVisualEffects() {
  if(!fx)return;
  const elapsed=millis()-fx.start;
  if(elapsed>=fx.duration){fx=null;fxParticles=[];return;}
  const {spell}=fx;
  const origin=hands.length&&cameraReady?{
    x:hands.reduce((sum,h)=>sum+(h.keypoints[8]?.x||CW/2),0)/hands.length,
    y:hands.reduce((sum,h)=>sum+(h.keypoints[8]?.y||CH/2),0)/hands.length
  }:{x:width/2,y:height/2};
  push();blendMode(ADD);noStroke();
  const RGB={fire:[255,115,49],water:[58,202,255],lightning:[160,178,255],wind:[110,240,172],earth:[217,158,100]}[spell.id];
  const glow=95+20*Math.sin(frameCount*.15);
  for(let i=5;i>0;i--){fill(...RGB,5+i*2);circle(origin.x,origin.y,glow+i*34);}
  for(let j=0;j<6&&fxParticles.length<220;j++){
    const a=random(TWO_PI),speed=random(1,8);
    fxParticles.push({x:origin.x,y:spell.id==='earth'?height:origin.y,vx:cos(a)*speed,vy:spell.id==='earth'?random(-11,-4):sin(a)*speed-(spell.id==='fire'?3:0),age:0,life:random(25,85),r:random(2,spell.id==='earth'?17:7)});
  }
  for(const p of fxParticles){
    p.age++;p.x+=p.vx;p.y+=p.vy;
    if(spell.id==='fire')p.vy-=.055;
    if(spell.id==='earth')p.vy+=.12;
    fill(...RGB,Math.max(0,230*(1-p.age/p.life)));
    if(spell.id==='earth'){rect(p.x,p.y,p.r*1.5,p.r*1.5);}else circle(p.x,p.y,p.r*2);
  }
  fxParticles=fxParticles.filter(p=>p.age<p.life);
  if(spell.id==='lightning'){
    stroke(188,225,255,210);strokeWeight(3);noFill();
    for(let bolt=0;bolt<7;bolt++){
      beginShape();vertex(origin.x,origin.y);
      const a=bolt*TWO_PI/7+frameCount*.035;
      for(let n=1;n<=7;n++)vertex(origin.x+cos(a)*n*27+random(-19,19),origin.y+sin(a)*n*27+random(-19,19));
      endShape();
    }
  }
  if(spell.id==='water'||spell.id==='wind'){
    noFill();stroke(...RGB,125);strokeWeight(3);
    for(let k=0;k<4;k++)arc(origin.x,origin.y,100+k*56,100+k*28,frameCount*.025+k,frameCount*.025+k+PI*1.3);
  }
  blendMode(BLEND);
  textAlign(CENTER,CENTER);textSize(38);textStyle(BOLD);
  fill(0,0,0,180);text(spell.name,origin.x+3,origin.y-113+3);
  fill(...RGB);text(spell.name,origin.x,origin.y-113);
  pop();
}
