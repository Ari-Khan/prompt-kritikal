import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { computeTrajectory } from "../utils/trajectoryUtils.js";

const FADE_WINDOW = 6;
const SHARED_GEOM = new THREE.SphereGeometry(1, 16, 16);
const DUMMY = new THREE.Object3D();
const BASE_COLOR = new THREE.Color("#ffcc55");
const TEMP_COLOR = new THREE.Color();
const MAX_EXPLOSIONS = 1000;

export default function ExplosionManager({
    events = [],
    nations,
    displayTime,
}) {
    const meshRef = useRef();
    const processedCache = useRef(new Map());

    const mat = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            }),
        []
    );

    useEffect(() => () => mat.dispose(), [mat]);

    const processedEvents = useMemo(() => {
        if (!events?.length || !nations) {
            processedCache.current.clear();
            return [];
        }

        const cache = processedCache.current;
        const result = [];

        for (const e of events) {
            if (e.type !== "launch" || !nations[e.from] || !nations[e.to])
                continue;

            const key = e.id ?? `${e.from}-${e.to}-${e.t}`;
            if (!cache.has(key)) {
                const traj = computeTrajectory({
                    fromLat: e.fromLat ?? nations[e.from].lat,
                    fromLon: e.fromLon ?? nations[e.from].lon,
                    toLat: e.toLat ?? nations[e.to].lat,
                    toLon: e.toLon ?? nations[e.to].lon,
                    startTime: e.t,
                    weapon: e.weapon,
                });
                const count = Math.max(1, Number(e.count) || 1);
                const seed = e.t * 13.37 + count * 7.77;
                const rand = Math.abs(Math.sin(seed * 12.9898));
                cache.set(key, {
                    impactTick: e.t + traj.duration,
                    position: traj.end,
                    sizeMult:
                        (0.1 + Math.pow(count, 0.65) * 0.35) *
                        (0.8 + rand * 0.4),
                });
            }
            result.push(cache.get(key));
        }
        return result;
    }, [events, nations]);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        let renderedCount = 0;

        for (
            let i = 0;
            i < processedEvents.length && renderedCount < MAX_EXPLOSIONS;
            i++
        ) {
            const e = processedEvents[i];
            const progress = (displayTime - e.impactTick) / FADE_WINDOW;
            if (progress < 0 || progress > 1) continue;

            const scale = (0.001 + 0.02 * progress) * e.sizeMult;

            const opacity = (1 - progress) * (1 - progress);

            DUMMY.position.copy(e.position);
            DUMMY.scale.setScalar(scale);
            DUMMY.updateMatrix();
            mesh.setMatrixAt(renderedCount, DUMMY.matrix);

            TEMP_COLOR.copy(BASE_COLOR).multiplyScalar(opacity);
            mesh.setColorAt(renderedCount, TEMP_COLOR);

            renderedCount++;
        }

        mesh.count = renderedCount;

        mesh.instanceMatrix.needsUpdate = renderedCount > 0;
        if (mesh.instanceColor)
            mesh.instanceColor.needsUpdate = renderedCount > 0;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[SHARED_GEOM, mat, MAX_EXPLOSIONS]}
            frustumCulled={false}
        />
    );
}
