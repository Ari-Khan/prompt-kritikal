import { useEffect, useRef } from "react";

export default function IntroScreen({ onEnter }) {
    const containerRef = useRef(null);

    useEffect(() => {
        const btn = containerRef.current?.querySelector(".intro-button");
        if (btn) btn.focus();
    }, []);

    return (
        <div ref={containerRef} className="intro-screen">
            <div className="intro-content">
                <h1 className="intro-title">PROMPT KRITIKAL</h1>
                <button className="intro-button" onClick={onEnter}>
                    ENTER SITUATION ROOM
                </button>
            </div>
        </div>
    );
}
