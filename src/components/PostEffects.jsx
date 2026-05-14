import { useEffect, useRef, useState, memo } from "react";
import { useFrame } from "@react-three/fiber";
import {
    EffectComposer,
    Noise,
    Scanline,
    Glitch,
    DepthOfField,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode } from "postprocessing";

const STARTUP_GRACE = 10000;
const GLITCH_MEAN_SECONDS = 60;
const BLUR_MEAN_SECONDS = 60;
const BLUR_DURATION_MS = 3000;
const BLUR_RISE_PORTION = 0.03;
const BLUR_SCALE = 15.0;

const sampleDelayMs = (meanSeconds) => {
    const u = Math.random() * Math.random() * Math.random();
    return -Math.log(u || 0.0001) * ((meanSeconds * 1000) / 3);
};

const PostEffects = memo(({ enabled = true, multisampling = 0 }) => {
    const glitchRef = useRef();
    const blurRef = useRef();
    const glitchOffRef = useRef(null);

    const internal = useRef({
        spawnTime: -1,
        blurStartTime: -1,
        glitchTimer: null,
        blurTimer: null,
    });

    useEffect(() => {
        if (!enabled) return;

        if (internal.current.spawnTime === -1) {
            internal.current.spawnTime = Date.now();
        }

        const scheduleGlitch = () => {
            internal.current.glitchTimer = setTimeout(() => {
                if (
                    Date.now() - internal.current.spawnTime > STARTUP_GRACE &&
                    glitchRef.current
                ) {
                    glitchRef.current.mode = GlitchMode.CONSTANT_MILD;

                    glitchOffRef.current = setTimeout(() => {
                        if (glitchRef.current)
                            glitchRef.current.mode = GlitchMode.DISABLED;

                        glitchOffRef.current = null;
                    }, 500);
                }

                scheduleGlitch();
            }, sampleDelayMs(GLITCH_MEAN_SECONDS));
        };

        const scheduleBlur = () => {
            internal.current.blurTimer = setTimeout(() => {
                internal.current.blurStartTime = performance.now();
                scheduleBlur();
            }, sampleDelayMs(BLUR_MEAN_SECONDS));
        };

        scheduleGlitch();
        scheduleBlur();

        return () => {
            clearTimeout(internal.current.glitchTimer);
            clearTimeout(internal.current.blurTimer);
            clearTimeout(glitchOffRef.current);
        };
    }, [enabled]);

    useFrame(() => {
        if (
            !enabled ||
            internal.current.blurStartTime === -1 ||
            !blurRef.current
        ) {
            return;
        }

        const elapsed = performance.now() - internal.current.blurStartTime;
        const t = elapsed / BLUR_DURATION_MS;

        if (t >= 1) {
            blurRef.current.bokehScale = 0;
            internal.current.blurStartTime = -1;
        } else {
            let ramp;

            if (t < BLUR_RISE_PORTION) {
                ramp = t / BLUR_RISE_PORTION;
            } else {
                ramp = 1 - (t - BLUR_RISE_PORTION) / (1 - BLUR_RISE_PORTION);
            }

            ramp = Math.max(0, ramp);

            ramp = ramp * ramp * (3 - 2 * ramp);

            blurRef.current.bokehScale = BLUR_SCALE * ramp;
        }
    });

    if (!enabled) return null;

    return (
        <EffectComposer multisampling={multisampling} disableNormalPass>
            <Noise
                opacity={0.3}
                blendFunction={BlendFunction.NORMAL}
                premultiply
            />

            <DepthOfField
                ref={blurRef}
                focusDistance={0}
                focusRange={1}
                bokehScale={0}
                focalLength={0.02}
            />

            <Scanline density={1.3} opacity={0.05} />

            <Glitch
                ref={glitchRef}
                mode={GlitchMode.DISABLED}
                delay={[10, 60]}
                duration={[0.4, 0.7]}
                strength={[0.3, 0.5]}
                ratio={0.25}
            />
        </EffectComposer>
    );
});

export default PostEffects;
