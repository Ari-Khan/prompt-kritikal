import {
    useMemo,
    useState,
    useRef,
    useEffect,
    useCallback,
    Suspense,
} from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import Globe from "../components/Globe.jsx";
import CountryBorders from "../components/CountryBorders.jsx";
import ControlPanel from "../components/ControlPanel.jsx";
import CountryFill from "../components/CountryFill.jsx";
import Skybox from "../components/Skybox.jsx";
import Atmosphere from "../components/Atmosphere.jsx";
import ExplosionManager from "../components/Explosion.jsx";
import ArcManager from "../components/Arc.jsx";
import Cities from "../components/Cities.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import SmoothZoom from "../components/SmoothZoom.jsx";
import Audio from "../components/Audio.jsx";
import PostEffects from "../components/PostEffects.jsx";
import IntroScreen from "../components/IntroScreen.jsx";
import LoadingScreen from "../components/LoadingScreen.jsx";
import FpsCounter from "../components/FpsCounter.jsx";

import { useEventTimeline } from "../hooks/useEventTimeline.js";
import { loadWorld } from "../utils/loadData.js";

import "../index.css";
import settings from "../config/settings.json";

const world = loadWorld();

const TEXTURES = [
    "specular.avif",
    "topography.avif",
    "terrain.avif",
    "bathymetry.avif",
    "physical.avif",
    "night.avif",
];

const CAM_CONFIG = { position: [0, 1.2, 1.8], fov: 60, near: 0.01, far: 1000 };
const CAM_CONFIG_INTRO = {
    position: [1.18, 0.77, -0.18],
    fov: 60,
    near: 0.01,
    far: 1000,
};

const INTRO_TARGET = new THREE.Vector3(-0.23, 0.78, 0.26);
const ORIGIN = new THREE.Vector3(0, 0, 0);

const AUTO_ROTATE_DELAY = 5000;
const AUTO_ROTATE_TARGET = -0.6;
const AUTO_ROTATE_ACCEL = 0.01;
const AUTO_ROTATE_SPAWN_DISTANCE = Math.sqrt(1.2 * 1.2 + 1.8 * 1.8);

function useIdleRotation(controlsRef) {
    const idleRef = useRef({
        lastActivity: performance.now(),
        accelerating: false,
        raf: null,
        speed: 0,
    });

    const resetIdle = useCallback(() => {
        idleRef.current.lastActivity = performance.now();
        const controls = controlsRef.current;
        if (controls) {
            controls.autoRotate = false;
            controls.autoRotateSpeed = 0;
        }
        if (idleRef.current.raf) {
            cancelAnimationFrame(idleRef.current.raf);
            idleRef.current.raf = null;
        }
        idleRef.current.accelerating = false;
        idleRef.current.speed = 0;
    }, [controlsRef]);

    useEffect(() => {
        const onMouseDown = (e) => {
            if (e.target?.tagName !== "CANVAS") return;
            resetIdle();
        };
        window.addEventListener("mousedown", onMouseDown, { passive: true });
        const onTouchStart = (e) => {
            if (e.touches.length !== 1) return;
            if (e.target?.tagName !== "CANVAS") return;
            resetIdle();
        };
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        return () => {
            window.removeEventListener("mousedown", onMouseDown);
            window.removeEventListener("touchstart", onTouchStart);
        };
    }, [resetIdle]);

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        let lastDist = controls.object.position.length();

        const onControlsChange = () => {
            if (window.__isZooming?.()) {
                lastDist = controls.object.position.length();
                return;
            }
            
            const dist = controls.object.position.length();
            const delta = Math.abs(dist - lastDist);
            if (delta < 0.05 && !controls.autoRotate) resetIdle();
            lastDist = dist;
        };

        controls.addEventListener("change", onControlsChange);
        return () => controls.removeEventListener("change", onControlsChange);
    }, [resetIdle, controlsRef]);

    useEffect(() => {
        const check = () => {
            const controls = controlsRef.current;
            if (!controls) return;

            const targetDist = controls.target.distanceTo(ORIGIN);
            const targetAtOrigin = targetDist < 0.2;

            if (
                performance.now() - idleRef.current.lastActivity <
                AUTO_ROTATE_DELAY
            )
                return;

            if (!idleRef.current.accelerating && targetAtOrigin) {
                idleRef.current.accelerating = true;
                idleRef.current.speed = 0;
                controls.autoRotate = true;

                const step = () => {
                    if (!idleRef.current.accelerating) return;

                    const diff = AUTO_ROTATE_TARGET - idleRef.current.speed;

                    if (Math.abs(diff) <= AUTO_ROTATE_ACCEL) {
                        idleRef.current.speed = AUTO_ROTATE_TARGET;
                        if (controlsRef.current) {
                            controlsRef.current.autoRotateSpeed =
                                AUTO_ROTATE_TARGET;
                        }
                        idleRef.current.raf = null;
                        return;
                    }

                    idleRef.current.speed +=
                        Math.sign(diff) * AUTO_ROTATE_ACCEL;
                    if (controlsRef.current) {
                        controlsRef.current.autoRotateSpeed =
                            idleRef.current.speed;
                    }
                    idleRef.current.raf = requestAnimationFrame(step);
                };
                idleRef.current.raf = requestAnimationFrame(step);
            }
        };

        const interval = setInterval(check, 500);
        return () => clearInterval(interval);
    }, [resetIdle, controlsRef]);
}

function useCameraReset(controlsRef, isIntro) {
    const animRef = useRef(null);
    const isIntroRef = useRef(isIntro);
    useEffect(() => {
        isIntroRef.current = isIntro;
    }, [isIntro]);

    const resetCamera = useCallback(
        (targetConfig = null) => {
            const controls = controlsRef.current;
            if (!controls) return;

            if (window.__resetZoomVelocity) window.__resetZoomVelocity();
            if (animRef.current) cancelAnimationFrame(animRef.current);

            const startPos = controls.object.position.clone();
            const startTarget = controls.target.clone();
            const config =
                targetConfig ??
                (isIntroRef.current ? CAM_CONFIG_INTRO : CAM_CONFIG);
            const endPos = new THREE.Vector3(...config.position);
            const endTarget = ORIGIN.clone();

            const startTime = performance.now();
            const duration = 800;

            const tick = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const eased =
                    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                controls.object.position.lerpVectors(startPos, endPos, eased);
                controls.target.lerpVectors(startTarget, endTarget, eased);
                controls.update();

                if (t < 1) {
                    animRef.current = requestAnimationFrame(tick);
                } else {
                    animRef.current = null;
                }
            };
            animRef.current = requestAnimationFrame(tick);
        },
        [controlsRef]
    );

    useEffect(
        () => () => {
            if (animRef.current) cancelAnimationFrame(animRef.current);
        },
        []
    );

    return resetCamera;
}

function useSimulationWorker(onEvents) {
    const workerRef = useRef(null);
    const onEventsRef = useRef(onEvents);
    useEffect(() => {
        onEventsRef.current = onEvents;
    }, [onEvents]);

    const [isRunning, setIsRunning] = useState(false);

    useEffect(
        () => () => {
            workerRef.current?.terminate();
        },
        []
    );

    const run = useCallback((actor, target) => {
        setIsRunning(true);

        if (!workerRef.current) {
            workerRef.current = new Worker(
                new URL("../workers/simulatorWorker.js", import.meta.url),
                { type: "module" }
            );
            workerRef.current.onerror = (err) => {
                console.error("Simulation worker failed:", err);
                setIsRunning(false);
            };
        }

        workerRef.current.onmessage = (e) => {
            if (e.data?.error) {
                console.error("Simulation worker error:", e.data.error);
            } else {
                onEventsRef.current(e.data.events ?? []);
            }
            setIsRunning(false);
        };

        workerRef.current.postMessage({ actor, target });
    }, []);

    return { run, isRunning };
}

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [audioLoaded, setAudioLoaded] = useState(false);
    const [minLoadDone, setMinLoadDone] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [showUI, setShowUI] = useState(false);
    const [events, setEvents] = useState(null);
    const [tickStep, setTickStep] = useState(settings.tickStep);
    const [isPaused, setIsPaused] = useState(false);
    const [showGeo, setShowGeo] = useState(false);
    const [uiHidden, setUiHidden] = useState(false);

    const [perfSettings, setPerfSettings] = useState(() => ({
        antialias: settings.antialias,
        pixelRatioLimit: settings.pixelRatioLimit,
        powerPreference: settings.powerPreference,
        preserveDrawingBuffer: settings.preserveDrawingBuffer,
    }));
    const [earthTexture, setEarthTexture] = useState(
        settings.texture ?? TEXTURES[0]
    );
    const [soundEnabled, setSoundEnabled] = useState(
        Boolean(settings.audioEnabled)
    );
    const [postEffectsEnabled, setPostEffectsEnabled] = useState(
        settings.postEffectsEnabled ?? true
    );

    const controlsRef = useRef();

    useEffect(() => {
        const id = setTimeout(() => setShowGeo(true), 300);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        const unlock = () =>
            window.dispatchEvent(
                new PointerEvent("pointerdown", { bubbles: true })
            );
        window.addEventListener("pointerdown", unlock, { once: true });
        window.addEventListener("keydown", unlock, { once: true });
        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, []);

    useIdleRotation(controlsRef);
    const resetCamera = useCameraReset(controlsRef, showIntro);

    useEffect(() => {
        if (!showIntro) return;

        let cleanupFn = null;

        const lock = () => {
            const controls = controlsRef.current;
            if (!controls) return;
            if (!controls.target.equals(INTRO_TARGET)) {
                controls.target.copy(INTRO_TARGET);
                controls.update();
            }
        };

        const attach = () => {
            const controls = controlsRef.current;
            if (!controls) return false;
            lock();
            controls.addEventListener("change", lock);
            cleanupFn = () => controls.removeEventListener("change", lock);
            return true;
        };

        if (!attach()) {
            const poll = setInterval(() => {
                if (attach()) clearInterval(poll);
            }, 50);
            return () => {
                clearInterval(poll);
                cleanupFn?.();
            };
        }

        return () => cleanupFn?.();
    }, [showIntro]);

    const { run, isRunning } = useSimulationWorker(setEvents);
    const { visible, currentTick } = useEventTimeline(
        events,
        1000,
        1,
        isPaused,
        tickStep
    );

    const handleEnterSituationRoom = useCallback(() => {
        const introEl = document.querySelector(".intro-content");
        introEl?.classList.add("fade-out");

        setTimeout(() => {
            setShowIntro(false);
            requestAnimationFrame(() => setShowUI(true));
            resetCamera(CAM_CONFIG);
        }, 400);
    }, [resetCamera]);

    const affectedIsos = useMemo(() => {
        if (!visible.length) return [];
        const isoSet = new Set();
        for (const e of visible) {
            if (e.from) isoSet.add(e.from.toUpperCase());
            if (e.to) isoSet.add(e.to.toUpperCase());
            if (e.attacker) isoSet.add(e.attacker.toUpperCase());
            if (e.target) isoSet.add(e.target.toUpperCase());
        }
        return Array.from(isoSet);
    }, [visible]);

    const logDisplay = useMemo(() => {
        if (uiHidden || !visible.length) return "SYSTEM READY";
        const recent = visible.slice(-50).reverse();
        return JSON.stringify(
            recent.map(
                ({
                    fromLat: _fl,
                    fromLon: _flo,
                    toLat: _tl,
                    toLon: _tlo,
                    id: _id,
                    intensity: _in,
                    ...rest
                }) => rest
            ),
            null,
            2
        );
    }, [visible, uiHidden]);

    const glConfig = useMemo(
        () => ({
            antialias: perfSettings.antialias,
            powerPreference: perfSettings.powerPreference,
            preserveDrawingBuffer: perfSettings.preserveDrawingBuffer,
            logarithmicDepthBuffer: false,
            alpha: false,
            stencil: false,
            depth: true,
        }),
        [perfSettings]
    );

    useEffect(() => {
        const id = setTimeout(() => setMinLoadDone(true), 1500);
        return () => clearTimeout(id);
    }, []);

    useEffect(() => {
        if (audioLoaded && minLoadDone) setIsLoading(false);
    }, [audioLoaded, minLoadDone]);

    const handleAudioLoaded = useCallback(() => setAudioLoaded(true), []);

    const toggleUI = useCallback(() => setUiHidden((p) => !p), []);
    const togglePause = useCallback(() => setIsPaused((p) => !p), []);

    const initialCamera = showIntro ? CAM_CONFIG_INTRO : CAM_CONFIG;

    return (
        <div className="app-container">
            <LoadingScreen isLoading={isLoading} />

            {!showIntro && (
                <div className={`fps-counter-fade ${showUI ? "show" : ""}`}>
                    <FpsCounter />
                </div>
            )}

            {showIntro && <IntroScreen onEnter={handleEnterSituationRoom} />}

            {!uiHidden && !showIntro && (
                <>
                    <div
                        className={`control-panel-fade ${showUI ? "show" : ""}`}
                    >
                        <ControlPanel
                            nations={world.nations}
                            onRun={run}
                            isRunning={isRunning}
                        />
                    </div>
                    <div
                        className={`settings-panel-fade ${showUI ? "show" : ""}`}
                    >
                        <SettingsPanel
                            tickStep={tickStep}
                            onTickStepChange={setTickStep}
                            performanceSettings={perfSettings}
                            onPerformanceChange={setPerfSettings}
                            texture={earthTexture}
                            onTextureChange={setEarthTexture}
                            soundEnabled={soundEnabled}
                            onSoundChange={setSoundEnabled}
                            postEffectsEnabled={postEffectsEnabled}
                            onPostEffectsChange={setPostEffectsEnabled}
                        />
                    </div>
                </>
            )}

            {!showIntro && (
                <div className="time-controls">
                    <div className="time-display">
                        T+{Math.floor(currentTick)}
                    </div>
                    <button className="hide-ui-button" onClick={toggleUI}>
                        {uiHidden ? "Show UI" : "Hide UI"}
                    </button>
                    {!uiHidden && (
                        <>
                            <button
                                className="pause-button"
                                onClick={togglePause}
                            >
                                {isPaused ? "Resume" : "Pause"}
                            </button>
                            <button
                                className="pause-button reset-button"
                                onClick={() => resetCamera(CAM_CONFIG)}
                            >
                                Reset Cam
                            </button>
                        </>
                    )}
                </div>
            )}

            {!showIntro && !uiHidden && logDisplay && (
                <pre className="event-log">{logDisplay}</pre>
            )}

            <Canvas
                key={JSON.stringify(perfSettings)}
                className="canvas-3d"
                dpr={[1, perfSettings.pixelRatioLimit]}
                gl={glConfig}
                camera={initialCamera}
            >
                <Skybox postEffectsEnabled={postEffectsEnabled} />
                <Audio
                    enabled={soundEnabled}
                    onAudioLoaded={handleAudioLoaded}
                />
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1.0} />

                <Suspense fallback={null}>
                    {!showIntro && (
                        <>
                            <ArcManager
                                events={visible}
                                nations={world.nations}
                                displayTime={currentTick}
                                simTime={currentTick}
                            />
                            <ExplosionManager
                                events={visible}
                                nations={world.nations}
                                displayTime={currentTick}
                            />
                        </>
                    )}

                    <PostEffects
                        enabled={postEffectsEnabled}
                        multisampling={perfSettings.antialias ? 4 : 0}
                    />

                    {showGeo && <CountryBorders />}

                    {!showIntro && showGeo && (
                        <CountryFill
                            activeIsos={affectedIsos}
                            nations={world.nations}
                        />
                    )}
                </Suspense>

                <Globe textureName={earthTexture} />
                <Atmosphere />
                <Cities nations={world.nations} />

                <OrbitControls
                    ref={controlsRef}
                    enableZoom={false}
                    enableDamping={true}
                    dampingFactor={0.04}
                    minDistance={1.125}
                    maxDistance={32}
                />

                <SmoothZoom
                    controlsRef={controlsRef}
                    sensitivity={0.0001}
                    decay={0.925}
                    minDistance={1.125}
                    maxDistance={32}
                    enabled={true}
                />
            </Canvas>
        </div>
    );
}
