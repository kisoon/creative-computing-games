/* =========================================================================
   game.js — 플레이어 물리, 상호작용, 스테이지 상태
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const LEVEL = EG.LEVEL;
  const PHYS = EG.PHYS;
  const FLOOR_Y = EG.FLOOR_Y;
  if (!EG.keys) EG.keys = new Set();

  // -------------------------------------------------------------------------
  // 플레이어
  // -------------------------------------------------------------------------
  class Player {
    constructor(element) {
      this.element = element;
      this.data = EG.ELEMENTS[element];
      this.w = EG.PLAYER_W;
      this.h = EG.PLAYER_H;
      this.controls =
        element === "water"
          ? { left: "KeyA", right: "KeyD", jump: "KeyW" }
          : { left: "ArrowLeft", right: "ArrowRight", jump: "ArrowUp" };
      this.spawn = LEVEL.spawns[element];
      this.resetPosition(true);
    }

    resetPosition(initial = false) {
      this.x = this.spawn.x - this.w / 2;
      this.y = this.spawn.y - this.h;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.grounded = true;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = 0;
      this.runPhase = 0;
      this.animTime = 0;
      this.emitTimer = 0;
      this.alive = true;
      this.arrived = false;
      this.arrivedTime = 0;
      this.deathTimer = 0;
      this.spawnGrace = initial ? 0.25 : 0.72;
      this.justLanded = 0;
    }

    tryJump() {
      if (!this.alive || this.arrived) return;
      this.jumpBuffer = PHYS.jumpBufferTime;
    }

    isInOwnPool() {
      for (const pool of LEVEL.pools) {
        if (pool.type !== this.element) continue;
        if (EG.overlaps(this, pool)) return true;
      }
      return false;
    }

    solids() {
      const result = LEVEL.solids.slice();
      if (!game.gate.open) result.push(LEVEL.gate.block);
      return result;
    }

    update(dt) {
      this.animTime += dt;
      this.spawnGrace = Math.max(0, this.spawnGrace - dt);
      this.justLanded = Math.max(0, this.justLanded - dt);

      if (!this.alive) {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.respawn();
        return;
      }

      if (this.arrived) {
        this.arrivedTime += dt;
        return;
      }

      const left = EG.keys.has(this.controls.left);
      const right = EG.keys.has(this.controls.right);
      const jumpHeld = EG.keys.has(this.controls.jump);
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      const inPool = this.isInOwnPool();
      const speedCap = PHYS.maxSpeed * (inPool ? PHYS.poolSpeed : 1);

      if (dir !== 0) {
        const accel = this.grounded
          ? PHYS.groundAccel * (inPool ? 0.84 : 1)
          : PHYS.airAccel;
        this.vx = EG.approach(this.vx, dir * speedCap, accel * dt);
        this.facing = dir;
      } else {
        const friction = this.grounded
          ? PHYS.groundFriction * (inPool ? 1.35 : 1)
          : PHYS.airFriction;
        this.vx = EG.approach(this.vx, 0, friction * dt);
      }

      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.coyote = Math.max(0, this.coyote - dt);

      if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
        this.vy = -PHYS.jumpSpeed;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.squash = -0.22;
        this.emitJumpBurst(inPool);
        EG.sfx.jump(this.element);
      }

      let gravity = PHYS.gravity;
      if (this.vy < 0 && !jumpHeld) gravity *= PHYS.lowJumpGravity;
      this.vy = Math.min(this.vy + gravity * dt, PHYS.maxFall);

      this.moveX(dt);
      this.moveY(dt);

      if (this.grounded) {
        this.coyote = PHYS.coyoteTime;
        if (Math.abs(this.vx) > 24) {
          this.runPhase += Math.abs(this.vx) * dt * 0.062;
        }
      }

      this.emitAmbient(dt, inPool);
      this.squash = EG.approach(this.squash, 0, dt * 1.25);

      if (this.checkHazard()) return;
      this.checkExit();
    }

    moveX(dt) {
      this.x += this.vx * dt;
      for (const solid of this.solids()) {
        if (!EG.overlaps(this, solid)) continue;
        if (this.vx > 0) this.x = solid.x - this.w;
        else if (this.vx < 0) this.x = solid.x + solid.w;
        this.vx = 0;
      }
    }

    moveY(dt) {
      const wasGrounded = this.grounded;
      const fallingSpeed = this.vy;
      this.y += this.vy * dt;
      this.grounded = false;

      for (const solid of this.solids()) {
        if (!EG.overlaps(this, solid)) continue;
        if (this.vy > 0) {
          this.y = solid.y - this.h;
          this.vy = 0;
          this.grounded = true;
          if (!wasGrounded && fallingSpeed > 190) this.onLand(fallingSpeed);
        } else if (this.vy < 0) {
          this.y = solid.y + solid.h;
          this.vy = 0;
        }
      }
    }

    onLand(speed) {
      const power = EG.clamp((speed - 180) / 760, 0, 1);
      this.squash = Math.max(this.squash, 0.12 + power * 0.15);
      this.justLanded = 0.16;
      EG.sfx.land(this.element);

      const feetX = this.x + this.w / 2;
      for (let i = 0; i < 5; i++) {
        EG.fx.add({
          x: feetX + (Math.random() - 0.5) * 30,
          y: FLOOR_Y - 2,
          vx: (Math.random() - 0.5) * 100,
          vy: -20 - Math.random() * 45,
          life: 0.22 + Math.random() * 0.2,
          size: 1.2 + Math.random() * 2,
          color: this.data.color,
          gravity: 240,
          drag: 0.95,
          additive: true,
          glow: 5,
        });
      }
    }

    emitJumpBurst(inPool) {
      const feetX = this.x + this.w / 2;
      const feetY = this.y + this.h;
      EG.fx.ring(feetX, feetY - 2, this.data.color, 34, 0.4, 2.5);
      for (let i = 0; i < (inPool ? 12 : 6); i++) {
        EG.fx.add({
          x: feetX + (Math.random() - 0.5) * 26,
          y: feetY - 2,
          vx: (Math.random() - 0.5) * 180,
          vy: -30 - Math.random() * 130,
          life: 0.26 + Math.random() * 0.3,
          size: 1.5 + Math.random() * 2.5,
          color: this.data.color,
          gravity: 420,
          drag: 0.96,
          additive: true,
          glow: 7,
        });
      }
    }

    emitAmbient(dt, inPool) {
      this.emitTimer -= dt;
      if (this.emitTimer > 0) return;
      const moving = Math.abs(this.vx) > 40;
      this.emitTimer = (moving ? 0.075 : 0.2) + Math.random() * 0.08;
      const cx = this.x + this.w / 2;
      const feetY = this.y + this.h;

      if (this.element === "water") {
        EG.fx.add({
          x: cx + (Math.random() - 0.5) * 30,
          y: feetY - 8 - Math.random() * 32,
          vx: -this.facing * (10 + Math.random() * 32),
          vy: -12 - Math.random() * 42,
          life: 0.38 + Math.random() * 0.4,
          size: 1.2 + Math.random() * 2.9,
          color: Math.random() > 0.25 ? "#8ff4ff" : "#3ebcff",
          gravity: inPool ? -32 : 70,
          drag: 0.96,
          additive: true,
          glow: 5,
        });
      } else {
        EG.fx.add({
          x: cx + (Math.random() - 0.5) * 26,
          y: feetY - 14 - Math.random() * 36,
          vx: (Math.random() - 0.5) * 42,
          vy: -30 - Math.random() * 70,
          life: 0.3 + Math.random() * 0.38,
          size: 1 + Math.random() * 2.4,
          color: Math.random() > 0.35 ? "#ffc66e" : "#ff743c",
          gravity: -18,
          drag: 0.97,
          additive: true,
          glow: 7,
        });
      }
    }

    checkHazard() {
      if (this.spawnGrace > 0) return false;
      for (const pool of LEVEL.pools) {
        if (pool.type === this.element) continue;
        const touching =
          this.x + 4 < pool.x + pool.w &&
          this.x + this.w - 4 > pool.x &&
          this.y + this.h > pool.y + 3;
        if (touching) {
          this.die(pool.type);
          return true;
        }
      }
      return false;
    }

    checkExit() {
      if (!game.gate.open) return;
      for (const exit of LEVEL.exits) {
        if (exit.element !== this.element) continue;
        const cx = this.x + this.w / 2;
        const insideX =
          cx > exit.x - exit.w / 2 + 3 && cx < exit.x + exit.w / 2 - 3;
        if (insideX && this.y + this.h >= FLOOR_Y - 8) {
          this.arrive(exit);
          return;
        }
      }
    }

    die(sourceType) {
      if (!this.alive || this.arrived) return;
      this.alive = false;
      this.deathTimer = 1.12;
      this.vx = 0;
      this.vy = 0;

      game.deaths += 1;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      const data = this.data;

      const message =
        this.element === "water"
          ? "물은 불에 닿으면 증발해요!"
          : "불은 물에 닿으면 꺼져요!";
      game.showToast(message, "잠시 후 시작 지점에서 다시 시작합니다", data.color, 2.2);

      EG.fx.burst(cx, cy, data.color, 26, {
        spread: 220,
        size: 3.2,
        life: 0.65,
        gravity: 280,
        glow: 10,
      });
      EG.fx.burst(cx, cy, "#ffffff", 10, {
        spread: 110,
        size: 1.7,
        life: 0.42,
        gravity: 50,
        glow: 8,
      });
      EG.fx.ring(cx, cy, data.color, 70, 0.6, 3);
      EG.fx.screenFlash(sourceType === "fire" ? "#ffb15a" : "#63e8ff", 0.09);
      EG.fx.shake = 8;
      EG.sfx.death();
    }

    respawn() {
      this.resetPosition(false);
      const cx = this.x + this.w / 2;
      EG.fx.ring(cx, FLOOR_Y - 2, this.data.color, 46, 0.5, 2.5);
      EG.fx.burst(cx, FLOOR_Y - 24, this.data.color, 13, {
        spread: 120,
        size: 2.2,
        life: 0.42,
        gravity: -30,
        glow: 8,
      });
    }

    arrive(exit) {
      if (!this.alive || this.arrived) return;
      this.arrived = true;
      this.arrivedTime = 0;
      this.vx = 0;
      this.vy = 0;
      this.x = exit.x - this.w / 2;
      this.y = FLOOR_Y - this.h;
      game.onPlayerArrive(this, exit);
    }
  }

  EG.Player = Player;

  // -------------------------------------------------------------------------
  // 스테이지 / 게임 상태
  // -------------------------------------------------------------------------
  const game = {
    state: "playing",
    time: 0,
    elapsed: 0,
    deaths: 0,
    players: [],
    gate: {
      open: false,
      progress: 0,
      glow: 0,
    },
    plates: [],
    toast: null,
    winTimer: 0,
    finishTime: 0,
    poolEmitTimer: 0,

    reset() {
      this.state = "playing";
      this.time = 0;
      this.elapsed = 0;
      this.deaths = 0;
      this.winTimer = 0;
      this.finishTime = 0;
      this.poolEmitTimer = 0;
      this.toast = null;
      this.gate = { open: false, progress: 0, glow: 0 };
      this.plates = LEVEL.plateList.map((plate) => ({
        ...plate,
        active: false,
        justPressed: false,
        solved: false,
        pulse: 0,
      }));
      this.players = [new Player("water"), new Player("fire")];
      EG.fx.clear();
    },

    emitPoolAmbient(dt) {
      this.poolEmitTimer -= dt;
      if (this.poolEmitTimer > 0) return;
      this.poolEmitTimer = 0.11 + Math.random() * 0.09;

      for (const pool of LEVEL.pools) {
        const x = pool.x + 14 + Math.random() * (pool.w - 28);
        const isFire = pool.type === "fire";
        EG.fx.add({
          x,
          y: pool.y - 1,
          vx: (Math.random() - 0.5) * (isFire ? 26 : 12),
          vy: -14 - Math.random() * (isFire ? 44 : 24),
          life: 0.55 + Math.random() * 0.55,
          size: 0.8 + Math.random() * (isFire ? 1.9 : 1.4),
          color: isFire
            ? Math.random() > 0.35
              ? "#ffc06a"
              : "#ff6836"
            : Math.random() > 0.4
              ? "#bff9ff"
              : "#54d9ff",
          gravity: isFire ? -10 : -26,
          drag: 0.97,
          additive: true,
          glow: isFire ? 7 : 5,
        });
      }
    },

    update(dt) {
      this.time += dt;
      EG.fx.update(dt);
      this.emitPoolAmbient(dt);

      if (this.toast) {
        this.toast.life -= dt;
        if (this.toast.life <= 0) this.toast = null;
      }

      for (const plate of this.plates) {
        plate.pulse += dt;
      }

      this.gate.glow += dt;
      if (this.gate.open) {
        this.gate.progress = Math.min(1, this.gate.progress + dt / 0.9);
      }

      if (this.state === "playing") {
        this.elapsed += dt;
        for (const player of this.players) player.update(dt);
        this.updatePlates();
      } else if (this.state === "won") {
        this.winTimer += dt;
      }
    },

    updatePlates() {
      const wasOpen = this.gate.open;

      for (const plate of this.plates) {
        const player = this.players.find((p) => p.element === plate.element);
        const cx = player.x + player.w / 2;
        const wasActive = plate.active;
        plate.active =
          !this.gate.open &&
          player.alive &&
          !player.arrived &&
          player.grounded &&
          Math.abs(cx - plate.x) < 32;

        plate.justPressed = plate.active && !wasActive;
        if (plate.justPressed) {
          plate.pulse = 0;
          EG.fx.ring(plate.x, FLOOR_Y - 4, EG.ELEMENTS[plate.element].color, 62, 0.6, 3);
          EG.fx.burst(plate.x, FLOOR_Y - 12, EG.ELEMENTS[plate.element].color, 12, {
            spread: 110,
            size: 2.4,
            life: 0.5,
            gravity: -80,
            glow: 8,
          });
          EG.sfx.plate();
        }
      }

      const allActive = this.plates.every((plate) => plate.active);
      if (!wasOpen && allActive) this.openGate();
      if (this.gate.open) {
        for (const plate of this.plates) {
          plate.solved = true;
          plate.active = false;
        }
      }
    },

    openGate() {
      this.gate.open = true;
      this.gate.progress = 0;
      this.showToast(
        "봉인이 해제되었습니다!",
        "이제 각자의 출구로 향하세요",
        "#ffe7a4",
        2.7,
      );

      const gateX = LEVEL.gate.x + LEVEL.gate.w / 2;
      EG.fx.screenFlash("#fff3c9", 0.18);
      EG.fx.shake = 5;
      EG.fx.ring(gateX, FLOOR_Y - 90, "#ffe8a6", 160, 1.0, 4);
      EG.fx.ring(gateX, FLOOR_Y - 90, "#63e8ff", 115, 0.85, 3);
      for (let i = 0; i < 34; i++) {
        const warm = i % 2 === 0;
        EG.fx.add({
          x: gateX + (Math.random() - 0.5) * 80,
          y: 250 + Math.random() * 350,
          vx: (Math.random() - 0.5) * 240,
          vy: -120 - Math.random() * 200,
          life: 0.5 + Math.random() * 0.7,
          size: 1.5 + Math.random() * 3,
          color: warm ? "#ffb15a" : "#63e8ff",
          gravity: 120,
          drag: 0.985,
          additive: true,
          glow: 10,
        });
      }
      EG.sfx.gate();
    },

    onPlayerArrive(player, exit) {
      const data = EG.ELEMENTS[player.element];
      EG.fx.ring(exit.x, FLOOR_Y - 10, data.color, 88, 0.75, 3.5);
      EG.fx.burst(exit.x, FLOOR_Y - 62, data.color, 28, {
        spread: 190,
        size: 3,
        life: 0.7,
        gravity: -80,
        glow: 11,
      });
      EG.fx.screenFlash(data.color, 0.1);
      EG.sfx.arrive();
      this.showToast(
        `${data.p1} ${data.name} 도착!`,
        "다른 캐릭터도 출구로 이동하세요",
        data.color,
        1.6,
      );

      if (this.players.every((p) => p.arrived)) this.win();
    },

    win() {
      if (this.state === "won") return;
      this.state = "won";
      this.winTimer = 0;
      this.finishTime = this.elapsed;
      this.toast = null;
      EG.sfx.win();
      EG.fx.confetti();
      EG.fx.screenFlash("#fff7d2", 0.26);
      EG.fx.shake = 4;
      const cx = EG.W / 2;
      EG.fx.ring(cx, 350, "#ffe6a3", 360, 1.4, 5);
      EG.fx.ring(cx, 350, "#7feeff", 260, 1.15, 4);
    },

    showToast(title, sub, color, duration = 2.2) {
      this.toast = {
        title,
        sub,
        color,
        life: duration,
        maxLife: duration,
      };
    },
  };

  EG.game = game;
})();
