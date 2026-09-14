import React, { useMemo, useState, useCallback, useRef, useEffect } from "react";

/**
 * DSP Pre-Processing parameters as returned by the backend API.
 */
export type DspParams = {
    dspEnabled: boolean;
    dspPreprocessMonitor: boolean;
    dspGateThreshold: number;
    dspGateAttack: number;
    dspGateRelease: number;
    dspHighpassCutoff: number;
    dspHighshelfCutoff: number;
    dspHighshelfGain: number;
    dspCompressorThreshold: number;
    dspCompressorRatio: number;
    dspCompAttack: number;
    dspCompRelease: number;
    dspCompressorMakeupGain: number;
    dspLimiterEnabled: boolean;
};

const DEFAULT_DSP_PARAMS: DspParams = {
    dspEnabled: false,
    dspPreprocessMonitor: false,
    dspGateThreshold: -50,
    dspGateAttack: 2.0,
    dspGateRelease: 150.0,
    dspHighpassCutoff: 80,
    dspHighshelfCutoff: 4000,
    dspHighshelfGain: 0,
    dspCompressorThreshold: -20,
    dspCompressorRatio: 4,
    dspCompAttack: 5.0,
    dspCompRelease: 50.0,
    dspCompressorMakeupGain: 0,
    dspLimiterEnabled: false,
};

/**
 * Fetch current DSP params from the backend.
 */
const fetchDspParams = async (serverUrl: string): Promise<DspParams> => {
    const res = await fetch(`${serverUrl}/dsp_preprocess`);
    return (await res.json()) as DspParams;
};

/**
 * Send a partial update to the backend and return the new full state.
 */
const updateDspParams = async (
    serverUrl: string,
    updates: Partial<DspParams>
): Promise<DspParams> => {
    const res = await fetch(`${serverUrl}/dsp_preprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
    });
    return (await res.json()) as DspParams;
};

/**
 * Custom hook for debounced DSP parameter updates.
 */
const useDebouncedDspUpdate = (
    serverUrl: string,
    params: DspParams,
    setParams: React.Dispatch<React.SetStateAction<DspParams>>,
    delayMs: number = 50
) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<Partial<DspParams>>({});

    const flush = useCallback(() => {
        if (Object.keys(pendingRef.current).length === 0) return;
        const toSend = { ...pendingRef.current };
        pendingRef.current = {};
        
        // If serverUrl is empty, it uses the relative path (same host)
        const targetUrl = serverUrl || "";
        updateDspParams(targetUrl, toSend)
            .catch((e) => console.error("Failed to update DSP params", e));
    }, [serverUrl, setParams]);

    const enqueue = useCallback(
        (key: keyof DspParams, value: number | boolean) => {
            // Optimistic update
            setParams((prev) => ({ ...prev, [key]: value }));
            pendingRef.current[key] = value as any;

            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(flush, delayMs);
        },
        [flush, delayMs, setParams]
    );

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            flush();
        };
    }, [flush]);

    return enqueue;
};

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

// --- Reusable UI rows for sliders/toggles to keep it DRY ---

const ToggleRow = ({ label, tooltip, checked, onChange }: { label: string; tooltip: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="config-sub-area-control">
        <div className="config-sub-area-control-title">
            <a className="hint-text" data-tooltip-id="hint" data-tooltip-content={tooltip}>{label}:</a>
        </div>
        <div className="config-sub-area-control-field">
            <div className="config-sub-area-noise-container">
                <div className="config-sub-area-noise-checkbox-container">
                    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                </div>
            </div>
        </div>
    </div>
);

const SliderRow = ({ label, tooltip, min, max, step, value, onChange, unit = "" }: { label: string; tooltip: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; unit?: string }) => (
    <div className="config-sub-area-control">
        <div className="config-sub-area-control-title">
            <a className="hint-text" data-tooltip-id="hint" data-tooltip-content={tooltip}>{label}:</a>
        </div>
        <div className="config-sub-area-control-field">
            <div className="config-sub-area-slider-control">
                <span className="config-sub-area-slider-control-slider">
                    <input type="range" className="config-sub-area-slider-control-slider" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
                </span>
                <span className="config-sub-area-slider-control-val">{value}{unit}</span>
            </div>
        </div>
    </div>
);

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export const PreProcessingArea = ({ serverUrl }: { serverUrl: string }) => {
    const [params, setParams] = useState<DspParams>(DEFAULT_DSP_PARAMS);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const targetUrl = serverUrl || "";
        fetchDspParams(targetUrl)
            .then((res) => {
                setParams(res);
                setLoaded(true);
            })
            .catch((e) => console.error("Failed to fetch DSP params", e));
    }, [serverUrl]);

    const enqueue = useDebouncedDspUpdate(serverUrl, params, setParams);

    const area = useMemo(() => {
        if (!loaded) return <></>;

        return (
            <div className="config-sub-area">
                {/* ── Enable & Monitor toggles ── */}
                <ToggleRow
                    label="ENABLE DSP"
                    tooltip="Enable the vocal pre-processing DSP chain (Gate → EQ → Compressor) applied before RVC inference."
                    checked={params.dspEnabled}
                    onChange={(v) => enqueue("dspEnabled", v)}
                />
                <ToggleRow
                    label="EQ MONITOR"
                    tooltip="Listen to the pre-processed voice (after DSP, before RVC). Useful for tuning EQ/Gate without AI latency."
                    checked={params.dspPreprocessMonitor}
                    onChange={(v) => enqueue("dspPreprocessMonitor", v)}
                />

                {/* ── Noise Gate ── */}
                <SliderRow
                    label="GATE THRESHOLD"
                    tooltip="Noise gate threshold. Audio below this level is silenced. Raise to cut background noise."
                    min={-80} max={0} step={1} value={params.dspGateThreshold} unit="dB"
                    onChange={(v) => enqueue("dspGateThreshold", v)}
                />
                <SliderRow
                    label="GATE ATTACK"
                    tooltip="Gate opening attack time. Short = sharp consonant preservation, Long = smooth fade-in."
                    min={1} max={50} step={1} value={params.dspGateAttack} unit="ms"
                    onChange={(v) => enqueue("dspGateAttack", v)}
                />
                <SliderRow
                    label="GATE RELEASE"
                    tooltip="Gate closing release time. Keeps the gate open slightly longer to prevent swallowing the ends of words."
                    min={10} max={500} step={10} value={params.dspGateRelease} unit="ms"
                    onChange={(v) => enqueue("dspGateRelease", v)}
                />

                {/* ── EQ ── */}
                <SliderRow
                    label="LOW CUT FREQ"
                    tooltip="High-pass filter cutoff frequency. Removes low-end rumble and chest resonance."
                    min={20} max={300} step={10} value={params.dspHighpassCutoff} unit="Hz"
                    onChange={(v) => enqueue("dspHighpassCutoff", v)}
                />
                <SliderRow
                    label="HIGH SHELF FREQ"
                    tooltip="High-shelf filter cutoff frequency."
                    min={2000} max={10000} step={100} value={params.dspHighshelfCutoff} unit="Hz"
                    onChange={(v) => enqueue("dspHighshelfCutoff", v)}
                />
                <SliderRow
                    label="HIGH SHELF GAIN"
                    tooltip="High-shelf filter gain. Boosts high frequencies for clarity and air."
                    min={0} max={12} step={0.5} value={params.dspHighshelfGain} unit="dB"
                    onChange={(v) => enqueue("dspHighshelfGain", v)}
                />

                {/* ── Compressor ── */}
                <SliderRow
                    label="COMP THRESHOLD"
                    tooltip="Compressor threshold. Audio above this level gets reduced in volume."
                    min={-40} max={0} step={1} value={params.dspCompressorThreshold} unit="dB"
                    onChange={(v) => enqueue("dspCompressorThreshold", v)}
                />
                <SliderRow
                    label="COMP RATIO"
                    tooltip="Compressor ratio. Higher values = stronger gain reduction."
                    min={1} max={20} step={0.5} value={params.dspCompressorRatio} unit=":1"
                    onChange={(v) => enqueue("dspCompressorRatio", v)}
                />
                <SliderRow
                    label="COMP ATTACK"
                    tooltip="Compressor attack time. Allows fast transients (like plosives) to pass uncompressed before clamping down."
                    min={1.0} max={100.0} step={1.0} value={params.dspCompAttack} unit="ms"
                    onChange={(v) => enqueue("dspCompAttack", v)}
                />
                <SliderRow
                    label="COMP RELEASE"
                    tooltip="Compressor release time. How quickly gain recovers after a loud peak."
                    min={10} max={500} step={10} value={params.dspCompRelease} unit="ms"
                    onChange={(v) => enqueue("dspCompRelease", v)}
                />
                <SliderRow
                    label="MAKEUP GAIN"
                    tooltip="Post-compression makeup gain. Restores volume lost to compression."
                    min={0} max={24} step={0.5} value={params.dspCompressorMakeupGain} unit="dB"
                    onChange={(v) => enqueue("dspCompressorMakeupGain", v)}
                />

                {/* ── Limiter ── */}
                <div className="config-sub-area-control-title">LIMITER</div>
                <ToggleRow
                    label="HARD LIMITER"
                    tooltip="Strictly clamps audio at -0.99 to prevent the AI from hearing digital clipping when screaming. Can sound distorted if hit too hard."
                    checked={params.dspLimiterEnabled}
                    onChange={(v) => enqueue("dspLimiterEnabled", v)}
                />
            </div>
        );
    }, [loaded, params, enqueue]);

    return area;
};
