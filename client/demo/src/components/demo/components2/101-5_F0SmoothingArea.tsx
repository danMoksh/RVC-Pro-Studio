import React, { useMemo } from "react";
import { useAppState } from "../../../001_provider/001_AppStateProvider";

export type F0SmoothingAreaProps = {};

export const F0SmoothingArea = (_props: F0SmoothingAreaProps) => {
    const { serverSetting } = useAppState();

    const selected = useMemo(() => {
        if (serverSetting.serverSetting.modelSlotIndex == undefined) {
            return;
        } else {
            return serverSetting.serverSetting.modelSlots[serverSetting.serverSetting.modelSlotIndex];
        }
    }, [serverSetting.serverSetting.modelSlotIndex, serverSetting.serverSetting.modelSlots]);

    const f0SmoothingArea = useMemo(() => {
        if (!selected) {
            return <></>;
        }

        const currentF0Smoothing = serverSetting.serverSetting.f0Smoothing;
        const f0SmoothingValueUpdatedAction = async (val: number) => {
            await serverSetting.updateServerSettings({ ...serverSetting.serverSetting, f0Smoothing: val });
        };

        return (
            <div className="character-area-control">
                <div className="character-area-control-title"><a className="hint-text" data-tooltip-id="hint" data-tooltip-content="F0 Smoothing (Median Filter) prevents sudden squeaks or voice cracks by filtering out pitch spikes. Use 0-15.">F0 SMOOTHING</a>:</div>
                <div className="character-area-control-field">
                    <div className="character-area-slider-control">
                        <span className="character-area-slider-control-kind"></span>
                        <span className="character-area-slider-control-slider">
                            <input
                                type="range"
                                min="0"
                                max="15"
                                step="1"
                                value={typeof currentF0Smoothing === 'number' && !isNaN(currentF0Smoothing) ? currentF0Smoothing : 0}
                                onChange={(e) => {
                                    f0SmoothingValueUpdatedAction(Number(e.target.value));
                                }}
                            ></input>
                        </span>
                        <span className="character-area-slider-control-val">{currentF0Smoothing}</span>
                    </div>
                </div>
            </div>
        );
    }, [serverSetting.serverSetting, serverSetting.updateServerSettings, selected]);

    return f0SmoothingArea;
};
