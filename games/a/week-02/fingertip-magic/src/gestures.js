import { CONFIG } from './config.js';
import { clamp } from './util.js';

export const STATE = Object.freeze({
  IDLE: 'IDLE',
  CHARGE: 'CHARGE',
  LAUNCH: 'LAUNCH',
  SHIELD: 'SHIELD',
});

/**
 * 제스처 상태 머신
 *   IDLE  --(불꽃 자세 200ms)-->   CHARGE --(주먹 120ms)--> LAUNCH
 *   IDLE  --(손바닥 250ms)-->      SHIELD
 *
 *  불꽃  = 엄지+검지 펴고 나머지 접음  (권총)
 *  발사  = 주먹 (손 벌어짐 값이 작음)   ← 손가락 하나 떼는 방식 대신 손 전체 모양
 *  방패  = 손바닥 활짝 (손 벌어짐 값이 큼)
 */
export class Gestures {
  constructor() { this.reset(); }

  reset() {
    this.state = STATE.IDLE;
    this.charge = 0;
    this.orb = 0;
    this.orbPower = 0;
    this.orbPos = { x: 0, y: 0 };
    this.aim = { x: 0, y: -1 };
    this.palm = { x: 0, y: 0 };
    this.fireHold = 0;
    this.shieldHold = 0;
    this.fistHold = 0;
    this.release = 0;
    this.timer = 0;
    this.launched = null; // 이번 프레임에 발사 이벤트가 있으면 채워짐
  }

  update(f, dt) {
    this.launched = null;
    const hold = CONFIG.fireHoldMs / 1000;
    const holdShield = CONFIG.shieldHoldMs / 1000;
    const holdFist = CONFIG.fistHoldMs / 1000;
    const rel = CONFIG.releaseMs / 1000;

    // 손이 없으면 잠시 후 리셋
    if (!f || !f.hasHand) {
      this.release += dt;
      this.orb = Math.max(0, this.orb - dt);
      if (this.release > rel) {
        this.state = STATE.IDLE;
        this.charge = 0;
        this.fireHold = 0;
        this.fistHold = 0;
      }
      return;
    }

    const e = f.ext;
    const fistPose = !!f.isFist;
    const openPose = !!f.isOpen;
    // 불꽃 자세: 엄지+검지 펴고 나머지 접음. 주먹으로 넘어가는 중이면 제외
    const firePose = !fistPose && e.thumb && e.index && !e.middle && !e.ring && !e.pinky;

    if (this.state !== STATE.CHARGE) this.orb = Math.max(0, this.orb - dt);
    this.palm = { ...f.palm };

    switch (this.state) {
      case STATE.IDLE: {
        this.charge = 0;

        if (firePose) {
          this.fireHold += dt;
          this.release = 0;
          if (this.fireHold >= hold) this._enterCharge(f);
        } else this.fireHold = 0;

        if (openPose) {
          this.shieldHold += dt;
          if (this.shieldHold >= holdShield) {
            this.state = STATE.SHIELD;
            this.shieldHold = 0;
            this.fireHold = 0;
            this.orb = 0;
          }
        } else this.shieldHold = 0;
        break;
      }

      case STATE.CHARGE: {
        this.aim = { ...f.aim };
        this.orbPos = { ...f.palm };
        this.charge = clamp(this.charge + CONFIG.fireChargeRate * dt, 0, 1);
        this.orb = CONFIG.orbLifeMs / 1000;
        this.orbPower = Math.max(this.charge, 0.2);

        if (openPose) {
          this.shieldHold += dt;
          if (this.shieldHold >= holdShield) {
            this.state = STATE.SHIELD;
            this.shieldHold = 0;
            this.charge = 0;
            this.orb = 0;
            break;
          }
        } else this.shieldHold = 0;

        // 주먹을 쥐면 발사 (손가락 하나하나 대신 손 전체 모양으로 판정)
        if (fistPose) {
          this.fistHold += dt;
          if (this.fistHold >= holdFist && this.charge >= CONFIG.chargeMin) {
            this.launched = {
              origin: { ...f.palm },
              dir: { ...this.aim },
              power: this.charge,
            };
            this.charge = 0;
            this.orb = 0;
            this.fistHold = 0;
            this.state = STATE.LAUNCH;
            this.timer = CONFIG.launchMs / 1000;
            break;
          }
        } else this.fistHold = 0;

        if (!firePose && !openPose && !fistPose) {
          this.release += dt;
          if (this.release >= rel) {
            this.state = STATE.IDLE;
            this.charge = 0;
            this.fireHold = 0;
            this.fistHold = 0;
          }
        } else this.release = 0;
        break;
      }

      case STATE.LAUNCH: {
        this.timer -= dt;
        if (this.timer <= 0) { this.state = STATE.IDLE; this.fireHold = 0; }
        break;
      }

      case STATE.SHIELD: {
        if (!openPose) {
          this.release += dt;
          if (this.release >= rel) { this.state = STATE.IDLE; this.shieldHold = 0; }
        } else this.release = 0;
        break;
      }
    }
  }

  _enterCharge(f) {
    this.state = STATE.CHARGE;
    this.charge = 0;
    this.fireHold = 0;
    this.fistHold = 0;
    this.release = 0;
    this.aim = { ...f.aim };
    this.orb = CONFIG.orbLifeMs / 1000;
  }
}
