import { getDefaultModel } from "./modelManifest";

export const STATE_KEYS = ["idle", "dragging", "dragged", "walking"];

const DEFAULT_CONFIG = Object.freeze({
  model: {
    type: "builtin",
    id: getDefaultModel()?.id || "ghost-modern",
    path: "",
    size: 50,
  },
  animations: STATE_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {}),
});

function cloneDefaultConfig() {
  return {
    model: { ...DEFAULT_CONFIG.model },
    animations: { ...DEFAULT_CONFIG.animations },
  };
}

export function createDefaultConfig() {
  return cloneDefaultConfig();
}

export function normalizeConfig(raw) {
  if (!raw || typeof raw !== "object") {
    return createDefaultConfig();
  }

  const next = createDefaultConfig();

  if (raw.model) {
    if (raw.model.type === "custom" && raw.model.path) {
      next.model = {
        type: "custom",
        path: raw.model.path,
      };
    } else if (raw.model.id) {
      next.model = {
        type: "builtin",
        id: raw.model.id,
      };
    }
  }

  if (raw.animations && typeof raw.animations === "object") {
    STATE_KEYS.forEach((key) => {
      const val = raw.animations[key];
      next.animations[key] = typeof val === "string" && val.length ? val : null;
    });
  }

  return next;
}

export function mergeConfig(baseConfig, overrides) {
  const base = normalizeConfig(baseConfig);
  const patch = normalizeConfig(overrides);

  const merged = createDefaultConfig();
  merged.model = { ...base.model, ...patch.model };
  merged.animations = { ...base.animations, ...patch.animations };

  return merged;
}
