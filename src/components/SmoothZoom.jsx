import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const _offset = new THREE.Vector3();

export default function SmoothZoom({
    controlsRef,
    sensitivity,
    decay,
    minDistance,
    maxDistance,
    enabled,
}) {
    const { gl, camera } = useThree();
    const zoomV = useRef(0);
    const lastPinch = useRef(0);

    useEffect(() => {
        window.__resetZoomVelocity = () => {
            zoomV.current = 0;
        };
        return () => {
            delete window.__resetZoomVelocity;
        };
    }, []);

    useEffect(() => {
        if (!enabled) zoomV.current = 0;
    }, [enabled]);

    useEffect(() => {
        const el = gl.domElement;
        if (!el || !enabled) return;

        const onWheel = (e) => {
            e.preventDefault();
            zoomV.current = THREE.MathUtils.clamp(
                zoomV.current + e.deltaY * sensitivity,
                -0.04,
                0.04
            );
        };

        const onTouch = (e) => {
            if (e.touches.length !== 2) return;
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (e.type === "touchstart") {
                lastPinch.current = dist;
            } else {
                zoomV.current = THREE.MathUtils.clamp(
                    zoomV.current +
                        (lastPinch.current - dist) * sensitivity * 2,
                    -0.05,
                    0.05
                );
                lastPinch.current = dist;
                if (e.cancelable) e.preventDefault();
            }
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        el.addEventListener("touchstart", onTouch, { passive: false });
        el.addEventListener("touchmove", onTouch, { passive: false });

        return () => {
            el.removeEventListener("wheel", onWheel);
            el.removeEventListener("touchstart", onTouch);
            el.removeEventListener("touchmove", onTouch);
        };
    }, [gl, sensitivity, enabled]);

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls || !enabled || Math.abs(zoomV.current) < 0.0001) return;

        const frameDelta = Math.min(delta * 60, 2);
        _offset.copy(camera.position).sub(controls.target);

        const dist = _offset.length() || minDistance;
        const zoomFactor = THREE.MathUtils.clamp(
            1 + zoomV.current * frameDelta,
            0.5,
            1.5
        );
        const newDist = THREE.MathUtils.clamp(
            dist * zoomFactor,
            minDistance,
            maxDistance
        );

        _offset.setLength(newDist);
        camera.position.copy(controls.target).add(_offset);
        controls.update();

        if (newDist === minDistance || newDist === maxDistance) {
            zoomV.current = 0;
        } else {
            zoomV.current *= Math.pow(decay, frameDelta);
        }
    });

    return null;
}
