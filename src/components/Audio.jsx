import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const MIN_DIST = 1.125;
const MAX_DIST = 32;
const CROSS_PORTION = 0.08;
const SMOOTHING = 0.08;
const INITIAL_FADE_DURATION = 5000;

const INV_RANGE = 1 / (MAX_DIST - MIN_DIST);
const INV_CROSS = 1 / CROSS_PORTION;

export default function AmbientAudio({ enabled = true, onAudioLoaded }) {
    const spaceRef = useRef(null);
    const groundRef = useRef(null);
    const initialFade = useRef({ space: null, ground: null });
    const loadedRef = useRef({ space: false, ground: false });
    const enabledRef = useRef(enabled);
    const onLoadedRef = useRef(onAudioLoaded);
    const { camera } = useThree();

    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);
    useEffect(() => {
        onLoadedRef.current = onAudioLoaded;
    }, [onAudioLoaded]);

    useEffect(() => {
        const space = new Audio("/audio/space.ogg");
        const ground = new Audio("/audio/ground.ogg");

        [space, ground].forEach((a) => {
            a.loop = true;
            a.volume = 0;
            a.preload = "auto";
        });

        spaceRef.current = space;
        groundRef.current = ground;

        const onSpaceReady = () => {
            loadedRef.current.space = true;
            if (loadedRef.current.ground) onLoadedRef.current?.();
        };
        const onGroundReady = () => {
            loadedRef.current.ground = true;
            if (loadedRef.current.space) onLoadedRef.current?.();
        };

        space.addEventListener("canplaythrough", onSpaceReady);
        ground.addEventListener("canplaythrough", onGroundReady);

        const handleInteraction = () => {
            if (!enabledRef.current) return;
            const now = performance.now();
            [
                { el: space, key: "space" },
                { el: ground, key: "ground" },
            ].forEach(({ el, key }) => {
                el.play()
                    .then(() => {
                        if (!initialFade.current[key]) {
                            initialFade.current[key] = { start: now };
                        }
                    })
                    .catch(() => {});
            });
            window.removeEventListener("pointerdown", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
        };

        window.addEventListener("pointerdown", handleInteraction);
        window.addEventListener("keydown", handleInteraction);

        return () => {
            window.removeEventListener("pointerdown", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
            space.removeEventListener("canplaythrough", onSpaceReady);
            ground.removeEventListener("canplaythrough", onGroundReady);
            space.pause();
            ground.pause();
            space.src = "";
            ground.src = "";
        };
    }, []);

    useEffect(() => {
        const space = spaceRef.current;
        const ground = groundRef.current;
        if (!space || !ground) return;
        if (enabled) {
            space.play().catch(() => {});
            ground.play().catch(() => {});
        } else {
            space.pause();
            ground.pause();
        }
    }, [enabled]);

    useFrame(() => {
        const space = spaceRef.current;
        const ground = groundRef.current;
        if (!space || !ground || !enabledRef.current) return;

        const dist = camera.position.length();
        const n = Math.max(0, Math.min(1, (dist - MIN_DIST) * INV_RANGE));

        let targetSpace = 1;
        let targetGround = 0;

        if (n < CROSS_PORTION) {
            const t = n * INV_CROSS;
            targetSpace = t;
            targetGround = 1 - t;
        }

        const now = performance.now();

        const updateVolume = (key, audio, target) => {
            const fade = initialFade.current[key];
            let current;

            if (fade) {
                const t = Math.min(
                    1,
                    (now - fade.start) / INITIAL_FADE_DURATION
                );
                const eased = t * t * (3 - 2 * t);

                current = target * eased;
                if (t >= 1) initialFade.current[key] = null;
            } else {
                current = audio.volume + (target - audio.volume) * SMOOTHING;
            }

            current = Math.max(0, Math.min(1, current));
            if (Math.abs(audio.volume - current) > 0.001) {
                audio.volume = current;
            }
        };

        updateVolume("space", space, targetSpace);
        updateVolume("ground", ground, targetGround);
    });

    return null;
}
