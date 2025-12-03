// Controlled SettingsView: renders a Three.js preview for the given assetUrl.
// Exposes imperative methods via ref: playClipByKey, playSequenceOnce, resetCamera, availableClips
// Kept minimal for migration; types are relaxed to avoid friction.
// @ts-nocheck
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GHOST_SCALE } from "../utils/Consts";

const SettingsView = forwardRef(function SettingsView(
  { assetUrl, size = 50, onClipsUpdated }: any,
  ref: any
) {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const mixerRef = useRef(null);
  const activeModelRef = useRef(null);
  const clipsRef = useRef({});
  const clockRef = useRef(new THREE.Clock());
  const loaderRef = useRef(new GLTFLoader());

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current || canvas;
    if (!canvas) return;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    const rect = wrapper.getBoundingClientRect();
    const aspect = rect.width / Math.max(rect.height, 1);
    // match main renderer camera settings for similar perspective
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(rect.width, rect.height, false);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    // main renderer uses origin as model location; match that here
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 1.1);
    directional.position.set(3, 6, 5);
    scene.add(directional);
    const rimLight = new THREE.DirectionalLight(0x7ab5ff, 0.65);
    rimLight.position.set(-4, 3, -2);
    scene.add(rimLight);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 48),
      new THREE.MeshBasicMaterial({
        color: 0x1f2230,
        opacity: 0.58,
        transparent: true,
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    let mounted = true;

    const resizeObserver = new ResizeObserver(() => {
      const r = wrapper.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(r.height, 1);
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(wrapper);

    function animate() {
      if (!mounted) return;
      requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      mixerRef.current?.update(delta);
      controlsRef.current?.update();
      rendererRef.current?.render(sceneRef.current, cameraRef.current);
    }
    animate();

    return () => {
      mounted = false;
      resizeObserver.disconnect();
      try {
        renderer.dispose();
      } catch (e) {}
    };
  }, []);

  function disposeActiveModel() {
    const scene = sceneRef.current;
    const active = activeModelRef.current;
    if (!scene || !active) return;
    scene.remove(active);
    active.traverse((child: any) => {
      if (child.isMesh) {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material))
          child.material.forEach((m: any) => m?.dispose?.());
        else child.material?.dispose?.();
      }
    });
    activeModelRef.current = null;
    mixerRef.current = null;
    clipsRef.current = {};
    if (onClipsUpdated) onClipsUpdated({});
  }

  function centerAndScale(object: THREE.Object3D, targetSize = 24) {
    const box = new THREE.Box3().setFromObject(object);
    const sizeVec = new THREE.Vector3();
    box.getSize(sizeVec);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxAxis = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
    const scale = targetSize / 100 / maxAxis;
    object.scale.setScalar(scale * (size / (size || 100)));
    object.position.sub(center);
    object.position.y += Math.abs(box.min.y || 0) * scale;
  }

  useEffect(() => {
    const scene = sceneRef.current;
    const loader = loaderRef.current;
    if (!scene || !loader) return;

    if (!assetUrl) {
      disposeActiveModel();
      return;
    }

    let cancelled = false;

    loader.load(
      assetUrl,
      (gltf: any) => {
        if (cancelled) return;
        disposeActiveModel();
        const group = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
        group.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Match the main renderer: position at origin and scale using GHOST_SCALE * (size/50)
        const normalized = size && typeof size === "number" ? size / 50 : 1;
        const scaleVal =
          (typeof GHOST_SCALE === "number" ? GHOST_SCALE : 0.2) * normalized;
        group.position.set(0, 0, 0);
        group.scale.set(scaleVal, scaleVal, scaleVal);

        scene.add(group);
        activeModelRef.current = group;

        // recompute bbox after scaling (main renderer does this to compute half-width/height)
        const newBox = new THREE.Box3().setFromObject(group);
        const newSize = new THREE.Vector3();
        newBox.getSize(newSize);

        if (gltf.animations && gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(group);
          mixerRef.current = mixer;
          const map: Record<string, any> = {};
          gltf.animations.forEach((clip: any, idx: number) => {
            const key = clip.name?.trim()
              ? `name:${clip.name.trim()}`
              : `index:${idx}`;
            map[key] = { clip, label: clip.name?.trim() || `Clip ${idx + 1}` };
          });
          clipsRef.current = map;
          if (onClipsUpdated) onClipsUpdated(map);
          // play first clip by default (looped)
          const firstKey = Object.keys(map)[0];
          if (firstKey) {
            const action = mixer.clipAction(map[firstKey].clip);
            action.reset();
            action.clampWhenFinished = true;
            action.loop = THREE.LoopRepeat;
            action.play();
          }
        } else {
          clipsRef.current = {};
          if (onClipsUpdated) onClipsUpdated({});
        }
      },
      undefined,
      (err) => {
        console.warn("Failed to load model", err);
        disposeActiveModel();
      }
    );

    return () => {
      cancelled = true;
    };
  }, [assetUrl, size]);

  useImperativeHandle(ref, () => ({
    playClipByKey(key: string) {
      const mixer = mixerRef.current;
      const entry = clipsRef.current[key];
      if (!mixer || !entry) return;
      mixer.stopAllAction();
      const action = mixer.clipAction(entry.clip);
      action.reset();
      action.clampWhenFinished = true;
      action.loop = THREE.LoopOnce;
      action.repetitions = 1;
      action.play();
    },
    playSequenceOnce(sequence: string[]) {
      const mixer = mixerRef.current;
      if (!mixer || !sequence.length) return;
      let idx = 0;
      mixer.stopAllAction();
      const handleFinished = () => {
        idx += 1;
        if (idx >= sequence.length) {
          mixer.removeEventListener("finished", handleFinished);
          return;
        }
        const entry = clipsRef.current[sequence[idx]];
        if (entry) {
          const action = mixer.clipAction(entry.clip);
          action.reset();
          action.clampWhenFinished = true;
          action.loop = THREE.LoopOnce;
          action.repetitions = 1;
          action.play();
        }
      };
      mixer.addEventListener("finished", handleFinished);
      const first = clipsRef.current[sequence[0]];
      if (first) {
        const action = mixer.clipAction(first.clip);
        action.reset();
        action.clampWhenFinished = true;
        action.loop = THREE.LoopOnce;
        action.repetitions = 1;
        action.play();
      }
    },
    resetCamera() {
      const cam = cameraRef.current;
      const controls = controlsRef.current;
      if (!cam || !controls) return;
      cam.position.set(2.8, 1.8, 2.8);
      controls.target.set(0, 1, 0);
      controls.update();
    },
    availableClips() {
      return clipsRef.current;
    },
  }));

  return (
    <div
      style={{ position: "relative", width: "100%", minHeight: 260 }}
      ref={wrapperRef}
    >
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: 260, display: "block" }}
      />
    </div>
  );
});

export default SettingsView;
