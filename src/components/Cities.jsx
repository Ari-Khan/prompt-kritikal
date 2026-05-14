import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { latLonToVec3 } from "../utils/latLonToVec3.js";

const DUMMY = new THREE.Object3D();
const CITY_GEOMETRY = new THREE.IcosahedronGeometry(1, 1);

export default function Cities({ nations = {} }) {
    const meshRef = useRef();
    const bloomRef = useRef();

    const spots = useMemo(() => {
        const out = [];

        for (const N of Object.values(nations)) {
            if (!N) continue;
            const color = new THREE.Color(N.defaultColor ?? "#ffffff");

            if (N.lat !== undefined && N.lon !== undefined) {
                const size = N.size ?? 0.003;
                out.push({
                    pos: latLonToVec3(N.lat, N.lon, 1.001),
                    color,
                    size,
                    bloomSize: size * 2.2,
                });
            }

            if (N.majorCities) {
                for (const c of N.majorCities) {
                    if (c?.lat !== undefined && c?.lon !== undefined) {
                        const size = c.size ?? 0.002;
                        out.push({
                            pos: latLonToVec3(c.lat, c.lon, 1.001),
                            color,
                            size,
                            bloomSize: size * 2.2,
                        });
                    }
                }
            }
        }
        return out;
    }, [nations]);

    useEffect(() => {
        const mesh = meshRef.current;
        const bloom = bloomRef.current;
        if (!mesh || !bloom || spots.length === 0) return;

        for (let i = 0; i < spots.length; i++) {
            const { pos, color, size, bloomSize } = spots[i];

            DUMMY.position.copy(pos);

            DUMMY.scale.setScalar(size);
            DUMMY.updateMatrix();
            mesh.setMatrixAt(i, DUMMY.matrix);
            mesh.setColorAt(i, color);

            DUMMY.scale.setScalar(bloomSize);
            DUMMY.updateMatrix();
            bloom.setMatrixAt(i, DUMMY.matrix);
            bloom.setColorAt(i, color);
        }

        mesh.instanceMatrix.needsUpdate = true;
        bloom.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        if (bloom.instanceColor) bloom.instanceColor.needsUpdate = true;
    }, [spots]);

    if (spots.length === 0) return null;

    return (
        <group>
            <instancedMesh
                ref={meshRef}
                args={[CITY_GEOMETRY, null, spots.length]}
            >
                <meshBasicMaterial transparent depthWrite={false} />
            </instancedMesh>
            <instancedMesh
                ref={bloomRef}
                args={[CITY_GEOMETRY, null, spots.length]}
            >
                <meshBasicMaterial
                    transparent
                    opacity={0.3}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                />
            </instancedMesh>
        </group>
    );
}
