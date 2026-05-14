import * as THREE from "three";
import { useMemo } from "react";

const vertexShader = `
  varying float vIntensity;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    
    
    vIntensity = pow(max(0.0, 0.7 - n.z), 5.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  varying float vIntensity;
  uniform vec3 color;
  void main() {
    gl_FragColor = vec4(color, vIntensity);
  }
`;

export default function Atmosphere({ radius = 1 }) {
    const uniforms = useMemo(
        () => ({ color: { value: new THREE.Color("#88ccff") } }),
        []
    );

    return (
        <mesh scale={1.2}>
            <sphereGeometry args={[radius, 24, 24]} />
            <shaderMaterial
                vertexShader={vertexShader}
                fragmentShader={fragmentShader}
                uniforms={uniforms}
                transparent
                side={THREE.BackSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </mesh>
    );
}
