import * as THREE from "three";
import { latLonToVec3 } from "./latLonToVec3.js";

export const TERMINAL_MULTIPLIER = 1.25;
export const SPEEDS = { icbm: 12, slbm: 15, air: 25 };

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _axis = new THREE.Vector3();

const ALTITUDE = 1.002;
const JITTER = 0.75;

function getJitteredVec3(lat, lon, seed = 0, target) {
    const finalSeed = lat * 133.7 + lon * 42.3 + seed;
    const jLat = lat + Math.sin(finalSeed) * JITTER;
    const jLon = lon + Math.cos(finalSeed) * JITTER;
    return latLonToVec3(jLat, jLon, ALTITUDE, target);
}

export function computeStartEndDistance({
    fromLat,
    fromLon,
    toLat,
    toLon,
    startTime,
}) {
    const start = latLonToVec3(fromLat, fromLon, ALTITUDE);
    const end = getJitteredVec3(
        Number(toLat),
        Number(toLon),
        Number(startTime)
    );
    return { start, end, distance: start.distanceTo(end) };
}

export function computeDuration(distance, weapon) {
    const speed = SPEEDS[weapon] ?? 20;
    return Math.max(5, (distance * speed) / TERMINAL_MULTIPLIER);
}

export function buildCubicCurveAndGeometry({ start, end, startTime, seed }) {
    const seedVal = seed != null ? Number(seed) : Number(startTime);
    const variance = Math.sin(seedVal * 12.9898) * 0.03;
    const d = start.distanceTo(end);
    const h = Math.max(0.1, -0.4 + d * 0.7) + variance;

    _mid.addVectors(start, end).normalize();
    if (start.dot(end) < -0.9) {
        _axis.set(
            Math.abs(start.y) < 0.9 ? 0 : 1,
            Math.abs(start.y) < 0.9 ? 1 : 0,
            0
        );
        _mid.crossVectors(start, _axis).normalize();
    }

    const ctrl1 = _v1
        .copy(start)
        .normalize()
        .lerp(_mid, 0.5)
        .normalize()
        .multiplyScalar(ALTITUDE + h)
        .clone();
    const ctrl2 = _v2
        .copy(end)
        .normalize()
        .lerp(_mid, 0.5)
        .normalize()
        .multiplyScalar(ALTITUDE + h)
        .clone();

    const cubicCurve = new THREE.CubicBezierCurve3(start, ctrl1, ctrl2, end);
    const approxLength =
        start.distanceTo(ctrl1) +
        ctrl1.distanceTo(ctrl2) +
        ctrl2.distanceTo(end);
    const segments = Math.min(600, Math.max(40, Math.ceil(approxLength * 150)));

    const pts = cubicCurve.getPoints(segments);
    const arcLengths = new Float32Array(pts.length);
    let totalLen = 0;

    for (let i = 1; i < pts.length; i++) {
        totalLen += pts[i].distanceTo(pts[i - 1]);
        arcLengths[i] = totalLen;
    }

    const invTotal = totalLen > 0 ? 1 / totalLen : 0;
    for (let i = 1; i < arcLengths.length; i++) {
        arcLengths[i] *= invTotal;
    }

    return {
        curve: cubicCurve,
        geometry: new THREE.BufferGeometry().setFromPoints(pts),
        arcLengths,
        pointsCount: pts.length,
        segments,
    };
}

export function computeTrajectory(params) {
    const { start, end, distance } = computeStartEndDistance(params);
    const duration = computeDuration(distance, params.weapon);
    return {
        start,
        end,
        distance,
        duration,
        impactTick: Number(params.startTime) + duration,
    };
}
