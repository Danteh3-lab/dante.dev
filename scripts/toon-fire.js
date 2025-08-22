import * as THREE from "https://unpkg.com/three@0.120.0/build/three.module.js";
import { EffectComposer } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "https://unpkg.com/three@0.120.0/examples/jsm/postprocessing/ShaderPass.js";

// Toon fire shader inside #about-fire (responsive, with bloom). No dat.GUI.
const container = document.getElementById("about-fire");
if (!container) {
  console.warn("toon-fire: #about-fire container not found");
} else {
  const options = {
    exposure: 2.8,
    bloomStrength: 1.7,
    bloomThreshold: 0.0,
    bloomRadius: 0.8,
    color0: [74, 30, 0],
    color1: [201, 158, 72],
  };

  const vert = `
    varying vec3 vNormal;
    void main() {
      vNormal = normal;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const frag = `
    #define NUM_OCTAVES 5
    uniform vec2 resolution;
    uniform vec3 color1;
    uniform vec3 color0;
    uniform float time;
    varying vec3 vNormal;

    float rand(vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
    float noise(vec2 p){
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u*u*(3.0-2.0*u);
      float res = mix(
        mix(rand(ip), rand(ip+vec2(1.0,0.0)), u.x),
        mix(rand(ip+vec2(0.0,1.0)), rand(ip+vec2(1.0,1.0)), u.x), u.y);
      return res*res;
    }
    float fbm(vec2 x) {
      float v = 0.0; float a = 0.5; vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
      for (int i = 0; i < NUM_OCTAVES; ++i) { v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.5; }
      return v;
    }
    vec3 rgbcol(float r, float g, float b) { return vec3(r/255.0, g/255.0, b/255.0); }
    float setOpacity(float r, float g, float b){ float tone=(r+g+b)/3.0; return tone < 0.99 ? 0.0 : 1.0; }

    void main(){
      vec2 uv = normalize(vNormal).xy * 0.5 + 0.5;
      vec2 newUv = uv + vec2(0.0, -time*0.0004);
      float scale = 12.0;
      vec2 p = newUv * scale;
      float n = fbm(p + fbm(p));

      vec4 backColor = vec4(1.0 - uv.y) + vec4(vec3(n * (1.0 - uv.y)), 1.0);
      float aback = setOpacity(backColor.r, backColor.g, backColor.b);
      backColor.a = aback;
      backColor.rgb = rgbcol(color1.r, color1.g, color1.b);

      vec4 frontColor = vec4(1.08 - uv.y) + vec4(vec3(n * (1.0 - uv.y)), 1.0);
      float afront = setOpacity(frontColor.r, frontColor.g, frontColor.b);
      frontColor.a = afront;
      frontColor.rgb = rgbcol(color0.r, color0.g, color0.b);

      frontColor.a = frontColor.a - backColor.a; // edge ring

      gl_FragColor = (frontColor.a > 0.0) ? frontColor : backColor;
    }
  `;

  let scene, camera, renderer, material, composer, bloomPass;
  function rect(){ return container.getBoundingClientRect(); }

  const uniforms = {
    time: { value: 10.0 },
    resolution: { value: new THREE.Vector2(rect().width || 640, rect().height || 360) },
    color1: { value: new THREE.Vector3(...options.color1) },
    color0: { value: new THREE.Vector3(...options.color0) },
  };

  function createScene(){
    scene = new THREE.Scene();
    const { width, height } = rect();
    camera = new THREE.PerspectiveCamera(75, (width||640)/(height||360), 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width||640, height||360);
    renderer.setClearColor(0x000000, 0);
    if (renderer.setClearAlpha) renderer.setClearAlpha(0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = options.exposure;
    renderer.domElement.style.background = 'transparent';
    container.appendChild(renderer.domElement);

    const renderPass = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(width||640, height||360), 1.5, 0.4, 0.85);
    bloomPass.threshold = options.bloomThreshold;
    bloomPass.strength = options.bloomStrength;
    bloomPass.radius = options.bloomRadius;

    composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    // Final pass: derive alpha from brightness so black stays transparent
    const AlphaFromLumaShader = {
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          float luma = max(max(col.r, col.g), col.b);
          // Soft threshold so faint glow still visible, black -> alpha 0
          float a = smoothstep(0.03, 0.22, luma);
          gl_FragColor = vec4(col.rgb, a);
        }
      `
    };
    const alphaPass = new ShaderPass(AlphaFromLumaShader);
    alphaPass.renderToScreen = true;
    composer.addPass(alphaPass);
  }

  function addMesh(){
    const spheregeometry = new THREE.SphereGeometry(1.7, 32, 32);
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

  function handleResize(){
    const { width, height } = rect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    uniforms.resolution.value.set(width, height);
    if (bloomPass) bloomPass.setSize(width, height);
    if (composer) composer.setSize(width, height);
  }

  function animate(delta){
    requestAnimationFrame(animate);
    if (material) {
      material.uniforms.time.value = delta;
      material.uniforms.color1.value = new THREE.Vector3(...options.color1);
      material.uniforms.color0.value = new THREE.Vector3(...options.color0);
    }
    if (bloomPass){
      bloomPass.threshold = options.bloomThreshold;
      bloomPass.strength = options.bloomStrength;
      bloomPass.radius = options.bloomRadius;
    }
    renderer.toneMappingExposure = options.exposure;
    composer.render();
  }

  // Init
  createScene();
  addMesh();
  handleResize();
  animate(0);

  if (window.ResizeObserver){
    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
  }
  window.addEventListener('resize', handleResize, false);
}
