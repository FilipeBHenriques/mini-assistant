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

function playClipForState(
  mixer,
  rehydratedAnimations,
  gltfAnimations,
  state,
  currentAction
) {
  if (!mixer) return null;

  // Try to get the clip for the state
  let clip =
    (rehydratedAnimations && rehydratedAnimations[state]) ||
    (gltfAnimations && gltfAnimations.find((c) => c.name === state));

  // Fallback to first animation if nothing matches (optional, e.g., for walking)
  if (!clip && gltfAnimations && gltfAnimations.length) {
    clip = gltfAnimations[0];
  }

  if (!clip) return null;

  // If this clip is already playing, do nothing
  if (currentAction && currentAction.getClip() === clip) {
    return currentAction;
  }

  // Stop previous action
  if (currentAction) {
    currentAction.fadeOut(0.2); // smooth transition
  }

  // Start the new action
  currentAction = mixer.clipAction(clip);
  currentAction.reset();
  currentAction.fadeIn(0.2); // smooth transition
  currentAction.play();

  return currentAction;
}

export { screenToWorld, worldToScreen, playClipForState };
