import * as THREE from "https://unpkg.com/three@0.120.0/build/three.module.js";

// Target the About orb container
const container = document.getElementById("about-orb");
const getRect = () => (container ? container.getBoundingClientRect() : { width: 0, height: 0 });

// Options and GUI
var options = {
  exposure: 2.8,
  bloomStrength: 1.7,
  bloomThreshold: 0,
  bloomRadius: 0.8,
  color0: [74, 30, 0],
  color1: [201, 158, 72],
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
  uniform vec3 color1;
  uniform vec3 color0;
  uniform float time;
  varying vec3 vNormal;

  float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
  float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 u = fract(p); u = u*u*(3.0-2.0*u);
    float res = mix(
      mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),
      mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
    return res*res;
  }
  float fbm(vec2 x) {
    float v = 0.0; float a = 0.5; vec2 shift = vec2(100);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < NUM_OCTAVES; ++i) { v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.5; }
    return v;
  }
  vec3 rgbcol(float r, float g, float b) { return vec3(r/255.0,g/255.0,b/255.0); }
  float setOpacity(float r, float g, float b) {
    float tone = (r + g + b) / 3.0; float alpha = 1.0; if(tone<0.99) { alpha = 0.0; } return alpha;
  }
  void main(){
    vec2 uv = normalize(vNormal).xy * 0.5 + 0.5;
    vec2 newUv = uv + vec2(0.0, -time*0.0004);
    float scale = 12.0; vec2 p = newUv*scale; float n = fbm(p + fbm(p));

    // Build core and edge masks similar to provided shader
    vec4 backColor = vec4(1.0 - uv.y) + vec4(vec3(n*(1.0 - uv.y)),1.0);
    float aback = setOpacity(backColor.r, backColor.g, backColor.b);

    vec4 frontColor = vec4(1.08 - uv.y) + vec4(vec3(n*(1.0 - uv.y)),1.0);
    float afront = setOpacity(frontColor.r, frontColor.g, frontColor.b);

    // Ring alpha only (no interior fill)
    float ring = clamp(afront - aback, 0.0, 1.0);

    vec3 baseCol = rgbcol(color1.r, color1.g, color1.b);
    vec3 edgeCol = rgbcol(color0.r, color0.g, color0.b);
    vec3 col = mix(baseCol, edgeCol, ring);

    float alpha = pow(ring, 0.9);
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(col, alpha);
  }
`;

var scene, camera, renderer, material;
var width = getRect().width || 280;
var height = getRect().height || 280;
var uniforms = {
  time: { value: 10.0 },
  resolution: { value: new THREE.Vector4(width, height, 0.0, 0.0) },
  color1: { value: new THREE.Vector3(...options.color1) },
  color0: { value: new THREE.Vector3(...options.color0) },
};

function init() { createScene(); sphere(); animate(); }

function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.z = 2.9;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  if (renderer.setClearAlpha) renderer.setClearAlpha(0);
  if (container) container.appendChild(renderer.domElement);

  // No postprocessing to preserve transparency inside the orb
}

function sphere() {
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
  const r = getRect();
  width = Math.max(1, r.width || 280);
  height = Math.max(1, r.height || 280);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  uniforms.resolution.value.set(width, height, 0.0, 0.0);
}

function animate(delta) {
  requestAnimationFrame(animate);
  if (material && material.uniforms && material.uniforms.time) {
    material.uniforms.time.value = delta;
    material.uniforms.color1.value = new THREE.Vector3(...options.color1);
    material.uniforms.color0.value = new THREE.Vector3(...options.color0);
  }
  renderer.render(scene, camera);
}

if (container) {
  init();
  // Observe orb size changes and window resizes
  const ro = new ResizeObserver(handleResize);
  ro.observe(container);
  window.addEventListener("resize", handleResize, false);
} else {
  console.warn("fire-world: #about-orb not found; skipping init.");
}
