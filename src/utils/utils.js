import * as THREE from "three";

function screenToWorld(x, y, camera) {
  const ndc = new THREE.Vector3(
    (x / window.innerWidth) * 2 - 1,
    -(y / window.innerHeight) * 2 + 1,
    0
  );
  ndc.unproject(camera);
  return ndc;
}

function worldToScreen(pos, camera) {
  const vector = pos.clone().project(camera);
  return {
    x: (vector.x * 0.5 + 0.5) * window.innerWidth,
    y: (-vector.y * 0.5 + 0.5) * window.innerHeight,
  };
}

export { screenToWorld, worldToScreen };
