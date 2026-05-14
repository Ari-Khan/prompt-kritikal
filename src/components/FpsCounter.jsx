import { useState, useEffect, useRef } from "react";

export default function FpsCounter() {
    const [fps] = useState(0);
    const fpsRef = useRef(fps);
    const rafRef = useRef();
    const [, rerender] = useState(0);

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();

        const tick = () => {
            frameCount++;
            const now = performance.now();
            const delta = now - lastTime;

            if (delta >= 1000) {
                fpsRef.current = Math.round((frameCount * 1000) / delta);
                frameCount = 0;
                lastTime = now;
                rerender((n) => n + 1);
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    return (
        <div className="fps-box">
            <div className="fps-label">FPS:</div>
            <div className="fps-value">{fpsRef.current}</div>
        </div>
    );
}
