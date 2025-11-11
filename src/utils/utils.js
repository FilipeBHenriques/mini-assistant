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

function playClipForState(mixer, rehydratedAnimations, gltfAnimations, state) {
  if (!mixer) return null;
  let clip =
    (rehydratedAnimations && rehydratedAnimations[state]) ||
    (gltfAnimations && gltfAnimations.find((c) => c.name === state));
  // fallback to first GLTF animation if no matching, only for "walking"
  if (!clip && gltfAnimations && gltfAnimations.length)
    clip = gltfAnimations[0];

  if (!clip) return null;

  const action = mixer.clipAction(clip);
  console.log("action is ", action);
  action.reset();
  action.play();
  return action;
}

export { screenToWorld, worldToScreen, playClipForState };
