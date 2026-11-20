(function (global) {
  'use strict';

  const { clamp, lerp } = M3;
  const GRID_MIN = World.GRID_MIN;
  const GRID_MAX = World.GRID_MAX;

  const HOP_TIME = 0.135;
  const HOP_HEIGHT = 0.62;
  const FOV = 38;

  const C = {
    grass: ['#7ac74d', '#78c54b', '#7dca50', '#76c349'].map(M3.hex),
    tuft: M3.hex('#65b13f'),
    hedge: ['#4d9b39', '#57a842'].map(M3.hex),
    hedgeTop: M3.hex('#68bd4f'),
    road: ['#4a4f57', '#484d55', '#4c5159'].map(M3.hex),
    line: M3.hex('#dde5ea'),
    trunk: M3.hex('#8b6242'),
    leaves: ['#3f9b45', '#49a94f', '#35893d', '#43a24b'].map(M3.hex),
    rock: ['#98a2ab', '#8a949d'].map(M3.hex),
    glass: M3.hex('#37424e'),
    wheel: M3.hex('#252b32'),
    light: M3.hex('#ffe9a8'),
    shadow: [0.05, 0.12, 0.08],
    container: M3.hex('#dfe6ec'),
  };

  const CHARACTERS = {
    water: {
      body: M3.hex('#46a9f2'),
      dark: M3.hex('#2f86c9'),
      belly: M3.hex('#c6ecff'),
      white: M3.hex('#ffffff'),
      pupil: M3.hex('#22303d'),
      crest: M3.hex('#9fe6ff'),
      crest2: M3.hex('#d8f7ff'),
      dust: M3.hex('#a9e3ff'),
    },
    fire: {
      body: M3.hex('#ff7b3f'),
      dark: M3.hex('#d8562a'),
      belly: M3.hex('#ffd8a6'),
      white: M3.hex('#fff8ee'),
      pupil: M3.hex('#3a2114'),
      crest: M3.hex('#ffd23f'),
      crest2: M3.hex('#ffe98a'),
      dust: M3.hex('#ffc08a'),
    },
  };

  const SUN_RAW = [0.38, 0.9, 0.52];
  const SUN_LEN = Math.hypot(SUN_RAW[0], SUN_RAW[1], SUN_RAW[2]);

  const ENV = {
    fog: M3.hex('#e7f3fa'),
    skyTop: M3.hex('#79c2ee'),
    skyBottom: M3.hex('#e7f3fa'),
    sun: [SUN_RAW[0] / SUN_LEN, SUN_RAW[1] / SUN_LEN, SUN_RAW[2] / SUN_LEN],
    fogNear: 20,
    fogFar: 46,
  };

  class CrossingGame {
    constructor(renderer, options) {
      options = options || {};
      this.renderer = renderer;
      this.audio = options.audio || null;
      this.onScore = options.onScore || function () {};
      this.onDeath = options.onDeath || function () {};
      this.onStart = options.onStart || function () {};
      this.onBest = options.onBest || function () {};
      this.best = options.best || 0;

      this.state = 'title';
      this.character = 'water';
      this.time = 0;
      this.shake = 0;
      this.held = [];
      this.particles = [];
      this.dyingTimer = 0;
      this.eye = [0, 0, 0];
      this.target = [0, 0, 0];

      this.resetRun();
      this.snapCamera();
    }

    resetRun() {
      this.world = new World((Math.random() * 0x7fffffff) | 0);
      this.player = {
        gx: 0,
        row: 0,
        x: 0,
        z: 0,
        hop: null,
        hopHeight: 0,
        maxRow: 0,
        cooldown: 0,
        landT: 0,
      };
      this.particles.length = 0;
      this.dyingTimer = 0;
      this.shake = 0;
      this.held.length = 0;
      this.world.ensure(52);
    }

    setCharacter(name) {
      if (CHARACTERS[name]) this.character = name;
    }

    startFromTitle() {
      if (this.state !== 'title') return;
      this.state = 'playing';
      this.player.maxRow = 0;
      this.onScore(0, this.best);
      this.onStart();
      if (this.audio) this.audio.start();
    }

    restart() {
      if (this.state === 'title') return;
      this.resetRun();
      this.state = 'playing';
      this.snapCamera();
      this.onScore(0, this.best);
      this.onStart();
      if (this.audio) this.audio.start();
    }

    setHeld(dir, down) {
      const index = this.held.indexOf(dir);
      if (down) {
        if (index !== -1) this.held.splice(index, 1);
        this.held.push(dir);
      } else if (index !== -1) {
        this.held.splice(index, 1);
      }
    }

    clearHeld() {
      this.held.length = 0;
    }

    swipe(dir) {
      if (this.state === 'playing') this.tryHop(dir);
    }

    tryHop(dir) {
      const p = this.player;
      if (p.hop) return false;

      let nx = p.gx;
      let nr = p.row;
      if (dir === 'up') nr += 1;
      else if (dir === 'down') nr -= 1;
      else if (dir === 'left') nx -= 1;
      else if (dir === 'right') nx += 1;
      else return false;

      if (nx < GRID_MIN || nx > GRID_MAX || nr < 0) return false;
      if (this.world.isBlocked(nr, nx)) return false;

      p.hop = {
        fx: p.x,
        fz: p.z,
        tx: nx,
        tz: -nr,
        gx: nx,
        row: nr,
        t: 0,
      };
      p.cooldown = 0;
      p.landT = 0;
      if (this.audio) this.audio.hop();
      return true;
    }

    update(dt) {
      this.time += dt;
      this.world.updateCars(dt, this.player.row);
      this.updateParticles(dt);

      this.shake *= Math.exp(-4.2 * dt);
      if (this.shake < 0.002) this.shake = 0;

      if (this.state === 'playing') {
        this.world.ensure(this.player.row + 52);
        this.updatePlayer(dt);
        const car = this.world.hitTest(this.player.x, this.player.z);
        if (car) this.die(car);
      } else if (this.state === 'dying') {
        this.dyingTimer -= dt;
        if (this.dyingTimer <= 0) {
          this.resetRun();
          this.state = 'playing';
          this.snapCamera();
          this.onScore(0, this.best);
          this.onStart();
        }
      }

      this.updateCamera(dt);
    }

    updatePlayer(dt) {
      const p = this.player;

      if (p.hop) {
        const hop = p.hop;
        hop.t += dt;
        const k = Math.min(1, hop.t / HOP_TIME);
        p.x = lerp(hop.fx, hop.tx, k);
        p.z = lerp(hop.fz, hop.tz, k);
        p.hopHeight = Math.sin(k * Math.PI) * HOP_HEIGHT;

        if (k >= 1) {
          p.x = hop.tx;
          p.z = hop.tz;
          p.gx = hop.gx;
          p.row = hop.row;
          p.hop = null;
          p.hopHeight = 0;
          p.cooldown = 0.025;
          p.landT = 0.13;
          this.spawnDust();
          if (p.row > p.maxRow) {
            p.maxRow = p.row;
            this.handleScore();
          }
        }
        return;
      }

      if (p.landT > 0) p.landT = Math.max(0, p.landT - dt);
      if (p.cooldown > 0) p.cooldown -= dt;
      if (p.cooldown <= 0 && this.held.length) {
        this.tryHop(this.held[this.held.length - 1]);
      }
    }

    handleScore() {
      const score = this.player.maxRow;
      if (score > this.best) {
        this.best = score;
        this.onBest(this.best);
      }
      this.onScore(score, this.best);
    }

    die() {
      if (this.state !== 'playing') return;
      this.state = 'dying';
      this.dyingTimer = 1.25;
      this.shake = 0.55;
      this.spawnBurst();
      if (this.audio) this.audio.death();
      this.onDeath(this.player.maxRow, this.best);
    }

    updateParticles(dt) {
      const list = this.particles;
      for (let i = list.length - 1; i >= 0; i--) {
        const pt = list[i];
        pt.life -= dt;
        if (pt.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        pt.vy -= 17 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.z += pt.vz * dt;
        if (pt.y < 0.05) {
          pt.y = 0.05;
          pt.vy *= -0.32;
          pt.vx *= 0.68;
          pt.vz *= 0.68;
        }
      }
    }

    spawnDust() {
      const p = this.player;
      const pal = CHARACTERS[this.character];
      for (let i = 0; i < 4; i++) {
        const angle = Math.random() * Math.PI * 2;
        const life = 0.28 + Math.random() * 0.14;
        this.particles.push({
          x: p.x + Math.cos(angle) * 0.24,
          y: 0.07,
          z: p.z + Math.sin(angle) * 0.2,
          vx: Math.cos(angle) * 0.5,
          vy: 0.55 + Math.random() * 0.5,
          vz: Math.sin(angle) * 0.35,
          size: 0.05 + Math.random() * 0.06,
          color: pal.dust,
          life,
          maxLife: life,
        });
      }
    }

    spawnBurst() {
      const p = this.player;
      const pal = CHARACTERS[this.character];
      const extras = [pal.body, pal.belly, pal.crest, M3.hex('#ffffff')];
      for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.1 + Math.random() * 3.1;
        const life = 0.55 + Math.random() * 0.4;
        this.particles.push({
          x: p.x + (Math.random() - 0.5) * 0.4,
          y: 0.4 + Math.random() * 0.6,
          z: p.z + (Math.random() - 0.5) * 0.3,
          vx: Math.cos(angle) * speed,
          vy: 2 + Math.random() * 3.8,
          vz: Math.sin(angle) * speed * 0.6,
          size: 0.1 + Math.random() * 0.16,
          color: extras[i % extras.length],
          life,
          maxLife: life,
        });
      }
    }

    cameraGoal() {
      const p = this.player;
      if (this.state === 'title') {
        return {
          eye: [p.x, 5.4, p.z + 5.3],
          target: [p.x, 1.0, p.z - 1.4],
        };
      }
      return {
        eye: [p.x * 0.94, 8.8, p.z + 6.5],
        target: [p.x * 0.94, 0.6, p.z - 2.6],
      };
    }

    snapCamera() {
      const goal = this.cameraGoal();
      this.eye[0] = goal.eye[0];
      this.eye[1] = goal.eye[1];
      this.eye[2] = goal.eye[2];
      this.target[0] = goal.target[0];
      this.target[1] = goal.target[1];
      this.target[2] = goal.target[2];
    }

    updateCamera(dt) {
      const goal = this.cameraGoal();
      const k = 1 - Math.exp(-9 * dt);
      for (let i = 0; i < 3; i++) {
        this.eye[i] = lerp(this.eye[i], goal.eye[i], k);
        this.target[i] = lerp(this.target[i], goal.target[i], k);
      }
    }

    draw() {
      const r = this.renderer;
      r.reset();
      this.drawWorld(r);
      if (this.state !== 'dying') this.drawPlayer(r);
      this.drawParticles(r);

      const t = this.time;
      let eyeX = this.eye[0];
      let eyeY = this.eye[1];
      let eyeZ = this.eye[2];
      let tgtX = this.target[0];
      let tgtY = this.target[1];
      let tgtZ = this.target[2];

      if (this.shake > 0.002) {
        const s = this.shake;
        eyeX += Math.sin(t * 57.3) * s * 0.16;
        eyeY += Math.sin(t * 43.1 + 1.3) * s * 0.13;
        eyeZ += Math.sin(t * 49.7 + 0.6) * s * 0.1;
        tgtX += Math.sin(t * 61.1 + 0.4) * s * 0.24;
        tgtY += Math.sin(t * 37.7) * s * 0.12;
      }

      r.render(
        { eye: [eyeX, eyeY, eyeZ], target: [tgtX, tgtY, tgtZ], fov: FOV },
        ENV
      );
    }

    drawWorld(r) {
      const p = this.player;
      const top = Math.ceil(p.row) + 40;
      this.world.ensure(top + 2);

      // Grass apron behind the start line so the camera never sees past the world.
      r.box(0, -0.16, 11.5, 44, 0.32, 22, C.grass[0]);
      const apronTufts = [
        [-4.6, 1.2], [-2.1, 2.8], [3.4, 1.6], [5.8, 4.2], [-5.7, 5.6], [1.1, 6.4], [6.2, 8.1], [-3.2, 9.4],
      ];
      for (let i = 0; i < apronTufts.length; i++) {
        r.box(apronTufts[i][0], 0.05, apronTufts[i][1], 0.09, 0.1, 0.09, C.tuft);
      }

      const from = Math.max(0, Math.floor(p.row) - 12);
      for (let row = from; row <= top; row++) {
        const data = this.world.get(row);
        if (!data) continue;
        if (data.type === 'grass') this.drawGrassRow(r, data);
        else this.drawRoadRow(r, data);
      }
    }

    drawGrassRow(r, row) {
      const base = C.grass[Math.floor(row.tone * C.grass.length)];
      r.box(0, -0.16, row.z, 44, 0.32, 1, base);

      for (let i = 0; i < row.tufts.length; i++) {
        const tuft = row.tufts[i];
        r.box(tuft.x, tuft.size * 0.5, row.z + tuft.z, tuft.size * 0.9, tuft.size, tuft.size * 0.9, C.tuft);
      }

      const hedge = C.hedge[Math.floor(row.tone * C.hedge.length)];
      r.box(-7.45, 0.38, row.z, 1.05, 0.76, 1.02, hedge);
      r.box(7.45, 0.38, row.z, 1.05, 0.76, 1.02, hedge);
      r.box(-7.45, 0.78, row.z, 1.0, 0.06, 0.98, C.hedgeTop);
      r.box(7.45, 0.78, row.z, 1.0, 0.06, 0.98, C.hedgeTop);

      for (let i = 0; i < row.trees.length; i++) {
        this.drawTree(r, row, row.trees[i]);
      }
    }

    drawTree(r, row, tree) {
      const x = tree.x;
      const z = row.z;
      const leaf = C.leaves[Math.floor(tree.tone * C.leaves.length)];

      r.box(x, 0.03, z, 0.94, 0.02, 0.82, C.shadow, 0.18);

      if (tree.kind === 'rock') {
        const rock = C.rock[Math.floor(tree.tone * C.rock.length)];
        r.box(x, 0.2, z, 0.68, 0.4, 0.6, rock);
        r.box(x - 0.08, 0.44, z + 0.02, 0.38, 0.24, 0.34, C.rock[(Math.floor(tree.tone * 7) + 1) % 2]);
        return;
      }

      if (tree.kind === 'bush') {
        r.box(x, 0.24, z, 0.86, 0.48, 0.8, leaf);
        r.box(x + 0.22, 0.38, z - 0.1, 0.5, 0.36, 0.5, C.leaves[(Math.floor(tree.tone * 7) + 1) % C.leaves.length]);
        return;
      }

      const height = 0.95 + tree.tone * 0.35;
      r.box(x, height * 0.5, z, 0.24, height, 0.24, C.trunk);
      r.box(x, height + 0.2, z, 1.0, 0.4, 1.0, leaf);
      r.box(x, height + 0.5, z, 0.74, 0.32, 0.74, C.leaves[(Math.floor(tree.tone * 7) + 1) % C.leaves.length]);
      r.box(x, height + 0.74, z, 0.44, 0.24, 0.44, leaf);
    }

    drawRoadRow(r, row) {
      const base = C.road[Math.floor(row.tone * C.road.length)];
      r.box(0, -0.16, row.z, 44, 0.32, 1, base);

      const prev = this.world.get(row.r - 1);
      const next = this.world.get(row.r + 1);

      if (!prev || prev.type !== 'road') this.drawRoadLine(r, row.z + 0.5, false);
      if (!next || next.type !== 'road') this.drawRoadLine(r, row.z - 0.5, false);
      else this.drawRoadLine(r, row.z - 0.5, true);

      for (let i = 0; i < row.cars.length; i++) {
        const car = row.cars[i];
        if (Math.abs(car.x) < 15) this.drawCar(r, row, car);
      }
    }

    drawRoadLine(r, z, dashed) {
      if (dashed) {
        for (let x = -9.8; x <= 9.8; x += 2.8) {
          r.box(x, 0.014, z, 1.35, 0.028, 0.07, C.line);
        }
      } else {
        r.box(0, 0.014, z, 44, 0.028, 0.06, C.line);
      }
    }

    drawCar(r, row, car) {
      const x = car.x;
      const z = row.z;
      const dir = row.dir;
      const len = car.len;
      const color = M3.hex(car.color);
      const bodyColor = car.truck ? M3.mix(color, C.container, 0.4) : color;

      r.box(x, 0.03, z, len * 1.11, 0.02, 1.0, C.shadow, 0.09);
      r.box(x, 0.033, z, len * 0.96, 0.02, 0.83, C.shadow, 0.14);

      const wheelX = len * 0.3;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          r.box(x + sx * wheelX, 0.16, z + sz * 0.41, 0.34, 0.3, 0.12, C.wheel);
        }
      }

      if (car.truck) {
        r.box(x - dir * len * 0.12, 0.87, z, len * 0.68, 1.04, 0.9, bodyColor);
        r.box(x - dir * len * 0.12, 1.4, z, len * 0.66, 0.05, 0.86, M3.mix(bodyColor, C.shadow, 0.24));
        r.box(x + dir * len * 0.34, 0.63, z, len * 0.3, 0.6, 0.9, color);
        r.box(x + dir * len * 0.34, 0.72, z + 0.44, len * 0.2, 0.24, 0.04, C.glass);
        r.box(x + dir * (len * 0.47), 0.42, z + 0.26, 0.08, 0.13, 0.16, C.light);
        r.box(x + dir * (len * 0.47), 0.42, z - 0.26, 0.08, 0.13, 0.16, C.light);
      } else {
        r.box(x, 0.48, z, len, 0.4, 0.82, color);
        r.box(x - dir * 0.04, 0.8, z, len * 0.5, 0.3, 0.76, C.glass);
        r.box(x - dir * 0.04, 0.98, z, len * 0.46, 0.06, 0.72, color);
        r.box(x + dir * (len * 0.47), 0.44, z + 0.25, 0.08, 0.12, 0.15, C.light);
        r.box(x + dir * (len * 0.47), 0.44, z - 0.25, 0.08, 0.12, 0.15, C.light);
      }
    }

    drawPlayer(r) {
      const p = this.player;
      const pal = CHARACTERS[this.character];
      const hop = p.hopHeight;
      const gait = p.hop ? Math.sin(clamp(p.hop.t / HOP_TIME, 0, 1) * Math.PI) : 0;
      const idle = Math.sin(this.time * 3.1) * 0.014;

      const shadowScale = 1 - Math.min(0.44, hop * 0.5);
      r.box(p.x, 0.03, p.z, 1.06 * shadowScale, 0.02, 0.82 * shadowScale, C.shadow, 0.1);
      r.box(p.x, 0.033, p.z, 0.82 * shadowScale, 0.02, 0.6 * shadowScale, C.shadow, 0.16);

      const y = hop + idle;
      const land = p.landT > 0 ? p.landT / 0.13 : 0;
      const stretch = (1 + gait * 0.08) * (1 - land * 0.16);
      const squash = (1 - gait * 0.045) * (1 + land * 0.13);
      const headDrop = land * 0.03;

      // feet
      r.box(p.x - 0.15, 0.08 + y, p.z + 0.03, 0.18, 0.14, 0.3, pal.dark);
      r.box(p.x + 0.15, 0.08 + y, p.z + 0.03, 0.18, 0.14, 0.3, pal.dark);

      // body
      r.box(p.x, 0.37 + y, p.z, 0.58 * squash, 0.46 * stretch, 0.5, pal.body);
      r.box(p.x, 0.33 + y, p.z + 0.26, 0.32, 0.24, 0.04, pal.belly);

      // arms
      r.box(p.x - 0.34, 0.43 + y, p.z + 0.02, 0.13, 0.22, 0.28, pal.dark);
      r.box(p.x + 0.34, 0.43 + y, p.z + 0.02, 0.13, 0.22, 0.28, pal.dark);

      // head
      r.box(p.x, 0.82 + y - headDrop, p.z + 0.02, 0.5 * squash, 0.42 * stretch, 0.46, pal.body);

      // eyes
      const ex = 0.12;
      const ey = 0.85 + y - headDrop;
      const ez = 0.25;
      r.box(p.x - ex, ey, ez, 0.11, 0.13, 0.04, pal.white);
      r.box(p.x + ex, ey, ez, 0.11, 0.13, 0.04, pal.white);
      r.box(p.x - ex + 0.01, ey - 0.015, ez + 0.026, 0.055, 0.07, 0.02, pal.pupil);
      r.box(p.x + ex + 0.01, ey - 0.015, ez + 0.026, 0.055, 0.07, 0.02, pal.pupil);

      // elemental crest
      if (this.character === 'water') {
        r.box(p.x, 1.1 + y, p.z + 0.01, 0.2, 0.16, 0.2, pal.crest);
        r.box(p.x, 1.22 + y, p.z + 0.01, 0.12, 0.12, 0.12, pal.crest2);
        r.box(p.x, 1.3 + y, p.z + 0.01, 0.06, 0.08, 0.06, pal.crest);
      } else {
        r.box(p.x, 1.1 + y, p.z + 0.01, 0.2, 0.14, 0.2, pal.crest);
        r.box(p.x, 1.21 + y, p.z + 0.01, 0.15, 0.14, 0.15, pal.crest2);
        r.box(p.x, 1.32 + y, p.z + 0.01, 0.09, 0.14, 0.09, pal.crest);
      }
    }

    drawParticles(r) {
      const list = this.particles;
      for (let i = 0; i < list.length; i++) {
        const pt = list[i];
        const alpha = clamp(pt.life / pt.maxLife, 0, 1);
        r.box(pt.x, pt.y, pt.z, pt.size, pt.size, pt.size, pt.color, alpha * 0.96);
      }
    }
  }

  global.CrossingGame = CrossingGame;
})(window);