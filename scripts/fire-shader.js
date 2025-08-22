// Three.js shader fire (About orb)
// Uses three@0.120.0 and postprocessing passes from unpkg.

import * as THREE from "https://unpkg.com/three@0.120.0/build/three.module.js";

const container = document.getElementById("about-orb");
console.log('[fire-shader] script loaded; container:', !!container);
if (!container) {
  console.warn("fire-shader: #about-orb container not found; skipping init.");
} else {
  const options = {
    exposure: 1.8,
    bloomStrength: 0.9,
    bloomThreshold: 0.0,
    bloomRadius: 0.6,
    color0: [74, 30, 0], // edge/border
    color1: [201, 158, 72], // base
  };

  const vert = `
    varying vec3 vNormal;
    void main() {
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `;

  const frag = `
    #define NUM_OCTAVES 5
    uniform vec4 resolution;
    uniform vec3 color1; // base
    uniform vec3 color0; // edge
    uniform float time;
    varying vec3 vNormal;

    float rand(vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
    float noise(vec2 p){
      vec2 ip = floor(p);
      vec2 u = fract(p); u = u*u*(3.0-2.0*u);
      float res = mix(mix(rand(ip), rand(ip+vec2(1.0,0.0)), u.x), mix(rand(ip+vec2(0.0,1.0)), rand(ip+vec2(1.0,1.0)), u.x), u.y);
      return res*res;
    }
    float fbm(vec2 x){
      float v = 0.0; float a = 0.5; vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
      for(int i=0;i<NUM_OCTAVES;++i){ v += a*noise(x); x = rot*x*2.0 + shift; a *= 0.5; }
      return v;
    }

    void main(){
      // Spherical normal -> UV
      vec2 uv = normalize(vNormal).xy * 0.5 + 0.5;
      // Scroll upward
      vec2 newUv = uv + vec2(0.0, -time*0.0005);
      float scale = 12.5; // slightly more detail
      vec2 p = newUv * scale;
      float n = fbm(p + fbm(p));

      // Flame intensity: noise tapered by height
      float intensity = n * (1.0 - uv.y);
      // Much more permissive thresholds to show fire clearly
      float edge = smoothstep(0.15, 0.70, intensity);
      float core = smoothstep(0.30, 0.85, intensity);

      // Color mix: base to edge
      vec3 col = mix(color1/255.0, color0/255.0, core);
      // Boost brightness significantly for visibility
      col = clamp(col * (2.0 + 0.5*core), 0.0, 1.0);

      // Strong base fill to ensure visibility
      float baseA = 0.4 * (1.0 - uv.y) + 0.2 * n;
      float alpha = max(baseA, pow(edge, 0.6));
      alpha = max(alpha, 0.25);

      if(alpha <= 0.01) discard; // only discard truly transparent areas
      gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    }
  `;

  let scene, camera, renderer, material;
  const rect = () => container.getBoundingClientRect();
  const sizes = { width: rect().width || 280, height: rect().height || 280 };

  const uniforms = {
    time: { value: 10.0 },
    resolution: { value: new THREE.Vector4(sizes.width, sizes.height, 0.0, 0.0) },
    color1: { value: new THREE.Vector3(...options.color1) },
    color0: { value: new THREE.Vector3(...options.color0) },
  };

  function createScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, sizes.width / sizes.height, 0.1, 1000);
    camera.position.z = 2.9;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(sizes.width, sizes.height);
    renderer.setClearColor(0x000000, 0); // transparent
    if (renderer.setClearAlpha) renderer.setClearAlpha(0);
    // Extra safety: enforce CSS and GL transparency
    renderer.domElement.style.background = 'transparent';
    renderer.domElement.style.pointerEvents = 'none';
    const gl = renderer.getContext();
    try { gl.clearColor(0, 0, 0, 0); } catch(e) {}
    container.appendChild(renderer.domElement);
  }

  function addSphere() {
    const spheregeometry = new THREE.SphereGeometry(2.5, 64, 64);
    material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: vert,
      fragmentShader: frag,
    });
    const mesh = new THREE.Mesh(spheregeometry, material);
    scene.add(mesh);
  }

  function handleResize() {
    const r = rect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    sizes.width = w;
    sizes.height = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    uniforms.resolution.value.set(w, h, 0.0, 0.0);
  }

  function animate(t) {
    requestAnimationFrame(animate);
    if (material && material.uniforms && material.uniforms.time) {
      material.uniforms.time.value = t;
      material.uniforms.color1.value = new THREE.Vector3(...options.color1);
      material.uniforms.color0.value = new THREE.Vector3(...options.color0);
    }
    renderer.render(scene, camera);
  }

  // Init
  createScene();
  addSphere();
  handleResize();
  animate(0);
  // Resize on container changes and window resize (guarded)
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
  } else {
    console.log('[fire-shader] ResizeObserver not available; relying on window resize');
  }
  window.addEventListener("resize", handleResize, false);
}
