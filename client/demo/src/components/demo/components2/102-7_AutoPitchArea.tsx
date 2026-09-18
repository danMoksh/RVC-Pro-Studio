import React, { useMemo } from "react";
import { useAppState } from "../../../001_provider/001_AppStateProvider";

export const AutoPitchArea = () => {
    const { serverSetting } = useAppState();

    const selected = useMemo(() => {
        if (serverSetting.serverSetting.modelSlotIndex === undefined || serverSetting.serverSetting.modelSlotIndex === -1) {
            return null;
        }
        return serverSetting.serverSetting.modelSlots[serverSetting.serverSetting.modelSlotIndex];
    }, [serverSetting.serverSetting.modelSlotIndex, serverSetting.serverSetting.modelSlots]);

    const ui = useMemo(() => {
        if (!selected) {
            return <></>;
        }

        // Global settings
        const settings: any = serverSetting.serverSetting;
        const autoPitchEnabled = settings.autoPitchEnabled === 1;
        const autoPitchStrength = settings.autoPitchStrength ?? 0.5;
        const autoPitchNoiseGate = settings.autoPitchNoiseGate ?? 0.3;

        // Model settings
        const slot: any = selected;
        const autoPitchMinHz = slot.autoPitchMinHz || 80.0;
        const autoPitchMaxHz = slot.autoPitchMaxHz || 400.0;

        const updateGlobal = async (key: string, val: number) => {
            const nextSetting = { ...serverSetting.serverSetting };
            (nextSetting as any)[key] = val;
            await serverSetting.updateServerSettings(nextSetting);
        };

        const updateModel = async (key: string, val: number) => {
            await serverSetting.updateModelInfo(serverSetting.serverSetting.modelSlotIndex, key, val.toString());
        };

        return (
            <div className="character-area-control">
                <div className="character-area-control-title">AUTO PITCH:</div>
                <div className="character-area-control-field">
                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind"></span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="checkbox"
                                checked={autoPitchEnabled}
                                onChange={(e) => {
                                    updateGlobal("autoPitchEnabled", e.target.checked ? 1 : 0);
                                }}
                            />
                        </span>
                        <span className="character-area-slider-control-val">{autoPitchEnabled ? "ON" : "OFF"}</span>
                    </div>

                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind">STRENGTH</span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={autoPitchStrength}
                                onChange={(e) => updateGlobal("autoPitchStrength", Number(e.target.value))}
                            />
                        </span>
                        <span className="character-area-slider-control-val">{Math.round(autoPitchStrength * 100)}%</span>
                    </div>

                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind">NOISE REJECT</span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={autoPitchNoiseGate}
                                onChange={(e) => updateGlobal("autoPitchNoiseGate", Number(e.target.value))}
                            />
                        </span>
                        <span className="character-area-slider-control-val">{Math.round(autoPitchNoiseGate * 100)}%</span>
                    </div>

                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind">MIN HZ</span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="range"
                                min="50"
                                max="500"
                                step="10"
                                value={autoPitchMinHz}
                                onChange={(e) => updateModel("autoPitchMinHz", Number(e.target.value))}
                            />
                        </span>
                        <span className="character-area-slider-control-val">{autoPitchMinHz}Hz</span>
                    </div>

                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind">MAX HZ</span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="range"
                                min="100"
                                max="1000"
                                step="10"
                                value={autoPitchMaxHz}
                                onChange={(e) => updateModel("autoPitchMaxHz", Number(e.target.value))}
                            />
                        </span>
                        <span className="character-area-slider-control-val">{autoPitchMaxHz}Hz</span>
                    </div>
                </div>
            </div>
        );
    }, [serverSetting.serverSetting, serverSetting.updateServerSettings, serverSetting.updateModelInfo, selected]);

    return ui;
};
