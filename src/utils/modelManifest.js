// Create manifest of .glb assets in ../assets

const assetsGlob = import.meta.glob("../assets/*.glb", {
  as: "url",
  eager: true,
});

export const MODEL_MANIFEST = Object.entries(assetsGlob).map(
  ([path, assetUrl]) => {
    const filename = path
      .split("/")
      .pop()
      .replace(/\.glb$/i, "");
    return {
      id: filename.replace(/[^a-zA-Z0-9-_]/g, "-"),
      label: filename
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      assetUrl,
    };
  }
);

export function getBuiltinModel(id) {
  return MODEL_MANIFEST.find((entry) => entry.id === id) || MODEL_MANIFEST[0];
}

export function getDefaultModel() {
  return MODEL_MANIFEST[1] || MODEL_MANIFEST[0];
}
