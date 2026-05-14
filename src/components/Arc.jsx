import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
    computeTrajectory,
    buildCubicCurveAndGeometry,
} from "../utils/trajectoryUtils.js";

const UP_AXIS = new THREE.Vector3(0, 1, 0);
const FADE_BUFFER = 0.5;
const CONE_GEOM = new THREE.ConeGeometry(0.003, 0.01, 8);

const ArcItem = ({
    id,
    startTime,
    displayTime,
    simTime,
    impactTick,
    trajStart,
    trajEnd,
    trajDuration,
}) => {
    const lineRef = useRef();
    const coneRef = useRef();

    const tempVec = useMemo(() => new THREE.Vector3(), []);

    const data = useMemo(() => {
        const seed =
            Number(startTime) +
            (typeof id === "string" ? Number(id.split("-").pop() || 0) : 0);

        return buildCubicCurveAndGeometry({
            start: trajStart,
            end: trajEnd,
            startTime,
            seed,
        });
    }, [trajStart, trajEnd, startTime, trajDuration, id]);

    useEffect(() => () => data.geometry?.dispose(), [data.geometry]);

    useFrame(() => {
        if (!lineRef.current || !coneRef.current) return;

        const delta = displayTime - startTime;
        const t = Math.max(0, Math.min(1, delta / trajDuration));

        let u = t;
        const arcs = data.arcLengths;
        if (arcs?.length > 1) {
            let low = 0,
                high = arcs.length - 1;
            while (low < high) {
                const mid = (low + high) >>> 1;
                if (arcs[mid] < t) low = mid + 1;
                else high = mid;
            }
            const i = Math.max(0, low - 1);
            const lowArc = arcs[i];
            const range = arcs[i + 1] - lowArc;
            u = (i + (t - lowArc) / (range || 1)) / (arcs.length - 1);
        }

        lineRef.current.geometry.setDrawRange(
            0,
            Math.ceil(u * (data.pointsCount - 1))
        );

        if (t < 1) {
            data.curve.getPoint(u, coneRef.current.position);

            data.curve.getTangent(u, tempVec);
            coneRef.current.quaternion.setFromUnitVectors(UP_AXIS, tempVec);
            coneRef.current.visible = true;
        } else {
            coneRef.current.visible = false;
        }

        const opacity =
            simTime >= impactTick
                ? Math.max(0, 1 - (simTime - impactTick) * (1 / FADE_BUFFER))
                : 1;

        lineRef.current.material.opacity = opacity;
        coneRef.current.material.opacity = opacity;
    });

    return (
        <group>
            <line ref={lineRef} geometry={data.geometry}>
                <lineBasicMaterial
                    color="#ff4d00"
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </line>
            <mesh ref={coneRef} geometry={CONE_GEOM} visible={false}>
                <meshBasicMaterial
                    color="#ff5533"
                    transparent
                    depthWrite={false}
                    blending={THREE.AdditiveBlending}
                />
            </mesh>
        </group>
    );
};

export default function ArcManager({ events, nations, displayTime, simTime }) {
    const arcDataMap = useMemo(() => {
        if (!events || !nations) return [];
        const result = [];
        for (let i = 0; i < events.length; i++) {
            const e = events[i];
            if (e.type !== "launch") continue;

            const from = nations[e.from];
            const to = nations[e.to];
            if (!from || !to) continue;

            const fromLat = e.fromLat ?? from.lat;
            const fromLon = e.fromLon ?? from.lon;
            const toLat = e.toLat ?? to.lat;
            const toLon = e.toLon ?? to.lon;

            const traj = computeTrajectory({
                fromLat,
                fromLon,
                toLat,
                toLon,
                startTime: e.t,
                weapon: e.weapon,
            });
            const impactTick = e.t + traj.duration;

            result.push({
                ...e,
                fromLat,
                fromLon,
                toLat,
                toLon,
                impactTick,
                trajStart: traj.start,
                trajEnd: traj.end,
                trajDuration: traj.duration,
            });
        }
        return result;
    }, [events, nations]);

    const activeEvents = useMemo(
        () =>
            arcDataMap.filter(
                (e) => simTime >= e.t && simTime <= e.impactTick + FADE_BUFFER
            ),
        [arcDataMap, simTime]
    );

    return (
        <group>
            {activeEvents.map((e) => (
                <ArcItem
                    key={e.id ?? `${e.from}-${e.to}-${e.t}`}
                    id={e.id}
                    startTime={e.t}
                    displayTime={displayTime}
                    simTime={simTime}
                    impactTick={e.impactTick}
                    trajStart={e.trajStart}
                    trajEnd={e.trajEnd}
                    trajDuration={e.trajDuration}
                />
            ))}
        </group>
    );
}
