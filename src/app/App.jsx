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

// Debug component to log camera and controls data
function CameraDebug({ controlsRef }) {
    useEffect(() => {
        const logCameraData = () => {
            if (controlsRef.current) {
                const controls = controlsRef.current;
                const pos = controls.object.position;
                const target = controls.target;
                console.log(
                    `Camera Position: [${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}] | ` +
                    `Target: [${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)}] | ` +
                    `Distance: ${pos.length().toFixed(3)}`
                );
            }
        };

        const interval = setInterval(logCameraData, 500);
        return () => clearInterval(interval);
    }, [controlsRef]);

    return null;
}

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
const CAM_CONFIG_INTRO = { position: [1.18, 0.77, -0.18], fov: 60, near: 0.01, far: 1000 };
const AUTO_ROTATE_DELAY = 5000;
const AUTO_ROTATE_TARGET = -0.7; // Increased from -0.5 for faster spin
const AUTO_ROTATE_ACCEL = 0.01;
const AUTO_ROTATE_SPAWN_DISTANCE = Math.sqrt(0*0 + 1.2*1.2 + 1.8*1.8); // Distance from origin to spawn pos

function useIdleRotation(controlsRef) {
    const idleRef = useRef({
        lastActivity: 0,
        accelerating: false,
        raf: null,
        speed: 0,
    });

    useEffect(() => {
        idleRef.current.lastActivity = performance.now();
    }, []);

    const resetIdle = useCallback(() => {
        idleRef.current.lastActivity = performance.now();
        if (controlsRef.current) {
            controlsRef.current.autoRotate = false;
            controlsRef.current.autoRotateSpeed = 0;
        }
        if (idleRef.current.raf) {
            cancelAnimationFrame(idleRef.current.raf);
            idleRef.current.raf = null;
        }
        idleRef.current.accelerating = false;
        idleRef.current.speed = 0;
    }, [controlsRef]);

    useEffect(() => {
        // Only reset on meaningful interactions with the 3D scene
        // Exclude zoom (wheel) and UI interactions (keydown, button clicks)
        const handleMouseDown = (e) => {
            // Only reset if clicking on canvas, not on UI elements
            if (e.target && e.target.tagName !== 'CANVAS') return;
            resetIdle();
        };

        window.addEventListener("mousedown", handleMouseDown, { passive: true });
        // touchstart can only happen on the canvas area, so it's safe
        window.addEventListener("touchstart", resetIdle, { passive: true });

        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("touchstart", resetIdle);
        };
    }, [resetIdle]);

    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;

        // Track last known distance to detect zoom vs rotation
        const lastDistRef = { dist: controls.object.position.length() };

        const handleChange = () => {
            const currentDist = controls.object.position.length();
            // Only reset on rotation (position changes but distance roughly same)
            // Don't reset on pure zoom (distance changes significantly)
            const distDelta = Math.abs(currentDist - lastDistRef.dist);
            
            // If distance changed by more than 0.05, it's likely a zoom - don't reset spin
            if (distDelta < 0.05) {
                resetIdle();
            }
            lastDistRef.dist = currentDist;
        };

        controls.addEventListener("change", handleChange);
        return () => controls.removeEventListener("change", handleChange);
    }, [resetIdle, controlsRef]);

    useEffect(() => {
        const check = () => {
            const controls = controlsRef.current;
            if (!controls) return;

            // Check if camera is at the right distance from origin (not at exact spawn pos, which changes during rotation)
            const camDistFromOrigin = controls.object.position.length();
            const targetAtOrigin = controls.target.distanceTo(new THREE.Vector3(0, 0, 0));
            
            // Should be roughly at spawn distance (±0.3) and target at origin
            const isAtSpawnDistance = Math.abs(camDistFromOrigin - AUTO_ROTATE_SPAWN_DISTANCE) < 0.3;
            const isTargetAtOrigin = targetAtOrigin < 0.2;
            const isNearSpawn = isAtSpawnDistance && isTargetAtOrigin;

            // Only stop rotation if far from spawn distance, not just slightly off
            if (!isNearSpawn && camDistFromOrigin > AUTO_ROTATE_SPAWN_DISTANCE + 0.5) {
                if (idleRef.current.accelerating) resetIdle();
                return;
            }

            if (
                performance.now() - idleRef.current.lastActivity <
                AUTO_ROTATE_DELAY
            )
                return;

            if (!idleRef.current.accelerating && isNearSpawn) {
                idleRef.current.accelerating = true;
                idleRef.current.speed = 0;
                controls.autoRotate = true;

                const step = () => {
                    if (!idleRef.current.accelerating) return;

                    const delta =
                        idleRef.current.speed < AUTO_ROTATE_TARGET
                            ? AUTO_ROTATE_ACCEL
                            : -AUTO_ROTATE_ACCEL;

                    if (
                        Math.abs(idleRef.current.speed - AUTO_ROTATE_TARGET) <
                        0.01
                    ) {
                        idleRef.current.speed = AUTO_ROTATE_TARGET;
                    } else {
                        idleRef.current.speed +=
                            (AUTO_ROTATE_TARGET < 0 ? -1 : 1) * Math.abs(delta);
                    }

                    if (controlsRef.current)
                        controlsRef.current.autoRotateSpeed =
                            idleRef.current.speed;
                    idleRef.current.raf = requestAnimationFrame(step);
                };
                idleRef.current.raf = requestAnimationFrame(step);
            }
        };

        const interval = setInterval(check, 500);
        return () => clearInterval(interval);
    }, [resetIdle, controlsRef]);
}

function useCameraReset(controlsRef, isIntro = false) {
    const animRef = useRef(null);

    const resetCamera = useCallback((targetConfig = null) => {
        const controls = controlsRef.current;
        if (!controls) return;

        if (window.__resetZoomVelocity) window.__resetZoomVelocity();
        if (animRef.current) cancelAnimationFrame(animRef.current);

        const startPos = controls.object.position.clone();
        const startTarget = controls.target.clone();
        const config = targetConfig || (isIntro ? CAM_CONFIG_INTRO : CAM_CONFIG);
        const endPos = new THREE.Vector3(...config.position);
        const endTarget = new THREE.Vector3(0, 0, 0);

        const startTime = performance.now();
        const duration = 800;

        function tick(now) {
            const elapsed = Math.min(1, (now - startTime) / duration);
            const eased =
                elapsed < 0.5
                    ? 4 * elapsed * elapsed * elapsed
                    : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;

            controls.object.position.lerpVectors(startPos, endPos, eased);
            controls.target.lerpVectors(startTarget, endTarget, eased);
            controls.update();

            if (elapsed < 1) {
                animRef.current = requestAnimationFrame(tick);
            } else {
                animRef.current = null;
            }
        }
        animRef.current = requestAnimationFrame(tick);
    }, [controlsRef, isIntro]);

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
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        return () => {
            if (workerRef.current) workerRef.current.terminate();
        };
    }, []);

    const run = useCallback(
        (actor, target) => {
            setIsRunning(true);

            if (!workerRef.current) {
                workerRef.current = new Worker(
                    new URL("../workers/simulatorWorker.js", import.meta.url),
                    { type: "module" }
                );

                workerRef.current.onmessage = (e) => {
                    if (!e.data?.error) {
                        onEvents(e.data.events || []);
                    } else {
                        console.error("Simulation worker error:", e.data.error);
                    }
                    setIsRunning(false);
                };

                workerRef.current.onerror = (err) => {
                    console.error("Worker failed:", err);
                    setIsRunning(false);
                };
            }

            workerRef.current.postMessage({ actor, target });
        },
        [onEvents]
    );

    return { run, isRunning };
}

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [audioLoaded, setAudioLoaded] = useState(false);
    const [minLoadTimeReached, setMinLoadTimeReached] = useState(false);
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
        settings.texture || TEXTURES[0]
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

    // Trigger audio initialization on first interaction
    useEffect(() => {
        const triggerAudioInit = () => {
            const event = new PointerEvent('pointerdown', { bubbles: true });
            window.dispatchEvent(event);
            window.removeEventListener('pointerdown', triggerAudioInit);
            window.removeEventListener('keydown', triggerAudioInit);
        };
        window.addEventListener('pointerdown', triggerAudioInit, { once: true });
        window.addEventListener('keydown', triggerAudioInit, { once: true });
    }, []);

    useIdleRotation(controlsRef);
    const resetCamera = useCameraReset(controlsRef, showIntro);
    
    const introTargetRef = useRef(new THREE.Vector3(-0.23, 0.78, 0.26));
    
    // Lock intro camera target continuously
    useEffect(() => {
        if (!showIntro) return;
        
        const lockTarget = () => {
            if (controlsRef.current) {
                controlsRef.current.target.copy(introTargetRef.current);
                controlsRef.current.update();
            }
        };
        
        lockTarget();
        const interval = setInterval(lockTarget, 100);
        
        return () => clearInterval(interval);
    }, [showIntro]);
    const { run, isRunning } = useSimulationWorker(setEvents);

    const { visible, currentTick } = useEventTimeline(
        events,
        1000,
        1,
        isPaused,
        tickStep
    );

    const displayTick = currentTick;

    const handleEnterSituationRoom = useCallback(() => {
        // Fade out intro text
        const introElement = document.querySelector('.intro-content');
        if (introElement) {
            introElement.classList.add('fade-out');
        }
        
        // After fade, hide intro and animate camera smoothly
        setTimeout(() => {
            setShowIntro(false);
            // Stagger showUI to trigger fade animation
            requestAnimationFrame(() => {
                setShowUI(true);
            });
            
            // Animate camera from intro position to normal position
            if (controlsRef.current) {
                const startPos = controlsRef.current.object.position.clone();
                const startTarget = controlsRef.current.target.clone();
                const endPos = new THREE.Vector3(...CAM_CONFIG.position);
                const endTarget = new THREE.Vector3(0, 0, 0);
                const startTime = performance.now();
                const duration = 1200;

                const animateCamera = (now) => {
                    const elapsed = Math.min(1, (now - startTime) / duration);
                    const eased = elapsed < 0.5
                        ? 4 * elapsed * elapsed * elapsed
                        : 1 - Math.pow(-2 * elapsed + 2, 3) / 2;
                    
                    controlsRef.current.object.position.lerpVectors(startPos, endPos, eased);
                    controlsRef.current.target.lerpVectors(startTarget, endTarget, eased);
                    controlsRef.current.update();
                    
                    if (elapsed < 1) {
                        requestAnimationFrame(animateCamera);
                    }
                };
                requestAnimationFrame(animateCamera);
            }
        }, 400);
    }, [controlsRef]);

    const affectedIsos = useMemo(() => {
        if (!visible.length) return [];
        const isoSet = new Set();
        for (let i = 0; i < visible.length; i++) {
            const e = visible[i];
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
            recent.map((e) => {
                const {
                    fromLat: _fl,
                    fromLon: _flo,
                    toLat: _tl,
                    toLon: _tlo,
                    id: _id,
                    intensity: _in,
                    ...rest
                } = e;
                return rest;
            }),
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

    const toggleUI = () => setUiHidden((p) => !p);
    const togglePause = () => setIsPaused((p) => !p);

    // Enforce minimum load time
    useEffect(() => {
        const timer = setTimeout(() => {
            setMinLoadTimeReached(true);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    // Hide loading screen when both audio is loaded AND minimum time has passed
    useEffect(() => {
        if (audioLoaded && minLoadTimeReached) {
            setIsLoading(false);
        }
    }, [audioLoaded, minLoadTimeReached]);

    // Stable callback for audio loaded event
    const handleAudioLoaded = useCallback(() => {
        setAudioLoaded(true);
    }, []);

    // Initialize camera based on showIntro state
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
                    <div className={`control-panel-fade ${showUI ? "show" : ""}`}>
                        <ControlPanel
                            nations={world.nations}
                            onRun={run}
                            isRunning={isRunning}
                        />
                    </div>
                    <div className={`settings-panel-fade ${showUI ? "show" : ""}`}>
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
                    <div className="time-display">T+{Math.floor(displayTick)}</div>
                    <button className="hide-ui-button" onClick={toggleUI}>
                        {uiHidden ? "Show UI" : "Hide UI"}
                    </button>
                    {!uiHidden && (
                        <>
                            <button className="pause-button" onClick={togglePause}>
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
                <CameraDebug controlsRef={controlsRef} />
                <Skybox postEffectsEnabled={postEffectsEnabled} />
                <Audio enabled={soundEnabled} onAudioLoaded={handleAudioLoaded} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1.0} />

                <Suspense fallback={null}>
                    {!showIntro && (
                        <>
                            <ArcManager
                                events={visible}
                                nations={world.nations}
                                displayTime={displayTick}
                                simTime={currentTick}
                            />
                            <ExplosionManager
                                events={visible}
                                nations={world.nations}
                                displayTime={displayTick}
                            />
                        </>
                    )}

                    <PostEffects
                        enabled={postEffectsEnabled}
                        multisampling={perfSettings.antialias ? 4 : 0}
                    />

                    {showGeo && <CountryBorders />}
                    
                    {!showIntro && showGeo && (
                        <>
                            <Cities nations={world.nations} />
                            <CountryFill
                                activeIsos={affectedIsos}
                                nations={world.nations}
                            />
                        </>
                    )}
                </Suspense>

                <Globe textureName={earthTexture} />
                <Atmosphere />

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
