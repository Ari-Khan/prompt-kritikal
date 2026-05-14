import { useMemo, useState, useCallback, useEffect } from "react";

export default function ControlPanel({ nations, onRun, isRunning = false }) {
    const { allCodes, aggressorCodes } = useMemo(() => {
        const codes = Object.keys(nations);
        const aggressors = codes.filter((code) => {
            const w = nations[code]?.weapons;
            return w && (w.icbm > 0 || w.slbm > 0 || w.airLaunch > 0);
        });
        return { allCodes: codes, aggressorCodes: aggressors };
    }, [nations]);

    const [actor, setActor] = useState(() => aggressorCodes[0] ?? "");
    const [target, setTarget] = useState(
        () => allCodes.find((c) => c !== (aggressorCodes[0] ?? "")) ?? ""
    );

    const targetCodes = useMemo(
        () => allCodes.filter((c) => c !== actor),
        [allCodes, actor]
    );

    useEffect(() => {
        if (target === actor) {
            setTarget(targetCodes[0] ?? "");
        }
    }, [actor, target, targetCodes]);

    const error = useMemo(() => {
        if (aggressorCodes.length === 0) return "No armed nations found.";

        if (!actor || !target) return "Select different countries.";
        return null;
    }, [actor, target, aggressorCodes]);

    const handleRun = useCallback(() => {
        if (!error && !isRunning) onRun(actor, target);
    }, [error, isRunning, onRun, actor, target]);

    return (
        <div className={`control-panel ${isRunning ? "running-fade" : ""}`}>
            <div className="input-group">
                <label>Aggressor</label>
                <select
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                >
                    {aggressorCodes.map((c) => (
                        <option key={c} value={c}>
                            {nations[c]?.name || c}
                        </option>
                    ))}
                </select>
            </div>

            <div className="input-group">
                <label>Target</label>
                <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                >
                    {targetCodes.map((c) => (
                        <option key={c} value={c}>
                            {nations[c]?.name || c}
                        </option>
                    ))}
                </select>
            </div>

            <button
                onClick={handleRun}
                disabled={!!error || isRunning}
                className={`${error ? "dull" : ""} ${isRunning ? "running" : ""}`}
                title={error || (isRunning ? "Running…" : "Run Simulation")}
            >
                {error || (isRunning ? "Running…" : "Run Simulation")}
            </button>
        </div>
    );
}
