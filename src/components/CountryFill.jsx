import { useEffect, useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import earcut from "earcut";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { latLonToVec3 } from "../utils/latLonToVec3.js";
import { useCountriesGeo } from "../hooks/useCountriesGeo.js";
import { getColorByIso } from "../utils/countryUtils.js";

const GEOMETRY_CACHE = new Map();
const MOD_1 = new TessellateModifier(2.0, 4);
const MOD_2 = new TessellateModifier(0.8, 6);
const MOD_3 = new TessellateModifier(0.3, 6);

function buildMesh(rings) {
    if (!rings?.length || rings[0].length < 3) return null;

    const outerRing = rings[0];
    let centerLon = 0;
    for (let i = 0; i < outerRing.length; i++) centerLon += outerRing[i][0];
    centerLon /= outerRing.length;

    const vertices2D = [];
    const holeIndices = [];

    for (let ri = 0; ri < rings.length; ri++) {
        if (ri > 0) holeIndices.push(vertices2D.length / 2);
        const ring = rings[ri];
        for (let i = 0; i < ring.length; i++) {
            let lon = ring[i][0] - centerLon;
            if (lon > 180) lon -= 360;
            if (lon < -180) lon += 360;
            vertices2D.push(lon, ring[i][1]);
        }
    }

    const rawIndices = earcut(vertices2D, holeIndices);
    if (!rawIndices.length) return null;

    const cleanIndices = [];
    for (let i = 0; i < rawIndices.length; i += 3) {
        const a = rawIndices[i],
            b = rawIndices[i + 1],
            c = rawIndices[i + 2];
        const ax = vertices2D[a * 2],
            bx = vertices2D[b * 2],
            cx = vertices2D[c * 2];
        if (
            Math.abs(ax - bx) > 180 ||
            Math.abs(bx - cx) > 180 ||
            Math.abs(ax - cx) > 180
        )
            continue;
        cleanIndices.push(a, b, c);
    }
    if (!cleanIndices.length) return null;

    const flatPositions = new Float32Array((vertices2D.length / 2) * 3);
    for (let i = 0, j = 0; i < vertices2D.length; i += 2, j += 3) {
        flatPositions[j] = vertices2D[i];
        flatPositions[j + 1] = vertices2D[i + 1];
        flatPositions[j + 2] = 0;
    }

    let geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(flatPositions, 3));
    geom.setIndex(cleanIndices);

    try {
        const g1 = MOD_1.modify(geom);
        geom.dispose();
        geom = g1;
        const g2 = MOD_2.modify(geom);
        geom.dispose();
        geom = g2;
        const g3 = MOD_3.modify(geom);
        geom.dispose();
        geom = g3;
    } catch {}

    const posAttr = geom.getAttribute("position");
    for (let i = 0; i < posAttr.count; i++) {
        let lon = posAttr.getX(i) + centerLon;
        if (lon > 180) lon -= 360;
        if (lon < -180) lon += 360;
        const v = latLonToVec3(posAttr.getY(i), lon, 1.003);
        posAttr.setXYZ(i, v.x, v.y, v.z);
    }

    geom.computeVertexNormals();
    return geom;
}

function buildGeometries(features, countryCode) {
    if (!features?.length || !countryCode) return [];
    if (GEOMETRY_CACHE.has(countryCode)) return GEOMETRY_CACHE.get(countryCode);

    const geometries = [];
    for (let f = 0; f < features.length; f++) {
        const geom = features[f].geometry;
        if (!geom) continue;
        if (geom.type === "Polygon") {
            const g = buildMesh(geom.coordinates);
            if (g) geometries.push(g);
        } else if (geom.type === "MultiPolygon") {
            for (let p = 0; p < geom.coordinates.length; p++) {
                const g = buildMesh(geom.coordinates[p]);
                if (g) geometries.push(g);
            }
        }
    }

    GEOMETRY_CACHE.set(countryCode, geometries);
    return geometries;
}

export default function CountryFill({
    activeIsos = [],
    nations = {},
    opacity = 0.4,
}) {
    const geo = useCountriesGeo();
    const materialRefs = useRef({});
    const prevIsosRef = useRef(new Set());
    const animsRef = useRef(new Map());
    const rafRef = useRef(null);
    const opacityRef = useRef(opacity);

    useEffect(() => {
        opacityRef.current = opacity;
    }, [opacity]);

    const featuresByIso = useMemo(() => {
        if (!geo?.features) return new Map();
        const map = new Map();
        for (const feature of geo.features) {
            const p = feature.properties || {};
            const isos = new Set(
                [p.adm0_a3, p.iso_a3_eh, p.gu_a3, p.ISO_A3, p.iso_a3].filter(
                    Boolean
                )
            );
            for (const iso of isos) {
                if (!map.has(iso)) map.set(iso, []);
                map.get(iso).push(feature);
            }
        }
        return map;
    }, [geo]);

    const activeGroups = useMemo(() => {
        const uniqueIsos = [...new Set(activeIsos.map((i) => i.toUpperCase()))];
        return uniqueIsos
            .map((iso) => ({
                iso,
                features: featuresByIso.get(iso) ?? [],
                color: getColorByIso(iso, nations),
            }))
            .filter((g) => g.features.length > 0);
    }, [featuresByIso, activeIsos, nations]);

    const meshesByIso = useMemo(() => {
        const map = new Map();
        for (const g of activeGroups) {
            map.set(g.iso, buildGeometries(g.features, g.iso));
        }
        return map;
    }, [activeGroups]);

    const kickAnimations = useCallback(() => {
        if (rafRef.current !== null) return;

        const tick = (now) => {
            animsRef.current.forEach((anim, key) => {
                const mat = materialRefs.current[key];
                if (!mat) return;

                const t = Math.min(1, (now - anim.start) / anim.duration);
                const eased = t * t * (3 - 2 * t);

                mat.opacity =
                    anim.type === "in"
                        ? opacityRef.current * eased
                        : opacityRef.current * (1 - eased);

                if (t >= 1) {
                    if (anim.type === "out") mat.opacity = 0;
                    animsRef.current.delete(key);
                }
            });

            rafRef.current =
                animsRef.current.size > 0 ? requestAnimationFrame(tick) : null;
        };
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        const now = performance.now();
        const currentSet = new Set(activeGroups.map((g) => g.iso));
        let needsAnim = false;

        for (const { iso } of activeGroups) {
            if (!prevIsosRef.current.has(iso)) {
                const count = meshesByIso.get(iso)?.length ?? 0;
                for (let i = 0; i < count; i++) {
                    const key = `${iso}-${i}`;
                    animsRef.current.set(key, {
                        type: "in",
                        start: now,
                        duration: 800,
                    });

                    if (materialRefs.current[key])
                        materialRefs.current[key].opacity = 0;
                }
                if (count > 0) needsAnim = true;
            }
        }

        for (const iso of prevIsosRef.current) {
            if (!currentSet.has(iso)) {
                Object.keys(materialRefs.current).forEach((key) => {
                    if (key.startsWith(`${iso}-`)) {
                        animsRef.current.set(key, {
                            type: "out",
                            start: now,
                            duration: 400,
                        });
                        needsAnim = true;
                    }
                });
            }
        }

        prevIsosRef.current = currentSet;
        if (needsAnim) kickAnimations();
    }, [activeGroups, meshesByIso, kickAnimations]);

    useEffect(
        () => () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        },
        []
    );

    if (!geo) return null;

    return (
        <group>
            {activeGroups.map(({ iso, color }) => (
                <group key={iso}>
                    {(meshesByIso.get(iso) ?? []).map((geometry, i) => (
                        <mesh
                            key={`${iso}-${i}`}
                            geometry={geometry}
                            renderOrder={10}
                        >
                            <meshBasicMaterial
                                ref={(el) => {
                                    materialRefs.current[`${iso}-${i}`] = el;

                                    if (el && !prevIsosRef.current.has(iso))
                                        el.opacity = 0;
                                }}
                                color={color}
                                transparent
                                opacity={0}
                                side={THREE.DoubleSide}
                                depthWrite={false}
                                toneMapped={false}
                            />
                        </mesh>
                    ))}
                </group>
            ))}
        </group>
    );
}
