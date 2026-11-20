(function (global) {
  'use strict';

  const GRID_MIN = -6;
  const GRID_MAX = 6;

  const CAR_COLORS = [
    '#e8595b',
    '#f2b134',
    '#4b9fe1',
    '#eef1f4',
    '#8c6bd8',
    '#39bf95',
    '#f0863c',
    '#c8d6e0',
  ];

  /**
   * Endless row-based world: grass verges and multi-lane roads.
   * Rows advance in -z (row r sits at z = -r).
   */
  class World {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.rng = M3.rng(this.seed);
      this.rows = [];
      this.nextRow = 0;
      this.mode = 'grass';
      this.ensure(50);
    }

    get(row) {
      return this.rows[row];
    }

    ensure(untilRow) {
      let guard = 0;
      while (this.nextRow <= untilRow && guard++ < 500) {
        if (this.nextRow < 3) {
          this.pushGrass();
          continue;
        }
        if (this.mode === 'grass') {
          const count = 1 + Math.floor(this.rng() * 2.2);
          for (let i = 0; i < count; i++) this.pushGrass();
          this.mode = 'road';
        } else {
          const progress = Math.min(1, this.nextRow / 150);
          const maxLanes = 2 + Math.floor(progress * 3);
          const lanes = 1 + Math.floor(this.rng() * maxLanes);
          this.pushRoadBlock(lanes);
          this.mode = 'grass';
        }
      }
    }

    pushGrass() {
      const rand = this.rng;
      const r = this.nextRow++;
      const row = {
        r,
        z: -r,
        type: 'grass',
        tone: rand(),
        trees: [],
        tufts: [],
      };

      if (row.r > 2) {
        const treeCount = rand() < 0.14 ? 0 : 1 + Math.floor(rand() * 3);
        const used = new Set();
        for (let i = 0; i < treeCount; i++) {
          const x = Math.floor(rand() * 13) - 6;
          if (used.has(x)) continue;
          used.add(x);
          const roll = rand();
          row.trees.push({
            x,
            kind: roll < 0.18 ? 'rock' : roll < 0.32 ? 'bush' : 'tree',
            tone: rand(),
          });
        }
      }

      const tuftCount = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < tuftCount; i++) {
        row.tufts.push({
          x: (rand() * 2 - 1) * 7.2,
          z: (rand() - 0.5) * 0.84,
          size: 0.06 + rand() * 0.07,
        });
      }

      this.rows.push(row);
    }

    pushRoadBlock(lanes) {
      const start = this.nextRow;
      const baseDir = this.rng() < 0.5 ? 1 : -1;
      const baseSpeed = 1.8 + this.rng() * 1.4 + Math.min(2.4, start * 0.006);
      for (let i = 0; i < lanes; i++) {
        const row = this.makeRoad(
          this.nextRow++,
          i % 2 === 0 ? baseDir : -baseDir,
          baseSpeed * (0.9 + this.rng() * 0.24)
        );
        this.rows.push(row);
      }
    }

    makeRoad(r, dir, speed) {
      const rand = this.rng;
      const cars = [];
      const count = 3 + (rand() < 0.45 ? 1 : 0) + (rand() < 0.18 ? 1 : 0);
      const span = 44;
      const step = span / count;

      for (let i = 0; i < count; i++) {
        const truck = rand() < 0.16;
        const len = truck ? 3.1 + rand() * 0.6 : 1.9 + rand() * 0.8;
        cars.push({
          x: -span / 2 + step * i + rand() * 4.6,
          len,
          halfLen: len / 2,
          truck,
          color: CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)],
          tone: rand(),
        });
      }

      return {
        r,
        z: -r,
        type: 'road',
        tone: rand(),
        dir,
        speed,
        cars,
        trees: [],
        tufts: [],
      };
    }

    updateCars(dt, centerRow) {
      const limit = 25;
      const from = Math.max(0, Math.floor(centerRow) - 8);
      const to = Math.min(this.rows.length - 1, Math.floor(centerRow) + 32);
      for (let i = from; i <= to; i++) {
        const row = this.rows[i];
        if (row.type !== 'road') continue;
        const step = row.speed * row.dir * dt;
        for (let j = 0; j < row.cars.length; j++) {
          const car = row.cars[j];
          car.x += step;
          if (row.dir > 0 && car.x - car.halfLen > limit) {
            car.x = -limit - car.halfLen;
          } else if (row.dir < 0 && car.x + car.halfLen < -limit) {
            car.x = limit + car.halfLen;
          }
        }
      }
    }

    isBlocked(row, x) {
      const data = this.rows[row];
      if (!data || data.type !== 'grass') return false;
      for (let i = 0; i < data.trees.length; i++) {
        if (data.trees[i].x === x) return true;
      }
      return false;
    }

    /** Returns the car that overlaps the player footprint, if any. */
    hitTest(px, pz) {
      const rowFloat = -pz;
      const from = Math.max(0, Math.floor(rowFloat) - 1);
      const to = Math.floor(rowFloat) + 1;
      for (let r = from; r <= to; r++) {
        const row = this.rows[r];
        if (!row || row.type !== 'road') continue;
        for (let i = 0; i < row.cars.length; i++) {
          const car = row.cars[i];
          if (Math.abs(px - car.x) < car.halfLen + 0.26 && Math.abs(pz - row.z) < 0.46) {
            return car;
          }
        }
      }
      return null;
    }
  }

  World.GRID_MIN = GRID_MIN;
  World.GRID_MAX = GRID_MAX;

  global.World = World;
})(window);