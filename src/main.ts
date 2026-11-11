import * as THREE from 'three';

// M0 scaffold: proves that three.js bundles into the single-file build.
// A spinning gem in the PoC's palette; replaced by the real game in later milestones.
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x08141d);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
camera.position.set(0, 1.2, 4);
camera.lookAt(0, 0, 0);
scene.add(new THREE.AmbientLight(0xcfe6ff, 0.72));
const sun = new THREE.DirectionalLight(0xffffff, 0.85);
sun.position.set(-8, 16, 10);
scene.add(sun);
const gem = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.7, 0).scale(1, 1.4, 1),
  new THREE.MeshLambertMaterial({ color: 0xffc83d, emissive: 0x6b4a00 })
);
scene.add(gem);

function resize(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

renderer.setAnimationLoop((t) => {
  gem.rotation.y = t / 450;
  renderer.render(scene, camera);
});
