// A local WebGL sculpture: no downloads or external 3D runtime.
export function createFocusSculpture(canvas, stage) {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  if (!gl) return;
  const vertexSource = `attribute vec3 aPosition; attribute vec3 aNormal;
    uniform mat4 uProjection; uniform mat4 uModel;
    varying vec3 vNormal; varying vec3 vPosition;
    void main(){ vec4 p=uModel*vec4(aPosition,1.0); vPosition=p.xyz;
      vNormal=mat3(uModel)*aNormal; gl_Position=uProjection*p; }`;
  const fragmentSource = `precision mediump float; varying vec3 vNormal; varying vec3 vPosition;
    void main(){vec3 n=normalize(vNormal); vec3 view=normalize(-vPosition);
      vec3 l=normalize(vec3(-3.0,5.0,5.0)); vec3 r=normalize(vec3(4.0,-1.0,2.0));
      float diffuse=max(dot(n,l),0.0); float fill=max(dot(n,r),0.0);
      float spec=pow(max(dot(n,normalize(l+view)),0.0),65.0);
      float rim=pow(1.0-max(dot(n,view),0.0),2.8);
      vec3 base=vec3(0.49,0.65,0.48); vec3 c=base*(0.29+diffuse*0.77+fill*0.25);
      c+=vec3(0.88,0.95,0.75)*spec*0.75+vec3(0.60,0.73,0.46)*rim*0.26;
      gl_FragColor=vec4(c,1.0); }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, vertexSource),
    fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  gl.useProgram(program);
  const positions = [],
    normals = [],
    indices = [];
  const segments = 240,
    sides = 32,
    TAU = Math.PI * 2;
  const center = (t) => [
    (1.34 + 0.4 * Math.cos(3 * t)) * Math.cos(2 * t),
    (1.34 + 0.4 * Math.cos(3 * t)) * Math.sin(2 * t),
    0.52 * Math.sin(3 * t),
  ];
  const normalize = (v) => {
    const l = Math.hypot(...v) || 1;
    return v.map((x) => x / l);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * TAU,
      c = center(t),
      a = center(t - 0.001),
      b = center(t + 0.001);
    const tangent = normalize(b.map((x, j) => x - a[j]));
    const normal = normalize(cross(tangent, [0, 0, 1]));
    const binormal = normalize(cross(tangent, normal));
    for (let j = 0; j <= sides; j++) {
      const v = (j / sides) * TAU;
      const n = normal.map(
        (x, k) => x * Math.cos(v) + binormal[k] * Math.sin(v),
      );
      // Tiny flutes catch the light along the porcelain surface.
      const radius = 0.3 + 0.008 * Math.cos(v * 16 + t * 8);
      positions.push(...c.map((x, k) => x + n[k] * radius));
      normals.push(...n);
      if (i < segments && j < sides) {
        const q = i * (sides + 1) + j;
        indices.push(
          q,
          q + sides + 1,
          q + 1,
          q + 1,
          q + sides + 1,
          q + sides + 2,
        );
      }
    }
  }
  function attribute(name, data) {
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  }
  attribute("aPosition", positions);
  attribute("aNormal", normals);
  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );
  gl.enable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);
  const modelLoc = gl.getUniformLocation(program, "uModel"),
    projectionLoc = gl.getUniformLocation(program, "uProjection");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let targetX = 0,
    targetY = 0,
    px = 0,
    py = 0,
    raf = 0,
    visible = false,
    rotation = 0,
    last = 0,
    lost = false;
  const multiply = (a, b) => {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++)
      for (let row = 0; row < 4; row++)
        for (let k = 0; k < 4; k++)
          out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    return out;
  };
  function draw(time = 0) {
    raf = 0;
    if (lost) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    const w = Math.round(rect.width * dpr),
      h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    if (last && !reduced.matches)
      rotation += Math.min(time - last, 50) * 0.0001;
    last = time;
    px += (targetX - px) * 0.045;
    py += (targetY - py) * 0.045;
    const ax = 0.65 + (reduced.matches ? 0 : py * 0.18),
      ay = -0.35 + rotation + (reduced.matches ? 0 : px * 0.25),
      az = -0.25;
    const cx = Math.cos(ax),
      sx = Math.sin(ax),
      cy = Math.cos(ay),
      sy = Math.sin(ay),
      cz = Math.cos(az),
      sz = Math.sin(az);
    const rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1],
      ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1],
      rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const model = multiply(multiply(rx, ry), rz);
    const f = 1 / Math.tan((36 * Math.PI) / 360),
      aspect = w / h,
      near = 0.1,
      far = 100;
    model[14] = -7.4 / Math.min(1, aspect);
    const projection = new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) / (near - far),
      -1,
      0,
      0,
      (2 * far * near) / (near - far),
      0,
    ]);
    gl.uniformMatrix4fv(modelLoc, false, model);
    gl.uniformMatrix4fv(projectionLoc, false, projection);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    stage.classList.add("webgl-ready");
    if (visible && !document.hidden && !reduced.matches)
      raf = requestAnimationFrame(draw);
  }
  function resume() {
    if (visible && !document.hidden && !raf && !lost) {
      last = 0;
      raf = requestAnimationFrame(draw);
    }
  }
  const controller = new AbortController();
  const options = { signal: controller.signal };
  stage.addEventListener(
    "pointermove",
    (e) => {
      const r = stage.getBoundingClientRect();
      targetX = ((e.clientX - r.left) / r.width) * 2 - 1;
      targetY = ((e.clientY - r.top) / r.height) * 2 - 1;
    },
    options,
  );
  stage.addEventListener(
    "pointerleave",
    () => {
      targetX = targetY = 0;
    },
    options,
  );
  const resizeObserver = new ResizeObserver(() => {
    if (visible) {
      if (reduced.matches) draw();
      else resume();
    }
  });
  resizeObserver.observe(stage);
  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) resume();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    },
    { threshold: 0.01 },
  );
  intersectionObserver.observe(stage);
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      } else resume();
    },
    options,
  );
  reduced.addEventListener(
    "change",
    () => {
      cancelAnimationFrame(raf);
      raf = 0;
      draw();
      resume();
    },
    options,
  );
  canvas.addEventListener(
    "webglcontextlost",
    (event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      stage.classList.remove("webgl-ready");
    },
    options,
  );
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      controller.abort();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      createFocusSculpture(canvas, stage);
    },
    options,
  );
}
