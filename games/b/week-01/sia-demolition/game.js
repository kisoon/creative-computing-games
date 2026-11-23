/* global THREE */
/*
 * 서울예대 철거 작전 / SIA DEMOLITION
 * 하늘에서 떨어지는 서울예술대학교를 기관총으로 부순다.
 * 맞을수록 금이 가고, 60% 파괴되면 붕괴한다.
 * 착지 전에 SPACE(반발 장치)로 건물을 위로 튕겨 시간을 번다.
 */
(() => {
  'use strict';

  // ------------------------------------------------------------------ config
  const CFG = {
    cols: 6,
    floors: 9,
    bw: 1.9,
    bh: 1.55,
    bd: 1.9,
    groundY: 0.16,
    gravity: 3.4,
    startBase: 17,
    fallDelay: 1.0,
    bounceV: 7.2,
    maxCharges: 3,
    chargeTime: 5.0,
    goal: 0.6,
    blockHp: 28,
    damage: 7,
    fireInterval: 0.095,
    signHp: 56,
  };

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);

  // ------------------------------------------------------------------ dom
  const $ = (id) => document.getElementById(id);
  const dom = {
    canvas: $('scene'),
    hud: $('hud'),
    startScreen: $('startScreen'),
    resultScreen: $('resultScreen'),
    startBtn: $('startBtn'),
    restartBtn: $('restartBtn'),
    score: $('score'),
    intFill: $('intFill'),
    intPct: $('intPct'),
    combo: $('combo'),
    danger: $('danger'),
    pips: $('pips'),
    rechargeFill: $('rechargeFill'),
    bounceUI: $('bounceUI'),
    crosshair: $('crosshair'),
    popups: $('popups'),
    flash: $('flash'),
    resultTitle: $('resultTitle'),
    resultDesc: $('resultDesc'),
    resultEyebrow: $('resultEyebrow'),
    finalScore: $('finalScore'),
    finalPct: $('finalPct'),
    finalTime: $('finalTime'),
  };

  // ------------------------------------------------------------------ state
  const state = {
    phase: 'title', // title | playing | collapsing | lost | over
    score: 0,
    destroyed: 0,
    total: 1,
    combo: 0,
    comboTimer: 0,
    fallVy: 0,
    fallDelay: CFG.fallDelay,
    charges: CFG.maxCharges,
    chargeProgress: 0,
    fireTimer: 0,
    shooting: false,
    timeScale: 1,
    targetTimeScale: 1,
    shake: 0,
    playTime: 0,
    endTimer: 0,
    dangerOn: false,
    win: false,
    muted: false,
    hurtPulse: 0,
    comboFlash: 0,
  };

  // ------------------------------------------------------------------ three globals
  let renderer, scene, camera, clock;
  let buildingGroup = null;
  let blocks = [];
  let targets = [];
  let signObj = null;
  let signGroup = null;
  let signPulse = 0;
  let debris = [];
  let dustPool = [];
  let shockwaves = [];
  let tracers = [];
  let gunPivot = null;
  let gunBody = null;
  let muzzleFlash = null;
  let muzzleLight = null;
  let padRing = null;
  let padGlow = null;
  let blockGeo = null;
  let assets = null;
  let sparkSys = null;
  let tracerCursor = 0;
  let popupCount = 0;

  const mouseNDC = new THREE.Vector2(0, 0);
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const raycaster = new THREE.Raycaster();
  const aimPoint = new THREE.Vector3(0, 20, 0);
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 };

  // ------------------------------------------------------------------ boot
  function init() {
    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a2233, 80, 210);

    camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 400);
    camera.position.set(7, 22, 55);
    camera.lookAt(0, 17, 0);

    clock = new THREE.Clock();

    buildSky();
    buildLights();
    buildEnvironment();
    createAssets();
    buildGun();
    initSparks();
    initDust();
    initTracers();
    buildPips();
    bindEvents();

    buildBuilding();
    updateHUD(true);
    dom.crosshair.style.left = pointer.x + 'px';
    dom.crosshair.style.top = pointer.y + 'px';
    animate();
  }

  // ------------------------------------------------------------------ sky
  function buildSky() {
    const geo = new THREE.SphereGeometry(240, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x050a16) },
        midColor: { value: new THREE.Color(0x14203a) },
        horizonColor: { value: new THREE.Color(0xc17a5c) },
        bottomColor: { value: new THREE.Color(0x1a2030) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vDir).y;
          vec3 col = mix(bottomColor, horizonColor, smoothstep(-0.30, 0.015, h));
          col = mix(col, midColor, smoothstep(0.0, 0.30, h));
          col = mix(col, topColor, smoothstep(0.24, 0.8, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    scene.add(sky);

    // 태양 그을림
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255, 226, 186, 1)');
    g.addColorStop(0.18, 'rgba(255, 174, 116, 0.55)');
    g.addColorStop(0.5, 'rgba(230, 120, 84, 0.12)');
    g.addColorStop(1, 'rgba(230, 120, 84, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    sun.scale.set(120, 120, 1);
    sun.position.set(-95, 26, -160);
    scene.add(sun);
  }

  // ------------------------------------------------------------------ lights
  function buildLights() {
    const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x2a2233, 1.55);
    scene.add(hemi);

    const amb = new THREE.AmbientLight(0x94a5cf, 0.4);
    scene.add(amb);

    const sun = new THREE.DirectionalLight(0xffc79a, 3.0);
    sun.position.set(28, 48, 32);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x5d82ff, 0.85);
    rim.position.set(-34, 20, -24);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x9fbcff, 1.15);
    fill.position.set(-18, 14, 46);
    scene.add(fill);
  }

  // ------------------------------------------------------------------ environment
  function buildEnvironment() {
    // 지면
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x242e42,
      roughness: 0.98,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(240, 96, 0x38465f, 0x222c40);
    grid.position.y = 0.03;
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    scene.add(grid);

    // 광장
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(19, 19.6, 0.16, 64),
      new THREE.MeshStandardMaterial({
        color: 0x2b354b,
        roughness: 0.9,
        metalness: 0.08,
      })
    );
    plaza.position.y = CFG.groundY * 0.5;
    plaza.receiveShadow = true;
    scene.add(plaza);

    for (const r of [11.5, 14.2, 18.2]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(r, r + 0.08, 96),
        new THREE.MeshBasicMaterial({
          color: 0x6f86ad,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = CFG.groundY + 0.012;
      scene.add(ring);
    }

    // 반발 장치 패드
    const pad = new THREE.Group();
    const padDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(5.0, 5.25, 0.12, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1d2740,
        roughness: 0.55,
        metalness: 0.5,
        emissive: 0x57210f,
        emissiveIntensity: 0.6,
      })
    );
    padDisc.position.y = CFG.groundY + 0.06;
    padDisc.receiveShadow = true;
    pad.add(padDisc);

    padRing = new THREE.Mesh(
      new THREE.RingGeometry(4.55, 4.95, 72),
      new THREE.MeshBasicMaterial({
        color: 0xff6a45,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    padRing.rotation.x = -Math.PI / 2;
    padRing.position.y = CFG.groundY + 0.14;
    pad.add(padRing);

    const glowTex = radialTexture('rgba(255,120,70,0.5)', 128);
    padGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 18),
      new THREE.MeshBasicMaterial({
        map: glowTex,
        color: 0xff7a50,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    padGlow.rotation.x = -Math.PI / 2;
    padGlow.position.y = CFG.groundY + 0.05;
    scene.add(padGlow);

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const bolt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.22, 0.55, 6),
        new THREE.MeshStandardMaterial({
          color: 0x3a4660,
          roughness: 0.45,
          metalness: 0.6,
          emissive: 0x2a0d05,
          emissiveIntensity: 0.7,
        })
      );
      bolt.position.set(Math.cos(a) * 4.75, CFG.groundY + 0.22, Math.sin(a) * 4.75);
      pad.add(bolt);
    }
    scene.add(pad);

    // 도시 실루엣
    const r = mulberry32(20261113);
    const cityMats = [
      new THREE.MeshStandardMaterial({ color: 0x131b2b, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x172134, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x1c2740, roughness: 1, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x101725, roughness: 1, flatShading: true }),
    ];
    for (let i = 0; i < 44; i++) {
      const side = r() < 0.5 ? -1 : 1;
      const x = side * (22 + r() * 110);
      const z = -22 - r() * 90;
      const w = 3 + r() * 8;
      const d = 3 + r() * 8;
      const h = 3 + r() * 24;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cityMats[(r() * 4) | 0]);
      b.position.set(x, h / 2 - 0.1, z);
      b.rotation.y = r() * 0.7;
      scene.add(b);
    }

    // 조명 기둥
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a3346, roughness: 0.5, metalness: 0.5 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a3 });
    for (const [x, z] of [[-15, -8], [15, -8], [-24, 4], [24, 4], [-9, -20], [9, -20]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 5.4, 6), poleMat);
      pole.position.set(x, 2.7, z);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), lampMat);
      lamp.position.set(x, 5.42, z);
      scene.add(lamp);
    }
  }

  // ------------------------------------------------------------------ canvas helpers
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvasTexture(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function radialTexture(color, size) {
    const c = makeCanvas(size, size);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // ------------------------------------------------------------------ assets
  function createAssets() {
    assets = {
      variants: [],
      signMap: null,
      signEmissive: null,
      holeTex: null,
      sparkTex: null,
      dustTex: null,
    };

    const defs = [
      { kind: 'concrete', tint: '#c9c1b1', seed: 101 },
      { kind: 'concrete', tint: '#b5b7ba', seed: 217 },
      { kind: 'concrete', tint: '#d8cebc', seed: 333 },
      { kind: 'concrete', tint: '#a3a8b2', seed: 449 },
      { kind: 'glass', tint: '#637d8a', seed: 561 },
      { kind: 'glass', tint: '#72879d', seed: 673 },
      { kind: 'glass', tint: '#5a6f7e', seed: 787 },
      { kind: 'banner', tint: '#c4b7a2', seed: 899 },
    ];
    for (const d of defs) assets.variants.push(makeFacadeAsset(d));

    // 총알 구멍
    const hc = makeCanvas(96, 96);
    const hx = hc.getContext('2d');
    const hg = hx.createRadialGradient(48, 48, 1, 48, 48, 16);
    hg.addColorStop(0, 'rgba(8,7,9,0.95)');
    hg.addColorStop(0.45, 'rgba(20,17,19,0.8)');
    hg.addColorStop(1, 'rgba(30,24,24,0)');
    hx.fillStyle = hg;
    hx.beginPath();
    hx.arc(48, 48, 15, 0, TAU);
    hx.fill();
    hx.strokeStyle = 'rgba(12,10,12,0.65)';
    hx.lineCap = 'round';
    const hr = mulberry32(9901);
    for (let i = 0; i < 8; i++) {
      const a = hr() * TAU;
      const len = 6 + hr() * 22;
      hx.beginPath();
      hx.moveTo(48 + Math.cos(a) * 5, 48 + Math.sin(a) * 5);
      let px = 48 + Math.cos(a) * 5;
      let py = 48 + Math.sin(a) * 5;
      const segs = 2 + ((hr() * 2) | 0);
      for (let k = 0; k < segs; k++) {
        const aa = a + (hr() - 0.5) * 0.8;
        px += Math.cos(aa) * (len / segs);
        py += Math.sin(aa) * (len / segs);
        hx.lineTo(px, py);
      }
      hx.lineWidth = 0.8 + hr() * 1.4;
      hx.stroke();
    }
    hx.fillStyle = 'rgba(255,255,255,0.15)';
    hx.beginPath();
    hx.arc(44, 44, 7, 0, TAU);
    hx.fill();
    assets.holeTex = canvasTexture(hc);

    // 스파크
    assets.sparkTex = radialTexture('rgba(255,240,210,1)', 64);

    // 연기
    const dc = makeCanvas(96, 96);
    const dx = dc.getContext('2d');
    const dg = dx.createRadialGradient(48, 48, 4, 48, 48, 46);
    dg.addColorStop(0, 'rgba(196,198,206,0.62)');
    dg.addColorStop(0.55, 'rgba(150,154,168,0.25)');
    dg.addColorStop(1, 'rgba(120,124,140,0)');
    dx.fillStyle = dg;
    dx.fillRect(0, 0, 96, 96);
    assets.dustTex = new THREE.CanvasTexture(dc);
    assets.dustTex.colorSpace = THREE.SRGBColorSpace;

    const sign = makeSignTexture();
    assets.signMap = sign.map;
    assets.signEmissive = sign.emissive;

    blockGeo = new THREE.BoxGeometry(CFG.bw - 0.02, CFG.bh - 0.02, CFG.bd);
  }

  function makeFacadeAsset(def) {
    const W = 256;
    const H = 208;
    const base = makeCanvas(W, H);
    const ctx = base.getContext('2d');
    const light = makeCanvas(W, H);
    const lctx = light.getContext('2d');
    const r = mulberry32(def.seed);
    lctx.fillStyle = '#000';
    lctx.fillRect(0, 0, W, H);

    // 벽체
    ctx.fillStyle = def.tint;
    ctx.fillRect(0, 0, W, H);
    const wallGrad = ctx.createLinearGradient(0, 0, W, H);
    wallGrad.addColorStop(0, 'rgba(255,255,255,0.10)');
    wallGrad.addColorStop(0.55, 'rgba(255,255,255,0)');
    wallGrad.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H);

    // 콘크리트 노이즈
    for (let i = 0; i < 760; i++) {
      const a = r() * 0.055;
      ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
      ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
    }

    // 슬래브 라인
    ctx.fillStyle = 'rgba(24,24,28,0.34)';
    ctx.fillRect(0, 0, W, 7);
    ctx.fillRect(0, H - 7, W, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, 7, W, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, H - 9, W, 2);
    ctx.fillStyle = 'rgba(20,20,24,0.23)';
    ctx.fillRect(0, 0, 4, H);
    ctx.fillRect(W - 4, 0, 4, H);

    if (def.kind === 'glass') {
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const x = 24 + col * 72;
          const y = 27 + row * 56;
          drawGlassPane(ctx, lctx, x, y, 64, 48, r() < 0.3, r);
        }
      }
      ctx.fillStyle = 'rgba(15,20,30,0.5)';
      ctx.fillRect(0, 24, W, 3);
    } else if (def.kind === 'banner') {
      // 서울예대 배너
      ctx.fillStyle = 'rgba(28,32,44,0.9)';
      ctx.fillRect(14, 30, 228, 138);
      ctx.fillStyle = '#e2603c';
      ctx.fillRect(22, 38, 212, 122);
      const bg = ctx.createLinearGradient(22, 38, 234, 160);
      bg.addColorStop(0, 'rgba(255,120,80,0.55)');
      bg.addColorStop(1, 'rgba(90,25,15,0.55)');
      ctx.fillStyle = bg;
      ctx.fillRect(22, 38, 212, 122);

      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 78px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillText('SIA', W / 2, 88);
      ctx.font = '600 21px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      ctx.fillText('서울예술대학교', W / 2, 136);

      lctx.fillStyle = 'rgba(255,120,80,0.36)';
      lctx.fillRect(22, 38, 212, 122);
      lctx.fillStyle = 'rgba(255,255,255,0.9)';
      lctx.textAlign = 'center';
      lctx.textBaseline = 'middle';
      lctx.font = '800 78px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      lctx.fillText('SIA', W / 2, 88);
      lctx.font = '600 21px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      lctx.fillText('서울예술대학교', W / 2, 136);
    } else {
      // 콘크리트 창
      const lit = r() < 0.42;
      ctx.fillStyle = 'rgba(20,24,34,0.9)';
      ctx.fillRect(50, 42, 156, 128);
      drawGlassPane(ctx, lctx, 58, 50, 140, 112, lit, r);

      // 창틀 / 실라인
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(50, 169, 156, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(50, 172, 156, 3);

      // 작은 환기구
      ctx.fillStyle = 'rgba(30,32,38,0.4)';
      ctx.fillRect(196, 26, 38, 8);
      ctx.fillRect(22, 26, 28, 8);

      if (r() < 0.4) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, 178, W, 8);
      }
    }

    // 하단 음영
    const shade = ctx.createLinearGradient(0, H * 0.68, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.20)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);

    const emissiveTex = canvasTexture(light);
    const tints = [0xffffff, 0xf2eee8, 0xd9d2c8, 0xbab2a7];
    const mats = [];
    for (let stage = 0; stage < 4; stage++) {
      let mapCanvas = base;
      if (stage > 0) {
        mapCanvas = makeCanvas(W, H);
        mapCanvas.getContext('2d').drawImage(base, 0, 0);
        applyCracks(mapCanvas, stage, def.seed + stage * 37);
      }
      mats.push(
        new THREE.MeshStandardMaterial({
          map: canvasTexture(mapCanvas),
          color: tints[stage],
          emissiveMap: emissiveTex,
          emissive: new THREE.Color(0xffa25f),
          emissiveIntensity: 0.55,
          roughness: 0.92,
          metalness: 0.02,
        })
      );
    }
    return { mats };
  }

  function drawGlassPane(ctx, lctx, x, y, w, h, lit, r) {
    ctx.fillStyle = '#1e2431';
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);

    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    if (lit) {
      g.addColorStop(0, '#ffcc8d');
      g.addColorStop(0.55, '#f5a461');
      g.addColorStop(1, '#b56a3f');
    } else {
      g.addColorStop(0, '#46647f');
      g.addColorStop(0.5, '#263a50');
      g.addColorStop(1, '#51718d');
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(190,225,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(x - 12, y + h);
    ctx.lineTo(x + w * 0.5, y - 10);
    ctx.lineTo(x + w * 0.7, y - 10);
    ctx.lineTo(x + w * 0.08, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.7, y - 4);
    ctx.lineTo(x + w * 0.82, y - 4);
    ctx.lineTo(x + w * 0.2, y + h);
    ctx.lineTo(x + w * 0.08, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(18,22,30,0.9)';
    ctx.fillRect(x + Math.round(w / 2) - 2, y, 4, h);
    ctx.strokeStyle = 'rgba(8,12,18,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    if (lit) {
      lctx.fillStyle = 'rgba(255,177,104,0.95)';
      lctx.fillRect(x, y, w, h);
      lctx.fillStyle = 'rgba(0,0,0,0.92)';
      lctx.fillRect(x + Math.round(w / 2) - 2, y, 4, h);
      lctx.strokeStyle = 'rgba(0,0,0,0.7)';
      lctx.lineWidth = 2;
      lctx.strokeRect(x, y, w, h);
    }
  }

  function applyCracks(canvas, level, seed) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const r = mulberry32(seed);
    ctx.fillStyle = `rgba(22,17,20,${level * 0.028})`;
    ctx.fillRect(0, 0, W, H);

    const branches = level * 2 + 2;
    for (let b = 0; b < branches; b++) {
      let x = 24 + r() * (W - 48);
      let y = 16 + r() * (H - 32);
      let ang = r() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const pts = [[x, y]];
      const segs = 3 + ((r() * 4) | 0);
      for (let s = 0; s < segs; s++) {
        ang += (r() - 0.5) * 1.5;
        const len = (6 + r() * 18) * (0.7 + level * 0.12);
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        ctx.lineTo(x, y);
        pts.push([x, y]);
        if (r() < 0.42 && level >= 2) {
          let bx = x;
          let by = y;
          let ba = ang + (r() < 0.5 ? 1 : -1) * (0.6 + r() * 0.8);
          for (let k = 0; k < 3; k++) {
            ba += (r() - 0.5) * 0.7;
            bx += Math.cos(ba) * (5 + r() * 10);
            by += Math.sin(ba) * (5 + r() * 10);
            ctx.lineTo(bx, by);
          }
          ctx.moveTo(x, y);
        }
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(18,15,20,0.82)';
      ctx.lineWidth = 1.2 + level * 0.55;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      for (const p of pts.slice(-2)) {
        ctx.fillStyle = 'rgba(10,9,12,0.45)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.5 + r() * 2.4, 0, TAU);
        ctx.fill();
      }
    }

    if (level >= 3) {
      ctx.strokeStyle = 'rgba(10,9,12,0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const cx = r() < 0.5 ? 8 : W - 8;
        const cy = r() < 0.5 ? 8 : H - 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (cx < 20 ? 1 : -1) * (10 + r() * 22), cy + (cy < 20 ? 1 : -1) * (6 + r() * 12));
        ctx.stroke();
      }
    }
  }

  function makeSignTexture() {
    const W = 1024;
    const H = 256;
    const c = makeCanvas(W, H);
    const x = c.getContext('2d');
    x.fillStyle = '#0d1626';
    x.fillRect(0, 0, W, H);
    const grad = x.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = grad;
    x.fillRect(0, 0, W, H);
    x.strokeStyle = '#ff6a45';
    x.lineWidth = 9;
    x.strokeRect(12, 12, W - 24, H - 24);

    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#f6ecdb';
    x.font = '800 112px "Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
    x.fillText('서울예술대학교', W / 2, 112);
    x.fillStyle = '#ffb18e';
    x.font = '600 27px "SF Mono","JetBrains Mono",monospace';
    if ('letterSpacing' in x) x.letterSpacing = '7px';
    x.fillText('SEOUL INSTITUTE OF THE ARTS', W / 2, 198);

    const l = makeCanvas(W, H);
    const lx = l.getContext('2d');
    lx.fillStyle = '#000';
    lx.fillRect(0, 0, W, H);
    lx.textAlign = 'center';
    lx.textBaseline = 'middle';
    lx.fillStyle = '#fff';
    lx.font = '800 112px "Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
    lx.fillText('서울예술대학교', W / 2, 112);
    lx.fillStyle = 'rgba(255,150,110,0.85)';
    lx.font = '600 27px "SF Mono","JetBrains Mono",monospace';
    if ('letterSpacing' in lx) lx.letterSpacing = '7px';
    lx.fillText('SEOUL INSTITUTE OF THE ARTS', W / 2, 198);

    return {
      map: canvasTexture(c),
      emissive: canvasTexture(l),
    };
  }

  // ------------------------------------------------------------------ building
  function buildBuilding() {
    buildingGroup = new THREE.Group();
    buildingGroup.position.set(0, CFG.startBase, 0);
    scene.add(buildingGroup);

    blocks = [];
    targets = [];
    signObj = null;
    signGroup = null;

    for (let f = 0; f < CFG.floors; f++) {
      for (let c = 0; c < CFG.cols; c++) {
        // 1층 중앙 출입구
        if (f === 0 && (c === 2 || c === 3)) continue;
        // 옥상 스텝
        if (f === CFG.floors - 1 && (c === 0 || c === CFG.cols - 1)) continue;

        let vi;
        if (f === 5 && c === 3) vi = 7;
        else if (c === 1 || c === 4) vi = 4 + ((f + c) % 3);
        else if (f === CFG.floors - 1) vi = 4 + (c % 3);
        else vi = (f * 5 + c * 3 + 1) % 4;

        const variant = assets.variants[vi];
        const mesh = new THREE.Mesh(blockGeo, variant.mats[0]);
        const x = (c - (CFG.cols - 1) / 2) * CFG.bw;
        const y = f * CFG.bh + CFG.bh / 2;
        mesh.position.set(x, y, 0);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const block = {
          mesh,
          hp: CFG.blockHp,
          maxHp: CFG.blockHp,
          stage: 0,
          mats: variant.mats,
          dead: false,
          holes: [],
          kind: 'block',
          col: c,
          floor: f,
        };
        mesh.userData.block = block;
        buildingGroup.add(mesh);
        blocks.push(block);
        targets.push(mesh);
      }
    }
    state.total = blocks.length;

    const roofY = CFG.floors * CFG.bh;

    // 출입구 내부
    const lobby = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.bw * 2 - 0.14, CFG.bh - 0.1),
      new THREE.MeshBasicMaterial({ color: 0x0d1119 })
    );
    lobby.position.set(0, CFG.bh / 2, -CFG.bd / 2 + 0.15);
    buildingGroup.add(lobby);
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 1.05),
      new THREE.MeshBasicMaterial({ color: 0xc98a56 })
    );
    door.position.set(0, 0.56, -CFG.bd / 2 + 0.16);
    buildingGroup.add(door);

    // 옥상 장비
    const propMat = new THREE.MeshStandardMaterial({
      color: 0x3b4558,
      roughness: 0.7,
      metalness: 0.25,
      flatShading: true,
    });
    for (const [px, pz, w, h, d] of [
      [-2.1, -0.35, 1.1, 0.7, 1.0],
      [1.6, 0.4, 0.9, 0.5, 0.8],
      [2.7, -0.5, 0.6, 0.9, 0.6],
    ]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), propMat);
      p.position.set(px, roofY + h / 2, pz);
      p.castShadow = true;
      buildingGroup.add(p);
    }

    // 옥상 간판
    signGroup = new THREE.Group();
    signGroup.position.y = roofY;
    buildingGroup.add(signGroup);

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x222c3c,
      roughness: 0.55,
      metalness: 0.4,
    });
    for (const px of [-3.3, 3.3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.5, 0.2), postMat);
      post.position.set(px, 0.75, 0);
      post.castShadow = true;
      signGroup.add(post);
    }

    const signSide = new THREE.MeshStandardMaterial({
      color: 0x151d2c,
      roughness: 0.6,
      metalness: 0.3,
    });
    const signFront = new THREE.MeshStandardMaterial({
      map: assets.signMap,
      emissiveMap: assets.signEmissive,
      emissive: 0xffe1bd,
      emissiveIntensity: 0.8,
      roughness: 0.65,
      metalness: 0.08,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(8.9, 1.85, 0.3), [
      signSide,
      signSide,
      signSide,
      signSide,
      signFront,
      signFront,
    ]);
    panel.position.set(0, 2.25, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.userData.kind = 'sign';
    signGroup.add(panel);
    signObj = { mesh: panel, hp: CFG.signHp, maxHp: CFG.signHp, dead: false };
    targets.push(panel);
  }

  function lowestBottomLocal() {
    let min = Infinity;
    for (const b of blocks) {
      if (b.dead) continue;
      min = Math.min(min, b.mesh.position.y - CFG.bh / 2);
    }
    return Number.isFinite(min) ? min : 0;
  }

  // ------------------------------------------------------------------ gun
  function buildGun() {
    const metal = new THREE.MeshStandardMaterial({
      color: 0x2a303b,
      roughness: 0.48,
      metalness: 0.65,
      flatShading: true,
    });
    const dark = new THREE.MeshStandardMaterial({
      color: 0x171b23,
      roughness: 0.7,
      metalness: 0.35,
      flatShading: true,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0xe2603c,
      roughness: 0.55,
      metalness: 0.2,
      emissive: 0x5c1b0c,
      emissiveIntensity: 0.35,
      flatShading: true,
    });

    const base = new THREE.Group();
    base.position.set(-8.4, CFG.groundY, 10);
    scene.add(base);

    // 삼각대
    for (const [x, z, rz, rx] of [
      [-0.55, 0.1, 0.42, 0],
      [0.55, 0.1, -0.42, 0],
      [0, -0.62, 0, -0.5],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 2.3, 6), dark);
      leg.position.set(x, 1.05, z);
      leg.rotation.z = rz;
      leg.rotation.x = rx;
      leg.castShadow = true;
      base.add(leg);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.22, 10), metal);
    hub.position.y = 2.05;
    hub.castShadow = true;
    base.add(hub);

    gunPivot = new THREE.Group();
    gunPivot.position.copy(base.position);
    gunPivot.position.y += 2.05;
    base.scale.setScalar(1.28);
    gunPivot.scale.setScalar(1.28);
    scene.add(gunPivot);

    gunBody = new THREE.Group();
    gunPivot.add(gunBody);

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.45, 0.5), metal);
    receiver.position.y = 0.55;
    receiver.castShadow = true;
    gunBody.add(receiver);

    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.42), dark);
    shroud.position.y = 1.4;
    shroud.castShadow = true;
    gunBody.add(shroud);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.15, 8), metal);
    barrel.position.y = 2.5;
    barrel.castShadow = true;
    gunBody.add(barrel);

    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.36, 0.24), dark);
    brake.position.y = 3.55;
    brake.castShadow = true;
    gunBody.add(brake);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.52), accent);
    stripe.position.y = 0.98;
    gunBody.add(stripe);

    const ammo = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.56, 0.78), dark);
    ammo.position.set(0.38, 0.1, 0.12);
    ammo.castShadow = true;
    gunBody.add(ammo);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.5, 0.26), dark);
    grip.position.set(0, -0.2, 0.28);
    grip.rotation.x = -0.3;
    gunBody.add(grip);

    // 머즐 플래시
    const flashTex = radialTexture('rgba(255,220,150,1)', 128);
    muzzleFlash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flashTex,
        color: 0xffbb70,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0,
      })
    );
    muzzleFlash.position.set(0, 3.85, 0);
    muzzleFlash.scale.set(2.6, 2.6, 1);
    gunBody.add(muzzleFlash);

    muzzleLight = new THREE.PointLight(0xffa860, 0, 12, 2);
    muzzleLight.position.set(0, 3.8, 0);
    gunBody.add(muzzleLight);
  }

  // ------------------------------------------------------------------ sparks
  const SPARK_MAX = 900;

  function initSparks() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SPARK_MAX * 3);
    const col = new Float32Array(SPARK_MAX * 3);
    for (let i = 0; i < SPARK_MAX; i++) pos[i * 3 + 1] = -999;
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      map: assets.sparkTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    sparkSys = {
      points,
      pos,
      col,
      vel: new Float32Array(SPARK_MAX * 3),
      life: new Float32Array(SPARK_MAX),
      maxLife: new Float32Array(SPARK_MAX),
      base: new Float32Array(SPARK_MAX * 3),
      cursor: 0,
    };
  }

  function spawnSparks(point, normal, count, warm = true, speed = 6) {
    if (!sparkSys) return;
    const s = sparkSys;
    for (let i = 0; i < count; i++) {
      const idx = s.cursor++ % SPARK_MAX;
      const o = idx * 3;
      s.pos[o] = point.x + (Math.random() - 0.5) * 0.18;
      s.pos[o + 1] = point.y + (Math.random() - 0.5) * 0.18;
      s.pos[o + 2] = point.z + (Math.random() - 0.5) * 0.18;
      const sp = speed * (0.35 + Math.random() * 0.9);
      s.vel[o] = normal.x * sp + (Math.random() - 0.5) * speed * 0.8;
      s.vel[o + 1] = normal.y * sp + (Math.random() - 0.2) * speed * 0.8;
      s.vel[o + 2] = normal.z * sp + (Math.random() - 0.5) * speed * 0.8;
      const life = 0.18 + Math.random() * 0.4;
      s.life[idx] = life;
      s.maxLife[idx] = life;
      const warmth = warm ? 0.65 + Math.random() * 0.35 : 0.8;
      s.base[o] = 1;
      s.base[o + 1] = 0.72 + warmth * 0.28;
      s.base[o + 2] = 0.35 + warmth * 0.3;
      s.col[o] = s.base[o];
      s.col[o + 1] = s.base[o + 1];
      s.col[o + 2] = s.base[o + 2];
    }
    s.points.geometry.attributes.position.needsUpdate = true;
    s.points.geometry.attributes.color.needsUpdate = true;
  }

  function updateSparks(dt) {
    if (!sparkSys) return;
    const s = sparkSys;
    let dirty = false;
    for (let i = 0; i < SPARK_MAX; i++) {
      if (s.life[i] <= 0) continue;
      dirty = true;
      s.life[i] -= dt;
      const o = i * 3;
      if (s.life[i] <= 0) {
        s.pos[o + 1] = -999;
        continue;
      }
      s.vel[o + 1] -= 15 * dt;
      s.pos[o] += s.vel[o] * dt;
      s.pos[o + 1] += s.vel[o + 1] * dt;
      s.pos[o + 2] += s.vel[o + 2] * dt;
      s.vel[o] *= 0.98;
      s.vel[o + 2] *= 0.98;
      const k = s.life[i] / s.maxLife[i];
      s.col[o] = s.base[o] * k;
      s.col[o + 1] = s.base[o + 1] * k;
      s.col[o + 2] = s.base[o + 2] * k;
    }
    if (dirty) {
      s.points.geometry.attributes.position.needsUpdate = true;
      s.points.geometry.attributes.color.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ dust
  function initDust() {
    for (let i = 0; i < 42; i++) {
      const mat = new THREE.SpriteMaterial({
        map: assets.dustTex,
        color: 0x9aa2b3,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      dustPool.push({ sprite: sp, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, grow: 1, base: 0.32, size: 1 });
    }
  }

  let dustCursor = 0;

  function spawnDust(pos, count, spread, size, color = 0x768091) {
    for (let i = 0; i < count; i++) {
      if (!dustPool.length) return;
      const d = dustPool[dustCursor++ % dustPool.length];
      d.sprite.visible = true;
      d.sprite.position.set(
        pos.x + (Math.random() - 0.5) * spread,
        pos.y + Math.random() * spread * 0.35,
        pos.z + (Math.random() - 0.5) * spread
      );
      d.sprite.material.color.setHex(color);
      d.base = 0.12 + Math.random() * 0.12;
      d.sprite.material.opacity = d.base;
      d.size = size * (0.6 + Math.random() * 0.9);
      d.sprite.scale.setScalar(d.size * 0.4);
      d.life = 0.8 + Math.random() * 1.15;
      d.maxLife = d.life;
      d.vx = (Math.random() - 0.5) * spread * 0.35;
      d.vy = 0.7 + Math.random() * 1.1;
      d.vz = (Math.random() - 0.5) * spread * 0.35;
      d.grow = 1.6 + Math.random() * 2.0;
    }
  }

  function updateDust(dt) {
    for (const d of dustPool) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.sprite.visible = false;
        d.sprite.material.opacity = 0;
        continue;
      }
      const k = d.life / d.maxLife;
      d.sprite.position.x += d.vx * dt;
      d.sprite.position.y += d.vy * dt;
      d.sprite.position.z += d.vz * dt;
      d.vx *= 0.985;
      d.vz *= 0.985;
      d.vy = d.vy * 0.985 + 0.12 * dt;
      d.sprite.scale.setScalar(d.size * (1 + (1 - k) * d.grow));
      d.sprite.material.opacity = d.base * Math.min(1, k * 2.2);
    }
  }

  // ------------------------------------------------------------------ tracers
  function initTracers() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd493,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      tracers.push({ mesh: m, life: 0 });
    }
  }

  function spawnTracer(a, b) {
    const t = tracers[tracerCursor++ % tracers.length];
    const len = a.distanceTo(b);
    if (len < 0.1) return;
    t.mesh.visible = true;
    t.mesh.position.copy(a).add(b).multiplyScalar(0.5);
    t.mesh.lookAt(b);
    t.mesh.scale.set(0.055, 0.055, len);
    t.life = 0.055;
  }

  function updateTracers(dt) {
    for (const t of tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
    }
  }

  // ------------------------------------------------------------------ shockwaves
  function spawnShockwave(scale = 10, y = CFG.groundY) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.0, 64),
      new THREE.MeshBasicMaterial({
        color: 0xff8455,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(0, y + 0.3, 0);
    mesh.scale.setScalar(2.5);
    scene.add(mesh);
    shockwaves.push({ mesh, life: 0.65, maxLife: 0.65, scale });
  }

  function updateShockwaves(dt) {
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const w = shockwaves[i];
      w.life -= dt;
      if (w.life <= 0) {
        scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        w.mesh.material.dispose();
        shockwaves.splice(i, 1);
        continue;
      }
      const k = 1 - w.life / w.maxLife;
      w.mesh.scale.setScalar(2.5 + k * w.scale);
      w.mesh.material.opacity = 0.9 * (1 - k);
    }
  }

  // ------------------------------------------------------------------ audio
  let audioCtx = null;
  let masterGain = null;
  let noiseBuf = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        audioCtx = new AC();
      } catch (e) {
        return;
      }
      masterGain = audioCtx.createGain();
      masterGain.gain.value = state.muted ? 0 : 0.5;
      masterGain.connect(audioCtx.destination);
      const len = Math.floor(audioCtx.sampleRate * 1.2);
      noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function sfxNoise(freq, dur, vol, type = 'lowpass', q = 1, rate = 1) {
    if (!audioCtx || state.muted) return;
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate;
    const f = audioCtx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(masterGain);
    src.start(t);
    src.stop(t + dur + 0.02);
    return { f, g };
  }

  function sfxTone(freq, dur, vol, type = 'sine', endFreq = null, delay = 0) {
    if (!audioCtx || state.muted) return;
    const t = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(g).connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playGun() {
    sfxNoise(2100, 0.055, 0.15, 'bandpass', 0.8, 1.5 + Math.random() * 0.35);
    sfxTone(150, 0.07, 0.1, 'square', 60);
  }
  function playHit() {
    sfxNoise(3400, 0.035, 0.055, 'bandpass', 1.5, 1.8);
  }
  function playCrack() {
    sfxNoise(900, 0.09, 0.07, 'bandpass', 2.2, 1.2);
  }
  function playBreak() {
    sfxNoise(750, 0.28, 0.24, 'lowpass', 0.8, 1);
    sfxTone(90, 0.18, 0.12, 'triangle', 45);
    sfxNoise(2600, 0.08, 0.05, 'highpass', 0.7, 1.6);
  }
  function playBounce() {
    sfxTone(78, 0.55, 0.4, 'sine', 34);
    sfxNoise(420, 0.45, 0.24, 'lowpass', 0.7, 1);
    sfxNoise(1800, 0.3, 0.08, 'bandpass', 1.1, 1.7);
    sfxTone(620, 0.32, 0.06, 'triangle', 980, 0.03);
  }
  function playCharge() {
    sfxTone(880, 0.12, 0.05, 'sine', 1320);
  }
  function playCollapse() {
    sfxNoise(320, 1.9, 0.42, 'lowpass', 0.6, 0.8);
    sfxNoise(1600, 0.7, 0.12, 'bandpass', 1, 0.9);
    sfxTone(52, 1.6, 0.3, 'sine', 28);
  }
  function playDeny() {
    sfxTone(180, 0.1, 0.07, 'square', 120);
  }
  function playWin() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => sfxTone(n, 0.5, 0.08, 'triangle', n * 1.001, i * 0.13));
    sfxTone(261.6, 1.1, 0.06, 'sine', 261.6, 0.1);
  }
  function playLose() {
    const notes = [220, 174.6, 146.8, 110];
    notes.forEach((n, i) => sfxTone(n, 0.45, 0.09, 'sawtooth', n * 0.99, i * 0.14));
    sfxNoise(300, 1.1, 0.16, 'lowpass', 0.8, 0.8);
  }
  function playUi() {
    sfxTone(520, 0.09, 0.05, 'sine', 700);
  }
  function playThud() {
    sfxNoise(280, 0.14, 0.05, 'lowpass', 0.8, 0.8);
  }

  // ------------------------------------------------------------------ aiming
  function updateAim() {
    mouseNDC.set((pointer.x / innerWidth) * 2 - 1, -(pointer.y / innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouseNDC, camera);
    if (!raycaster.ray.intersectPlane(aimPlane, aimPoint)) aimPoint.set(0, 20, 0);
  }

  function updateGun(raw) {
    if (!gunPivot) return;
    const dx = aimPoint.x - gunPivot.position.x;
    const dy = aimPoint.y - gunPivot.position.y;
    gunPivot.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;

    state.recoil = Math.max(0, (state.recoil || 0) - raw * 9);
    if (gunBody) gunBody.position.y = -state.recoil * 0.13;

    state.muzzle = Math.max(0, (state.muzzle || 0) - raw * 17);
    if (muzzleFlash) {
      muzzleFlash.material.opacity = state.muzzle * 0.95;
      muzzleFlash.material.rotation += raw * 30;
    }
    if (muzzleLight) muzzleLight.intensity = state.muzzle * 5.5;

    if (padRing) {
      const t = performance.now() * 0.002;
      padRing.material.opacity = 0.35 + Math.sin(t * 1.6) * 0.16;
      padRing.scale.setScalar(1 + Math.sin(t * 1.6) * 0.01);
    }
    if (padGlow) {
      padGlow.material.opacity = 0.14 + Math.sin(performance.now() * 0.0015) * 0.045;
    }
  }

  // ------------------------------------------------------------------ shooting
  function shoot() {
    if (state.phase !== 'playing') return;
    ensureAudio();
    updateAim();

    gunPivot.updateMatrixWorld(true);
    const muzzle = new THREE.Vector3();
    muzzleFlash.getWorldPosition(muzzle);

    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObjects(targets, false);
    let end;
    if (hits.length) {
      const h = hits[0];
      end = h.point.clone();
      if (h.object.userData.kind === 'sign') {
        damageSign(h);
      } else if (h.object.userData.block) {
        damageBlock(h.object.userData.block, h);
      }
    } else {
      end = raycaster.ray.at(95, new THREE.Vector3());
    }

    spawnTracer(muzzle, end);
    state.recoil = 1;
    state.muzzle = 1;
    state.shake = Math.max(state.shake, 0.055);
    if (muzzleFlash) {
      muzzleFlash.material.rotation = Math.random() * TAU;
      muzzleFlash.scale.setScalar(2.1 + Math.random() * 1.6);
    }
    if (muzzleLight) muzzleLight.intensity = 5.5;

    playGun();
  }

  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  let holeGeo = null;
  let holeMat = null;

  function addHole(block, worldPoint, normal) {
    if (!block.mesh || block.dead) return;
    if (!holeGeo) {
      holeGeo = new THREE.PlaneGeometry(0.27, 0.27);
      holeMat = new THREE.MeshBasicMaterial({
        map: assets.holeTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
    }
    const local = block.mesh.worldToLocal(worldPoint.clone());
    const hole = new THREE.Mesh(holeGeo, holeMat);
    hole.position.copy(local).addScaledVector(normal, 0.014);
    hole.quaternion.setFromUnitVectors(Z_AXIS, normal);
    hole.rotateZ(Math.random() * TAU);
    hole.scale.setScalar(0.72 + Math.random() * 0.55);
    block.mesh.add(hole);
    block.holes.push(hole);
    while (block.holes.length > 3) {
      const old = block.holes.shift();
      block.mesh.remove(old);
    }
  }

  function damageBlock(block, hit) {
    if (block.dead) return;
    const point = hit.point.clone();
    const normal = hit.face ? hit.face.normal.clone() : Z_AXIS.clone();

    addHole(block, point, normal);
    spawnSparks(point, normal, 5, true, 6.5);
    playHit();
    block.hp -= CFG.damage;
    signPulse = 0.1;

    const ratio = Math.max(0, block.hp) / block.maxHp;
    const stage = ratio > 0.84 ? 0 : ratio > 0.6 ? 1 : ratio > 0.36 ? 2 : 3;
    if (stage > block.stage) {
      block.stage = stage;
      block.mesh.material = block.mats[stage];
      spawnDust(point, 1, 0.35, 0.9, 0x8e8a85);
      playCrack();
    }

    hitMarker();
    if (block.hp <= 0) destroyBlock(block, point, normal);
    updateHUD();
  }

  function damageSign(hit) {
    if (!signObj || signObj.dead) return;
    const normal = hit.face ? hit.face.normal.clone() : Z_AXIS.clone();
    spawnSparks(hit.point, normal, 4, true, 6);
    playHit();
    signObj.hp -= CFG.damage;
    signPulse = 0.22;
    const ratio = Math.max(0, signObj.hp) / signObj.maxHp;
    const mats = signObj.mesh.material;
    if (mats[4]) mats[4].emissiveIntensity = 0.8 - (1 - ratio) * 0.45;
    if (mats[5]) mats[5].emissiveIntensity = 0.8 - (1 - ratio) * 0.45;
    hitMarker();
    if (signObj.hp <= 0) destroySign(hit.point);
  }

  let chunkGeo = null;
  let chunkMats = null;

  function spawnChunks(pos, normal, count) {
    if (!chunkGeo) {
      chunkGeo = new THREE.BoxGeometry(1, 1, 1);
      chunkMats = [
        new THREE.MeshStandardMaterial({ color: 0xc7bfb0, roughness: 0.95, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x6d8294, roughness: 0.9, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.95, flatShading: true }),
        new THREE.MeshStandardMaterial({ color: 0xd08a5e, roughness: 0.9, flatShading: true }),
      ];
    }
    for (let i = 0; i < count; i++) {
      const size = 0.14 + Math.random() * 0.24;
      const mesh = new THREE.Mesh(chunkGeo, chunkMats[(Math.random() * chunkMats.length) | 0]);
      mesh.scale.setScalar(size);
      mesh.position.set(
        pos.x + (Math.random() - 0.5) * 0.9,
        pos.y + (Math.random() - 0.5) * 0.9,
        pos.z + (Math.random() - 0.5) * 0.9
      );
      scene.add(mesh);
      debris.push({
        mesh,
        vx: normal.x * 2 + rnd(-3, 3),
        vy: rnd(1.5, 4.5),
        vz: normal.z * 2 + rnd(-3, 3),
        ax: rnd(-9, 9),
        ay: rnd(-9, 9),
        az: rnd(-9, 9),
        age: 0,
        bounces: 0,
        delay: 0,
        half: size * 0.55,
      });
    }
  }

  function destroyBlock(block, point, normal) {
    if (block.dead) return;
    block.dead = true;
    const mesh = block.mesh;
    mesh.updateWorldMatrix(true, false);
    scene.attach(mesh);

    const ti = targets.indexOf(mesh);
    if (ti >= 0) targets.splice(ti, 1);

    debris.push({
      mesh,
      vx: mesh.position.x * 0.22 + rnd(-1.6, 1.6),
      vy: Math.max(0.7, -state.fallVy * 0.55) + rnd(0.4, 2.2),
      vz: rnd(-1.2, 1.2),
      ax: rnd(-5, 5),
      ay: rnd(-5, 5),
      az: rnd(-5, 5),
      age: 0,
      bounces: 0,
      delay: 0,
      half: CFG.bh / 2,
    });

    state.destroyed++;
    state.combo++;
    state.comboTimer = 2.6;
    state.comboFlash = 1;
    const gained = 100 * Math.min(10, Math.max(1, state.combo));
    addScore(gained);
    popupAt(point, `+${gained}`, state.combo >= 2 ? 'coral' : '');
    spawnSparks(point, normal, 16, true, 9);
    spawnDust(point, 2, 0.7, 1.3, 0x8b847b);
    spawnChunks(point, normal, 3);
    state.shake = Math.max(state.shake, 0.28);
    playBreak();

    if (state.combo >= 5 && state.combo % 5 === 0) {
      createPopup(`×${state.combo} COMBO`, innerWidth / 2, innerHeight * 0.26, 'coral');
    }
    updateHUD();

    if (state.destroyed / state.total >= CFG.goal) triggerCollapse();
  }

  function destroySign(point) {
    if (!signObj || signObj.dead) return;
    signObj.dead = true;
    const mesh = signObj.mesh;
    signGroup.updateWorldMatrix(true, true);
    scene.attach(mesh);
    const ti = targets.indexOf(mesh);
    if (ti >= 0) targets.splice(ti, 1);

    debris.push({
      mesh,
      vx: rnd(-2.2, 2.2),
      vy: 1.6 + Math.random() * 1.6,
      vz: rnd(-1, 1),
      ax: rnd(-2.5, 2.5),
      ay: rnd(-3, 3),
      az: rnd(-3, 3),
      age: 0,
      bounces: 0,
      delay: 0,
      half: 0.9,
    });
    addScore(500);
    const world = mesh.getWorldPosition(new THREE.Vector3());
    popupAt(world, 'SIGN +500', 'big');
    spawnSparks(world, new THREE.Vector3(0, 1, 0), 24, true, 8);
    spawnDust(world, 5, 2.2, 2.4, 0x9aa0ad);
    state.shake = Math.max(state.shake, 0.5);
    playBreak();
    updateHUD();
  }

  // ------------------------------------------------------------------ collapse / end
  function triggerCollapse() {
    if (state.phase !== 'playing') return;
    state.phase = 'collapsing';
    state.shooting = false;
    state.targetTimeScale = 0.55;
    state.endTimer = 2.7;
    state.shake = 1.15;
    ensureAudio();
    playCollapse();
    flashScreen(0.28);

    const remaining = blocks.filter((b) => !b.dead).length;

    if (signObj && !signObj.dead) {
      signObj.dead = true;
      signGroup.updateWorldMatrix(true, true);
      scene.attach(signObj.mesh);
      debris.push({
        mesh: signObj.mesh,
        vx: rnd(-3, 3),
        vy: rnd(0.4, 2.4),
        vz: rnd(-1.4, 1.4),
        ax: rnd(-3, 3),
        ay: rnd(-3, 3),
        az: rnd(-3, 3),
        age: 0,
        bounces: 0,
        delay: Math.random() * 0.25,
        half: 0.9,
      });
    }

    for (const b of blocks) {
      if (b.dead) continue;
      b.dead = true;
      b.mesh.material = b.mats[3];
      b.mesh.updateWorldMatrix(true, false);
      scene.attach(b.mesh);
      debris.push({
        mesh: b.mesh,
        vx: b.mesh.position.x * 0.55 + rnd(-1.4, 1.4),
        vy: rnd(-0.4, 2.6),
        vz: rnd(-1.6, 1.6),
        ax: rnd(-4.5, 4.5),
        ay: rnd(-4, 4),
        az: rnd(-4.5, 4.5),
        age: 0,
        bounces: 0,
        delay: Math.random() * 0.3,
        half: CFG.bh / 2,
      });
    }

    targets.length = 0;
    if (buildingGroup) {
      scene.remove(buildingGroup);
      buildingGroup = null;
    }

    state.destroyed = state.total;
    addScore(1200 + remaining * 90);
    createPopup('완전 붕괴', innerWidth * 0.5, innerHeight * 0.3, 'big');
    spawnDust(new THREE.Vector3(0, 4, 0), 20, 13, 5.5, 0x8e94a3);
    spawnShockwave(15);
    updateHUD(true);
  }

  function loseGame() {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.shooting = false;
    state.fallVy = 0;
    if (buildingGroup) buildingGroup.position.y = CFG.groundY - lowestBottomLocal();
    state.targetTimeScale = 0.45;
    state.endTimer = 1.35;
    state.shake = 1.15;
    ensureAudio();
    playLose();
    flashScreen(0.16);
    spawnDust(new THREE.Vector3(0, 0.9, 0), 16, 9, 4.2, 0x8d8b90);
    spawnShockwave(11);
    updateHUD(true);
  }

  function showResult(win) {
    if (state.phase === 'over') return;
    state.phase = 'over';
    state.win = win;
    state.shooting = false;
    state.targetTimeScale = 1;
    const pct = Math.round((state.destroyed / state.total) * 100);
    dom.resultEyebrow.textContent = win ? 'DEMOLITION COMPLETE' : 'STRUCTURE LANDED';
    dom.resultTitle.textContent = win ? '철거 성공' : '착지 실패';
    dom.resultTitle.classList.toggle('fail', !win);
    dom.resultDesc.textContent = win
      ? '서울예술대학교가 완전히 무너졌습니다. 잔해 처리반이 환호하고 있습니다.'
      : '건물이 착지해 버렸습니다. 반발 장치로 시간을 벌고, 금이 간 곳을 집중 사격하세요.';
    dom.finalScore.textContent = state.score.toLocaleString('en-US');
    dom.finalPct.textContent = pct + '%';
    dom.finalTime.textContent = state.playTime.toFixed(1) + 's';
    dom.resultScreen.classList.remove('hidden');
    document.body.classList.remove('in-game');
    state.dangerOn = false;
    dom.danger.classList.remove('on');
    dom.crosshair.classList.remove('hit');
    updateHUD(true);
    if (win) playWin();
  }

  // ------------------------------------------------------------------ score / popups
  function addScore(amount) {
    if (!amount) return;
    state.score += Math.round(amount);
    dom.score.textContent = state.score.toLocaleString('en-US');
  }

  function popupAt(worldPoint, text, cls = '') {
    const p = worldPoint.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth;
    const y = (-p.y * 0.5 + 0.5) * innerHeight;
    createPopup(text, x, y, cls);
  }

  function createPopup(text, x, y, cls = '') {
    if (popupCount > 22) return;
    popupCount++;
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.left = clamp(x, 50, innerWidth - 50) + 'px';
    el.style.top = clamp(y, 70, innerHeight - 90) + 'px';
    dom.popups.appendChild(el);
    setTimeout(() => {
      el.remove();
      popupCount = Math.max(0, popupCount - 1);
    }, 900);
  }

  let hitTimer = 0;
  function hitMarker() {
    dom.crosshair.classList.add('hit');
    clearTimeout(hitTimer);
    hitTimer = setTimeout(() => dom.crosshair.classList.remove('hit'), 80);
  }

  let flashTimer = 0;
  function flashScreen(strength) {
    dom.flash.style.background = '#ffd9b0';
    dom.flash.classList.add('on');
    dom.flash.style.opacity = String(strength || 0.2);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      dom.flash.classList.remove('on');
      dom.flash.style.opacity = '0';
    }, 70);
  }

  // ------------------------------------------------------------------ bounce
  function bounce() {
    if (state.phase !== 'playing') return;
    ensureAudio();
    if (state.charges <= 0) {
      dom.bounceUI.classList.remove('deny');
      void dom.bounceUI.offsetWidth;
      dom.bounceUI.classList.add('deny');
      playDeny();
      return;
    }
    state.charges--;
    state.chargeProgress = 0;
    state.fallDelay = 0;
    // 위쪽이 +y 이므로 반발은 양수 속도. 낙하 중이어도 확실히 솟구치게 한다.
    state.fallVy = CFG.bounceV;
    state.shake = 0.9;
    const base = buildingGroup ? buildingGroup.position.y : 0;
    spawnShockwave(13);
    spawnShockwave(20);
    if (base > CFG.groundY + 0.2) {
      spawnShockwave(9, Math.max(CFG.groundY, base - 0.4));
      spawnShockwave(14, Math.max(CFG.groundY, base - 0.4));
    }
    spawnDust(new THREE.Vector3(0, 0.7, 0), 14, 8, 3.4, 0x8d94a5);
    spawnSparks(new THREE.Vector3(0, CFG.groundY + 0.4, 0), new THREE.Vector3(0, 1, 0), 30, true, 12);
    if (base > CFG.groundY + 0.2) {
      spawnSparks(new THREE.Vector3(0, base, 0), new THREE.Vector3(0, 1, 0), 18, true, 10);
    }
    createPopup('반발!', innerWidth * 0.5, innerHeight * 0.68, 'coral');
    state.comboFlash = 0.6;
    playBounce();
    flashScreen(0.1);
    updateHUD(true);
    // 건물 아래에서 튕겨 올라간 먼지
    if (base > 0.5) spawnDust(new THREE.Vector3(0, base, 0), 4, 3, 2.2, 0x9aa0ad);
  }

  // ------------------------------------------------------------------ HUD
  function buildPips() {
    dom.pips.innerHTML = '';
    for (let i = 0; i < CFG.maxCharges; i++) {
      const p = document.createElement('div');
      p.className = 'pip';
      p.appendChild(document.createElement('i'));
      dom.pips.appendChild(p);
    }
  }

  let lastScoreText = '';
  let lastPctText = '';

  function updateHUD(force = false) {
    const remaining = clamp(1 - state.destroyed / state.total, 0, 1);
    const pct = Math.round(remaining * 100);
    const fill = (remaining * 100).toFixed(1) + '%';
    if (dom.intFill.style.width !== fill) dom.intFill.style.width = fill;
    if (lastPctText !== pct + '%') {
      lastPctText = pct + '%';
      dom.intPct.textContent = lastPctText;
    }
    dom.intFill.classList.toggle('danger', remaining <= 0.5 && state.phase === 'playing');

    const scoreText = state.score.toLocaleString('en-US');
    if (scoreText !== lastScoreText) {
      lastScoreText = scoreText;
      dom.score.textContent = scoreText;
    }

    const pips = dom.pips.children;
    for (let i = 0; i < pips.length; i++) {
      const pip = pips[i];
      let f = 0;
      if (i < state.charges) f = 1;
      else if (i === state.charges) f = state.charges < CFG.maxCharges ? state.chargeProgress / CFG.chargeTime : 0;
      pip.classList.toggle('full', f >= 1);
      pip.classList.toggle('ready', i < state.charges);
      const bar = pip.firstElementChild;
      if (bar) bar.style.transform = `scaleX(${clamp(f, 0, 1)})`;
    }
    if (dom.rechargeFill) {
      dom.rechargeFill.style.width =
        (state.charges >= CFG.maxCharges ? 0 : (state.chargeProgress / CFG.chargeTime) * 100) + '%';
    }

    if (state.combo >= 2) {
      dom.combo.textContent = `×${state.combo} COMBO`;
      dom.combo.classList.add('on');
    } else {
      dom.combo.classList.remove('on');
    }

    dom.danger.classList.toggle('on', state.phase === 'playing' && state.dangerOn);
  }

  // ------------------------------------------------------------------ game loop
  function animate() {
    requestAnimationFrame(animate);
    const raw = Math.min(clock.getDelta(), 0.05);
    state.timeScale += (state.targetTimeScale - state.timeScale) * Math.min(1, raw * 4);
    const dt = raw * state.timeScale;

    updateCamera(raw);
    updateAim();
    updateGun(raw);
    updateGame(dt, raw);
    updateDebris(dt);
    updateSparks(dt);
    updateDust(dt);
    updateShockwaves(dt);
    updateTracers(dt);
    updateHUD();
    renderer.render(scene, camera);
  }

  function updateCamera(raw) {
    state.shake = Math.max(0, state.shake - raw * 2.4);
    const s = state.shake * 0.55;
    // 반발로 건물이 높이 솟구쳐도 화면 밖으로 나가지 않게 카메라가 살짝 따라간다.
    const baseY = buildingGroup ? buildingGroup.position.y : CFG.startBase;
    const lift = Math.max(0, baseY - CFG.startBase);
    camera.position.set(
      7 + (Math.random() - 0.5) * s,
      22 + lift * 0.4 + (Math.random() - 0.5) * s,
      55 + (Math.random() - 0.5) * s * 0.5
    );
    camera.lookAt(0, 17 + lift * 0.72, 0);
  }

  function updateGame(dt, raw) {
    if (state.phase === 'title') {
      if (buildingGroup) {
        buildingGroup.position.y = CFG.startBase + Math.sin(performance.now() * 0.0009) * 0.26;
      }
      return;
    }

    if (state.phase === 'playing') {
      state.playTime += dt;

      if (state.combo > 0) {
        state.comboTimer -= dt;
        if (state.comboTimer <= 0) state.combo = 0;
      }

      if (state.fallDelay > 0) {
        state.fallDelay -= dt;
      } else if (buildingGroup) {
        state.fallVy -= CFG.gravity * dt;
        buildingGroup.position.y += state.fallVy * dt;
        buildingGroup.rotation.z = Math.sin(performance.now() * 0.0015) * 0.003;
        const lowest = lowestBottomLocal();
        if (buildingGroup.position.y + lowest <= CFG.groundY) {
          buildingGroup.position.y = CFG.groundY - lowest;
          loseGame();
          return;
        }
      }

      if (state.charges < CFG.maxCharges) {
        state.chargeProgress += dt;
        if (state.chargeProgress >= CFG.chargeTime) {
          state.charges++;
          state.chargeProgress = 0;
          playCharge();
          updateHUD(true);
        }
      } else {
        state.chargeProgress = 0;
      }

      state.fireTimer -= dt;
      if (state.shooting && state.fireTimer <= 0) {
        shoot();
        state.fireTimer = CFG.fireInterval;
      }

      const clearance = buildingGroup
        ? buildingGroup.position.y + lowestBottomLocal() - CFG.groundY
        : 0;
      const near = clearance < 4.7;
      if (near !== state.dangerOn) {
        state.dangerOn = near;
        dom.danger.classList.toggle('on', near);
        if (near) sfxTone(440, 0.12, 0.05, 'square', 320);
      }
      return;
    }

    if (state.phase === 'collapsing' || state.phase === 'lost') {
      state.endTimer -= raw;
      if (state.endTimer <= 0) {
        showResult(state.phase === 'collapsing');
      }
    }
  }

  // ------------------------------------------------------------------ debris
  function updateDebris(dt) {
    const gy = CFG.groundY;
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      if (d.delay > 0) {
        d.delay -= dt;
        continue;
      }
      d.age += dt;
      d.vy -= 9.2 * dt;
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.mesh.rotation.x += d.ax * dt;
      d.mesh.rotation.y += d.ay * dt;
      d.mesh.rotation.z += d.az * dt;

      const floor = gy + (d.half || 0.55) * 0.55;
      if (d.mesh.position.y < floor) {
        d.mesh.position.y = floor;
        if (Math.abs(d.vy) > 2 && d.bounces < 2) {
          d.vy = -d.vy * 0.3;
          d.vx *= 0.72;
          d.vz *= 0.72;
          d.ax *= 0.6;
          d.ay *= 0.6;
          d.az *= 0.6;
          d.bounces++;
          if (state.phase !== 'over') {
            spawnDust(d.mesh.position, 1, 0.5, 1.2, 0x8e887f);
            playThud();
          }
        } else {
          d.vy = 0;
          d.vx *= 0.8;
          d.vz *= 0.8;
          d.ax *= 0.8;
          d.ay *= 0.8;
          d.az *= 0.8;
        }
      }

      if (d.age > 30 || Math.abs(d.mesh.position.x) > 46 || Math.abs(d.mesh.position.z) > 30) {
        scene.remove(d.mesh);
        debris.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------------ reset / start
  function startGame() {
    ensureAudio();
    resetGame();
    dom.startScreen.classList.add('hidden');
    dom.resultScreen.classList.add('hidden');
    dom.hud.classList.remove('hidden');
    document.body.classList.add('in-game');
    state.phase = 'playing';
    state.fallDelay = CFG.fallDelay;
    state.timeScale = 1;
    state.targetTimeScale = 1;
    state.fireTimer = 0;
    dom.crosshair.style.left = pointer.x + 'px';
    dom.crosshair.style.top = pointer.y + 'px';
    updateHUD(true);
  }

  function resetGame() {
    if (buildingGroup) {
      scene.remove(buildingGroup);
      buildingGroup = null;
    }
    for (const d of debris) scene.remove(d.mesh);
    debris.length = 0;

    for (const w of shockwaves) {
      scene.remove(w.mesh);
      w.mesh.geometry.dispose();
      w.mesh.material.dispose();
    }
    shockwaves.length = 0;

    for (const t of tracers) {
      t.life = 0;
      t.mesh.visible = false;
    }

    if (sparkSys) {
      const s = sparkSys;
      for (let i = 0; i < SPARK_MAX; i++) {
        s.life[i] = 0;
        s.pos[i * 3] = 0;
        s.pos[i * 3 + 1] = -999;
        s.pos[i * 3 + 2] = 0;
        s.col[i * 3] = 0;
        s.col[i * 3 + 1] = 0;
        s.col[i * 3 + 2] = 0;
      }
      s.points.geometry.attributes.position.needsUpdate = true;
      s.points.geometry.attributes.color.needsUpdate = true;
    }

    for (const d of dustPool) {
      d.life = 0;
      d.sprite.visible = false;
      d.sprite.material.opacity = 0;
    }

    dom.popups.innerHTML = '';
    popupCount = 0;
    dom.combo.classList.remove('on');
    dom.danger.classList.remove('on');
    dom.resultScreen.classList.add('hidden');
    dom.crosshair.classList.remove('hit');
    dom.flash.classList.remove('on');
    dom.flash.style.opacity = '0';
    dom.score.textContent = '0';
    dom.intPct.textContent = '100%';
    dom.intFill.style.width = '100%';
    lastScoreText = '0';
    lastPctText = '100%';

    blocks = [];
    targets = [];
    signObj = null;
    signGroup = null;
    state.score = 0;
    state.destroyed = 0;
    state.total = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.comboFlash = 0;
    state.fallVy = 0;
    state.fallDelay = CFG.fallDelay;
    state.charges = CFG.maxCharges;
    state.chargeProgress = 0;
    state.fireTimer = 0;
    state.shooting = false;
    state.timeScale = 1;
    state.targetTimeScale = 1;
    state.shake = 0;
    state.playTime = 0;
    state.endTimer = 0;
    state.dangerOn = false;
    state.win = false;
    state.recoil = 0;
    state.muzzle = 0;
    state.hurtPulse = 0;

    buildBuilding();
    updateHUD(true);
  }

  // ------------------------------------------------------------------ input
  function bindEvents() {
    window.addEventListener('resize', onResize);

    window.addEventListener(
      'pointermove',
      (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        dom.crosshair.style.left = e.clientX + 'px';
        dom.crosshair.style.top = e.clientY + 'px';
      },
      { passive: true }
    );

    dom.canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      if (state.phase !== 'playing') return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      dom.crosshair.style.left = e.clientX + 'px';
      dom.crosshair.style.top = e.clientY + 'px';
      ensureAudio();
      state.shooting = true;
      state.fireTimer = 0;
      shoot();
      state.fireTimer = CFG.fireInterval;
      e.preventDefault();
    });

    window.addEventListener('pointerup', () => {
      state.shooting = false;
    });
    window.addEventListener('pointercancel', () => {
      state.shooting = false;
    });
    window.addEventListener('blur', () => {
      state.shooting = false;
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (state.phase === 'playing') bounce();
        else if (state.phase === 'over') startGame();
      } else if (e.code === 'KeyR') {
        if (state.phase === 'over' || state.phase === 'playing') {
          ensureAudio();
          playUi();
          startGame();
        }
      } else if (e.code === 'KeyM') {
        toggleMute();
      }
    });

    dom.startBtn.addEventListener('click', () => {
      ensureAudio();
      playUi();
      startGame();
    });
    dom.restartBtn.addEventListener('click', () => {
      ensureAudio();
      playUi();
      startGame();
    });

    dom.bounceUI.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.phase === 'playing') bounce();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) state.shooting = false;
    });
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    pointer.x = clamp(pointer.x, 0, innerWidth);
    pointer.y = clamp(pointer.y, 0, innerHeight);
    dom.crosshair.style.left = pointer.x + 'px';
    dom.crosshair.style.top = pointer.y + 'px';
  }

  function toggleMute() {
    state.muted = !state.muted;
    if (masterGain) masterGain.gain.value = state.muted ? 0 : 0.5;
    createPopup(
      state.muted ? '음소거' : '소리 켜짐',
      innerWidth / 2,
      innerHeight * 0.88,
      ''
    );
  }

  // ------------------------------------------------------------------ debug hook
  window.__SIA = {
    state,
    get blocks() {
      return blocks;
    },
    get targets() {
      return targets;
    },
    get building() {
      return buildingGroup;
    },
    get camera() {
      return camera;
    },
    startGame,
    resetGame,
    bounce,
    shoot,
    triggerCollapse,
    loseGame,
    showResult,
  };

  init();
})();
