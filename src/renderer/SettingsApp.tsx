import React, { useEffect, useRef, useState } from "react";
import SettingsView from "./SettingsView";
import {
  MODEL_MANIFEST,
  getBuiltinModel,
  getDefaultModel,
} from "../utils/modelManifest";
import {
  STATE_KEYS,
  createDefaultConfig,
  normalizeConfig,
} from "../utils/ghostConfig";

const electronAPI = (window as any).electronAPI;

export default function SettingsApp() {
  const viewRef = useRef<any>(null);
  const [settings, setSettings] = useState<any>(createDefaultConfig());
  const [clipsMap, setClipsMap] = useState<
    Record<string, { clip: any; label: string }>
  >({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const loaded = await electronAPI?.getSettings?.();
        if (!mounted) return;
        if (loaded) {
          setSettings(normalizeConfig(loaded));
        }
      } catch (err) {
        console.warn("Failed to load settings from bridge", err);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function resolveModelUrl(modelDescriptor: any) {
    if (!modelDescriptor) return null;
    if (modelDescriptor.type === "custom" && modelDescriptor.path) {
      // Use the raw path for custom imports to match the original `ghost.js` behavior.
      // The main renderer uses the direct path when loading custom models.
      return modelDescriptor.path;
    }
    const builtin = getBuiltinModel(modelDescriptor.id) || getDefaultModel();
    return builtin?.assetUrl || null;
  }

  const assetUrl = resolveModelUrl(settings.model);

  function handleClipsUpdated(map: Record<string, any>) {
    setClipsMap(map);
  }

  function handleSave() {
    try {
      electronAPI?.saveSettings?.(settings);
    } catch (err) {
      console.warn("Failed to save settings", err);
    }
  }

  async function handleImportModel() {
    if (!electronAPI?.selectModelFile) return;
    try {
      const path = await electronAPI.selectModelFile();
      if (!path) return;
      const next = {
        ...settings,
        model: {
          type: "custom",
          // use a special id for custom imports so the select can reference it
          id: "__custom__",
          path,
          size: settings.model.size || 50,
        },
      };
      setSettings(next);
    } catch (err) {
      console.warn("Failed to import model", err);
    }
  }

  function handleModelChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const val = event.target.value;
    if (val === "__custom__") {
      // keep existing custom path
      setSettings((s: any) => ({
        ...s,
        model: { ...s.model, type: "custom" },
      }));
    } else {
      setSettings((s: any) => ({
        ...s,
        model: { ...s.model, type: "builtin", id: val },
      }));
    }
  }

  function handleSizeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(event.target.value);
    setSettings((s: any) => ({ ...s, model: { ...s.model, size: v } }));
  }

  function playClipForState(stateKey: string) {
    const key = settings.animations?.[stateKey];
    if (!key || !viewRef.current) return;
    viewRef.current?.playClipByKey(key);
  }

  function playCycle() {
    // play sequence of selected states that have values
    const sequence = STATE_KEYS.filter((k) => settings.animations[k])
      .map((k) => settings.animations[k])
      .filter(Boolean);
    if (!sequence.length || !viewRef.current) return;
    viewRef.current.playSequenceOnce(sequence);
  }

  function resetCamera() {
    viewRef.current?.resetCamera();
  }

  function updateAnimationSelection(stateKey: string, clipKey: string) {
    setSettings((s: any) => ({
      ...s,
      animations: { ...s.animations, [stateKey]: clipKey },
    }));
  }

  return (
    <div style={{ padding: 24, minHeight: "100%", boxSizing: "border-box" }}>
      <section
        id="settings-shell"
        style={{
          width: "min(920px, calc(100% - 32px))",
          maxHeight: "calc(100% - 48px)",
          padding: 24,
          borderRadius: 18,
          background: "rgba(17,18,28,0.92)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 28px 60px rgba(0,0,0,0.45)",
          color: "#f5f7ff",
          display: "flex",
          gap: 20,
        }}
      >
        <div style={{ flex: 1 }}>
          <header>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "0.02em" }}>
              Ghost Preview Settings
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#9495b3" }}>
              Pick a model, map the states you care about, and spin it around.
            </p>
          </header>

          <div style={{ marginTop: 16 }}>
            {/* cast to any to avoid TSX ref typing friction during migration */}
            {(() => {
              const AnySettingsView: any = SettingsView as any;
              return (
                <AnySettingsView
                  ref={viewRef as any}
                  assetUrl={assetUrl}
                  size={settings.model.size || 50}
                  onClipsUpdated={handleClipsUpdated}
                />
              );
            })()}
          </div>
        </div>

        <aside style={{ width: 320 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <button onClick={resetCamera} type="button">
              Reset View
            </button>
            <button onClick={playCycle} type="button">
              Play Cycle
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Model</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={
                  settings.model.type === "custom"
                    ? "__custom__"
                    : settings.model.id
                }
                onChange={handleModelChange}
              >
                {MODEL_MANIFEST.length ? (
                  <optgroup label="Built-in">
                    {MODEL_MANIFEST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {/* If there's an imported model, always include it as a selectable option */}
                {settings.model?.type === "custom" && settings.model?.path ? (
                  <option key="__custom__" value="__custom__">
                    Imported •{" "}
                    {String(settings.model.path).split(/[\\/]/).pop()}
                  </option>
                ) : null}
              </select>
              <button onClick={handleImportModel} type="button">
                Import
              </button>
            </div>
            <div style={{ marginTop: 8, color: "#9aa0c7", fontSize: 12 }}>
              {settings.model.type === "custom" && settings.model.path
                ? `Imported from: ${settings.model.path}`
                : `Built-in model: ${
                    getBuiltinModel(settings.model.id)?.label ||
                    getDefaultModel()?.label
                  }`}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Size: <strong>{settings.model.size}</strong>
            </label>
            <input
              id="ghost-size-slider"
              type="range"
              min={10}
              max={200}
              value={settings.model.size}
              onChange={handleSizeChange}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Animation Mapping
            </label>
            <div style={{ display: "grid", gap: 8 }}>
              {STATE_KEYS.map((state) => (
                <div
                  key={state}
                  style={{ display: "flex", gap: 6, alignItems: "center" }}
                >
                  <div style={{ flex: 1 }}>{state}</div>
                  <select
                    value={settings.animations[state] || "__none__"}
                    onChange={(e) =>
                      updateAnimationSelection(state, e.target.value)
                    }
                  >
                    <option value="__none__">— None —</option>
                    {Object.entries(clipsMap).length === 0 ? (
                      <option disabled>No animations found</option>
                    ) : null}
                    {Object.entries(clipsMap).map(([key, desc]) => (
                      <option key={key} value={key}>
                        {desc.label}
                      </option>
                    ))}
                  </select>
                  <button
                    data-preview={state}
                    onClick={() => playClipForState(state)}
                    type="button"
                  >
                    Play
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button
              id="btn-save-settings-footer"
              onClick={handleSave}
              type="button"
            >
              Save
            </button>
          </div>
        </aside>
      </section>
    </div>
  );
}
