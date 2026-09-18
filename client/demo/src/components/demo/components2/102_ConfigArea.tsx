import React, { useMemo } from "react"
import { QualityArea } from "./102-1_QualityArea"
import { ConvertArea } from "./102-2_ConvertArea"
import { DeviceArea } from "./102-3_DeviceArea"
import { RecorderArea } from "./102-4_RecorderArea"
import { MoreActionArea } from "./102-5_MoreActionArea"
import { PreProcessingArea } from "./102-6_PreProcessingArea"
import { AutoPitchArea } from "./102-7_AutoPitchArea"
import { useAppState } from "../../../001_provider/001_AppStateProvider"

export type ConfigAreaProps = {
    detectors: string[]
    inputChunkNums: number[]
}


export const ConfigArea = (props: ConfigAreaProps) => {
    const { setting } = useAppState()
    const serverUrl = setting.workletNodeSetting.serverUrl || ""

    const configArea = useMemo(() => {
        return (
            <>
                <div className="config-area">
                    <QualityArea detectors={props.detectors}></QualityArea>
                    <ConvertArea inputChunkNums={props.inputChunkNums}></ConvertArea>
                </div>
                <div className="config-area">
                    <AutoPitchArea></AutoPitchArea>
                    <PreProcessingArea serverUrl={serverUrl}></PreProcessingArea>
                </div>
                <div className="config-area">
                    <DeviceArea></DeviceArea>
                    <RecorderArea></RecorderArea>
                </div>
                <div className="config-area">
                    <MoreActionArea></MoreActionArea>
                </div>
            </>

        )
    }, [serverUrl])

    return configArea
}