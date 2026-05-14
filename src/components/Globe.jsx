import { useTexture } from "@react-three/drei";
import * as THREE from "three";

const GEOM = new THREE.SphereGeometry(1, 64, 64);

export default function Globe({ textureName = "specular.avif" }) {
    const earthTexture = useTexture(`/textures/${textureName}`, (texture) => {
        texture.anisotropy = 4;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
    });

    return (
        <mesh geometry={GEOM} renderOrder={1}>
            <meshStandardMaterial
                map={earthTexture}
                roughness={0.8}
                metalness={0.1}
                envMapIntensity={0.4}
            />
        </mesh>
    );
}
