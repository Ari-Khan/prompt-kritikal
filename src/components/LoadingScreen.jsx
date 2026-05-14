import { useState, useEffect } from "react";

export default function LoadingScreen({ isLoading }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!isLoading) {
            setProgress(100);
            return;
        }

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 90) return prev;

                return Math.min(90, prev + Math.random() * 30);
            });
        }, 200);

        return () => clearInterval(interval);
    }, [isLoading]);

    return (
        <div className={`loading-screen ${!isLoading ? "hidden" : ""}`}>
            <div className="loading-bar-container">
                <div
                    className="loading-bar"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>
    );
}
