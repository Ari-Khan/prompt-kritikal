import React, { useState, useEffect, useRef } from "react";
import Tooltip from "./Tooltip.jsx";

const TICK_OPTIONS = [
    { label: "1 update/sec", value: 1 },
    { label: "2 updates/sec", value: 0.5 },
    { label: "4 updates/sec", value: 0.25 },
    { label: "8 updates/sec", value: 0.125 },
    { label: "16 updates/sec", value: 0.0625 },
    { label: "32 updates/sec", value: 0.03125 },
];

const TEXTURE_OPTIONS = [
    "specular.avif",
    "topography.avif",
    "terrain.avif",
    "bathymetry.avif",
    "physical.avif",
    "night.avif",
].map((file) => ({
    label: file.split(".")[0].replace(/^\w/, (c) => c.toUpperCase()),
    value: file,
}));

function FPSCounter() {
    const [fps, setFps] = useState(0);
    const frames = useRef(0);
    const prevTime = useRef(0);

    useEffect(() => {
        prevTime.current = performance.now();
        let frameId;
        const loop = () => {
            frames.current++;
            const now = performance.now();
            if (now >= prevTime.current + 1000) {
                setFps(
                    Math.round(
                        (frames.current * 1000) / (now - prevTime.current)
                    )
                );
                frames.current = 0;
                prevTime.current = now;
            }
            frameId = requestAnimationFrame(loop);
        };
        frameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <div className="fps-box">
            <span className="fps-label">FPS:</span>
            <span className="fps-value">{fps}</span>
        </div>
    );
}

export default function SettingsPanel({
    tickStep,
    onTickStepChange,
    performanceSettings = {},
    onPerformanceChange,
    texture,
    onTextureChange,
    soundEnabled,
    onSoundChange,
    postEffectsEnabled,
    onPostEffectsChange,
}) {
    const [open, setOpen] = useState(false);
    const [tip, setTip] = useState({ text: null, x: 0, y: 0 });

    const handleHover = (e) => {
        const target = e.target.closest("[data-tip]");
        if (!target) return setTip({ text: null, x: 0, y: 0 });

        const rect = target.getBoundingClientRect();
        setTip({
            text: target.dataset.tip,
            x: Math.max(8, rect.left),
            y: Math.max(8, rect.top - 44),
        });
    };

    const updatePerf = (key, val) => {
        onPerformanceChange({ ...performanceSettings, [key]: val });
    };

    return (
        <>
            <div
                className="settings-panel"
                onMouseOver={handleHover}
                onMouseOut={() => setTip({ text: null })}
            >
                <button
                    className="settings-toggle"
                    onClick={() => setOpen(!open)}
                >
                    {open ? "Close Settings" : "Settings"}
                </button>

                {open && (
                    <div className="settings-body dropup">
                        <SettingRow
                            label="VRate"
                            tip="How often simulation visuals update per second."
                        >
                            <select
                                value={tickStep}
                                onChange={(e) =>
                                    onTickStepChange(Number(e.target.value))
                                }
                            >
                                {TICK_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </SettingRow>

                        <SettingRow
                            label="AA"
                            tip="Smooths edges (Multi-sample AA). GPU heavy."
                        >
                            <select
                                value={
                                    performanceSettings.antialias ? "on" : "off"
                                }
                                onChange={(e) =>
                                    updatePerf(
                                        "antialias",
                                        e.target.value === "on"
                                    )
                                }
                            >
                                <option value="on">On</option>
                                <option value="off">Off</option>
                            </select>
                        </SettingRow>

                        <SettingRow
                            label="DPR"
                            tip="Caps pixel ratio to save GPU power."
                        >
                            <select
                                value={performanceSettings.pixelRatioLimit || 2}
                                onChange={(e) =>
                                    updatePerf(
                                        "pixelRatioLimit",
                                        Number(e.target.value)
                                    )
                                }
                            >
                                {[1, 1.5, 2, 3].map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </SettingRow>

                        <SettingRow
                            label="Power"
                            tip="Prefer high-performance GPU if available."
                        >
                            <select
                                value={
                                    performanceSettings.powerPreference ||
                                    "default"
                                }
                                onChange={(e) =>
                                    updatePerf(
                                        "powerPreference",
                                        e.target.value
                                    )
                                }
                            >
                                <option value="default">Default</option>
                                <option value="high-performance">
                                    High Performance
                                </option>
                                <option value="low-power">Low Power</option>
                            </select>
                        </SettingRow>

                        <SettingRow label="Audio" tip="Toggle sound system.">
                            <select
                                value={soundEnabled ? "on" : "off"}
                                onChange={(e) =>
                                    onSoundChange(e.target.value === "on")
                                }
                            >
                                <option value="on">Enabled</option>
                                <option value="off">Disabled</option>
                            </select>
                        </SettingRow>

                        <SettingRow
                            label="SFX"
                            tip="Toggle glitch, scanlines, and post-processing."
                        >
                            <select
                                value={postEffectsEnabled ? "on" : "off"}
                                onChange={(e) =>
                                    onPostEffectsChange(e.target.value === "on")
                                }
                            >
                                <option value="on">On</option>
                                <option value="off">Off</option>
                            </select>
                        </SettingRow>

                        <SettingRow
                            label="Map"
                            tip="Change Earth surface texture."
                        >
                            <select
                                value={texture}
                                onChange={(e) =>
                                    onTextureChange(e.target.value)
                                }
                            >
                                {TEXTURE_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </SettingRow>
                    </div>
                )}
                <Tooltip {...tip} />
            </div>
        </>
    );
}

function SettingRow({ label, tip, children }) {
    return (
        <label className="settings-row">
            <span data-tip={tip}>{label}</span>
            <div className="control">{children}</div>
        </label>
    );
}
