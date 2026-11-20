(function (global) {
  'use strict';

  const CUBE_FACES = [
    { n: [0, 1, 0], v: [[-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]] },
    { n: [0, -1, 0], v: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] },
    { n: [0, 0, 1], v: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { n: [0, 0, -1], v: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { n: [1, 0, 0], v: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { n: [-1, 0, 0], v: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
  ];

  const CUBE_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aOffset;
layout(location = 3) in vec3 aScale;
layout(location = 4) in vec4 aColor;

uniform mat4 uVP;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec2 uFogRange;

out vec3 vColor;
out float vAlpha;

void main() {
  vec3 worldPos = aPos * aScale + aOffset;
  gl_Position = uVP * vec4(worldPos, 1.0);

  vec3 n = normalize(aNormal);
  float diffuse = max(dot(n, uSunDir), 0.0);
  float shade = (0.63 + 0.44 * diffuse) * (0.88 + 0.12 * n.y);
  vec3 lit = aColor.rgb * shade;

  float dist = distance(worldPos, uCamPos);
  float fog = smoothstep(uFogRange.x, uFogRange.y, dist);
  vColor = mix(lit, uFogColor, fog * 0.94);
  vAlpha = aColor.a;
}`;

  const CUBE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main() {
  outColor = vec4(vColor, vAlpha);
}`;

  const SKY_VERTEX_SHADER = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.9999, 1.0);
}`;

  const SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
out vec4 outColor;
void main() {
  float t = clamp(vUV.y, 0.0, 1.0);
  float g = smoothstep(0.0, 0.78, t);
  outColor = vec4(mix(uSkyBottom, uSkyTop, g), 1.0);
}`;

  function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile failed: ' + log);
    }
    return shader;
  }

  function program(gl, vsSource, fsSource) {
    const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error('Program link failed: ' + log);
    }
    return prog;
  }

  class Renderer {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', {
        antialias: true,
        alpha: false,
        depth: true,
        powerPreference: 'high-performance',
      });
      if (!gl) {
        throw new Error('이 브라우저에서는 WebGL2를 사용할 수 없습니다.');
      }

      this.canvas = canvas;
      this.gl = gl;
      this.aspect = 1;
      this.time = 0;

      this.cubeProgram = program(gl, CUBE_VERTEX_SHADER, CUBE_FRAGMENT_SHADER);
      this.skyProgram = program(gl, SKY_VERTEX_SHADER, SKY_FRAGMENT_SHADER);

      this.cubeUniforms = {
        vp: gl.getUniformLocation(this.cubeProgram, 'uVP'),
        camPos: gl.getUniformLocation(this.cubeProgram, 'uCamPos'),
        sunDir: gl.getUniformLocation(this.cubeProgram, 'uSunDir'),
        fogColor: gl.getUniformLocation(this.cubeProgram, 'uFogColor'),
        fogRange: gl.getUniformLocation(this.cubeProgram, 'uFogRange'),
      };
      this.skyUniforms = {
        top: gl.getUniformLocation(this.skyProgram, 'uSkyTop'),
        bottom: gl.getUniformLocation(this.skyProgram, 'uSkyBottom'),
      };

      const vertexData = [];
      for (const face of CUBE_FACES) {
        const [a, b, c, d] = face.v;
        for (const p of [a, b, c, a, c, d]) {
          vertexData.push(p[0], p[1], p[2], face.n[0], face.n[1], face.n[2]);
        }
      }

      this.cubeBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexData), gl.STATIC_DRAW);

      this.opaque = this.createBatch(9000);
      this.transparent = this.createBatch(2400);

      this.skyVao = gl.createVertexArray();

      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.resize();
    }

    createBatch(maxInstances) {
      const gl = this.gl;
      const data = new Float32Array(maxInstances * 10);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 0);
      gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3);
      gl.vertexAttribPointer(3, 3, gl.FLOAT, false, 40, 12);
      gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(4);
      gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 40, 24);
      gl.vertexAttribDivisor(4, 1);
      gl.bindVertexArray(null);

      return { data, buffer, vao, count: 0, maxInstances };
    }

    resize() {
      const canvas = this.canvas;
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      this.gl.viewport(0, 0, width, height);
      this.aspect = width / height;
    }

    reset() {
      this.opaque.count = 0;
      this.transparent.count = 0;
    }

    pushTo(batch, x, y, z, w, h, d, color, alpha) {
      if (batch.count >= batch.maxInstances) return;
      const i = batch.count * 10;
      const a = batch.data;
      a[i] = x;
      a[i + 1] = y;
      a[i + 2] = z;
      a[i + 3] = w;
      a[i + 4] = h;
      a[i + 5] = d;
      a[i + 6] = color[0];
      a[i + 7] = color[1];
      a[i + 8] = color[2];
      a[i + 9] = alpha;
      batch.count++;
    }

    /** Axis-aligned box, position is the center. */
    box(x, y, z, w, h, d, color, alpha) {
      const a = alpha === undefined ? 1 : alpha;
      if (a < 0.999) {
        this.pushTo(this.transparent, x, y, z, w, h, d, color, a);
      } else {
        this.pushTo(this.opaque, x, y, z, w, h, d, color, 1);
      }
    }

    drawBatch(batch) {
      if (batch.count === 0) return;
      const gl = this.gl;
      gl.bindVertexArray(batch.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, batch.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, batch.data.subarray(0, batch.count * 10));
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, batch.count);
    }

    render(camera, env) {
      this.resize();
      const gl = this.gl;

      const projection = M3.perspective((camera.fov * Math.PI) / 180, this.aspect, 0.4, 150);
      const view = M3.lookAt(camera.eye, camera.target, [0, 1, 0]);
      const vp = M3.multiply(projection, view);

      gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);
      gl.useProgram(this.skyProgram);
      gl.uniform3fv(this.skyUniforms.top, env.skyTop);
      gl.uniform3fv(this.skyUniforms.bottom, env.skyBottom);
      gl.bindVertexArray(this.skyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);

      gl.useProgram(this.cubeProgram);
      gl.uniformMatrix4fv(this.cubeUniforms.vp, false, vp);
      gl.uniform3fv(this.cubeUniforms.camPos, camera.eye);
      gl.uniform3fv(this.cubeUniforms.sunDir, env.sun);
      gl.uniform3fv(this.cubeUniforms.fogColor, env.fog);
      gl.uniform2f(this.cubeUniforms.fogRange, env.fogNear, env.fogFar);

      this.drawBatch(this.opaque);
      gl.depthMask(false);
      this.drawBatch(this.transparent);
      gl.depthMask(true);

      gl.bindVertexArray(null);
    }
  }

  global.Renderer = Renderer;
})(window);