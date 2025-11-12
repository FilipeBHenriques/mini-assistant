import * as THREE from "three";

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

export { playClipForState };
