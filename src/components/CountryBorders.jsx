import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { latLonToVec3 } from "../utils/latLonToVec3.js";
import { useCountriesGeo } from "../hooks/useCountriesGeo.js";

const ALTITUDE = 1.002;

function countSegments(features) {
    let n = 0;
    for (let f = 0; f < features.length; f++) {
        const geom = features[f].geometry;
        if (!geom) continue;
        const polygons =
            geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
        for (let p = 0; p < polygons.length; p++) {
            const poly = polygons[p];
            for (let r = 0; r < poly.length; r++) {
                n += poly[r].length - 1;
            }
        }
    }
    return n;
}

export default function CountryBorders() {
    const geo = useCountriesGeo();

    const mergedGeometry = useMemo(() => {
        if (!geo?.features) return null;
        const features = geo.features;

        const vertices = new Float32Array(countSegments(features) * 6);
        let offset = 0;

        for (let f = 0; f < features.length; f++) {
            const geom = features[f].geometry;
            if (!geom) continue;
            const polygons =
                geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;

            for (let p = 0; p < polygons.length; p++) {
                const poly = polygons[p];
                for (let r = 0; r < poly.length; r++) {
                    const ring = poly[r];
                    for (let i = 0; i < ring.length - 1; i++) {
                        const v1 = latLonToVec3(
                            ring[i][1],
                            ring[i][0],
                            ALTITUDE
                        );
                        const v2 = latLonToVec3(
                            ring[i + 1][1],
                            ring[i + 1][0],
                            ALTITUDE
                        );
                        vertices[offset++] = v1.x;
                        vertices[offset++] = v1.y;
                        vertices[offset++] = v1.z;
                        vertices[offset++] = v2.x;
                        vertices[offset++] = v2.y;
                        vertices[offset++] = v2.z;
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(vertices, 3)
        );
        return geometry;
    }, [geo]);

    useEffect(() => () => mergedGeometry?.dispose(), [mergedGeometry]);

    if (!mergedGeometry) return null;

    return (
        <lineSegments geometry={mergedGeometry}>
            <lineBasicMaterial
                color="#ffffff"
                opacity={0.3}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
            />
        </lineSegments>
    );
}
