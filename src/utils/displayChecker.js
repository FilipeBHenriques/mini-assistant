// utils/displayChecker.js - Helper utilities for display checking

/**
 * Ensures the ghost is on the same display as the target window
 * @param {string} windowId - The ID of the target window
 * @param {object} electronAPI - The window.electronAPI object
 * @param {number} waitMs - Time to wait after moving (default 500ms)
 * @returns {Promise<boolean>} - Whether ghost moved to new display
 */
export async function ensureGhostOnWindowDisplay(
  windowId,
  electronAPI,
  waitMs = 500
) {
  const displayCheck = await electronAPI.checkSameDisplayAsWindow(windowId);

  if (!displayCheck.same) {
    console.log(
      `🔄 Ghost moving from display ${displayCheck.ghostDisplayIndex} → ${displayCheck.targetDisplayIndex}`
    );

    electronAPI.moveGhostToDisplay(displayCheck.targetDisplayIndex);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    return true; // Ghost moved
  }

  return false; // Already on same display
}

/**
 * Ensures the ghost is on the same display as the cursor
 * @param {object} electronAPI - The window.electronAPI object
 * @param {number} waitMs - Time to wait after moving (default 500ms)
 * @returns {Promise<boolean>} - Whether ghost moved to new display
 */
export async function ensureGhostOnCursorDisplay(electronAPI, waitMs = 500) {
  const displayCheck = await electronAPI.checkSameDisplayAsCursor();

  if (!displayCheck.same) {
    console.log(
      `🔄 Ghost moving to cursor display: ${displayCheck.ghostDisplayIndex} → ${displayCheck.targetDisplayIndex}`
    );
    console.log(
      `📍 Cursor at: (${displayCheck.cursorPos.x}, ${displayCheck.cursorPos.y})`
    );

    electronAPI.moveGhostToDisplay(displayCheck.targetDisplayIndex);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    return true; // Ghost moved
  }

  return false; // Already on same display
}

/**
 * Wrapper function - runs an action only after ensuring ghost is on correct display
 * @param {string} windowId - Target window ID
 * @param {object} electronAPI - The window.electronAPI object
 * @param {Function} action - The action to perform after ghost is in position
 * @param {number} waitMs - Time to wait after moving (default 500ms)
 */
export async function withGhostOnWindowDisplay(
  windowId,
  electronAPI,
  action,
  waitMs = 500
) {
  await ensureGhostOnWindowDisplay(windowId, electronAPI, waitMs);
  return action();
}

/**
 * Wrapper function - runs an action only after ensuring ghost is on cursor's display
 * @param {object} electronAPI - The window.electronAPI object
 * @param {Function} action - The action to perform after ghost is in position
 * @param {number} waitMs - Time to wait after moving (default 500ms)
 */
export async function withGhostOnCursorDisplay(
  electronAPI,
  action,
  waitMs = 500
) {
  await ensureGhostOnCursorDisplay(electronAPI, waitMs);
  return action();
}
