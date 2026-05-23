import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useRef, useEffect } from "react";

const GEOM = new THREE.SphereGeometry(1, 32, 32);

const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        mat4 viewOnlyRotation = mat4(mat3(viewMatrix));
        gl_Position = projectionMatrix * viewOnlyRotation * modelMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
    }
`;

const FRAGMENT_SHADER = `
    uniform sampler2D uTexture;
    uniform float uBrightness;
    uniform float uContrast;
    varying vec2 vUv;
    void main() {
        vec3 color = pow(texture2D(uTexture, vUv).rgb, vec3(uContrast)) * uBrightness;
        gl_FragColor = vec4(color, 1.0);
    }
`;

export default function Skybox({ postEffectsEnabled = false }) {
    const texture = useTexture("/textures/starmap.png", (t) => {
        t.minFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
    });

    const brightness = postEffectsEnabled ? 3.15 : 1.75;
    const contrast = postEffectsEnabled ? 1.08 : 0.6;

    const uniformsRef = useRef({
        uTexture: { value: texture },
        uBrightness: { value: brightness },
        uContrast: { value: contrast },
    });

    useEffect(() => {
        const u = uniformsRef.current;
        u.uTexture.value = texture;
        u.uBrightness.value = brightness;
        u.uContrast.value = contrast;
    }, [texture, brightness, contrast]);

    return (
        <mesh geometry={GEOM} frustumCulled={false} renderOrder={-100}>
            <shaderMaterial
                side={THREE.BackSide}
                depthWrite={false}
                toneMapped={false}
                uniforms={uniformsRef.current}
                vertexShader={VERTEX_SHADER}
                fragmentShader={FRAGMENT_SHADER}
            />
        </mesh>
    );
}
