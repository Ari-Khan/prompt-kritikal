import { useState, useEffect } from "react";

export default function FpsCounter() {
    const [fps, setFps] = useState(0);

    useEffect(() => {
        let frameCount = 0;
        let lastTime = performance.now();

        const tick = () => {
            frameCount++;
            const currentTime = performance.now();
            const delta = currentTime - lastTime;

            if (delta >= 1000) {
                setFps(Math.round((frameCount * 1000) / delta));
                frameCount = 0;
                lastTime = currentTime;
            }

            requestAnimationFrame(tick);
        };

        const id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <div className="fps-box">
            <div className="fps-label">FPS:</div>
            <div className="fps-value">{fps}</div>
        </div>
    );
}
