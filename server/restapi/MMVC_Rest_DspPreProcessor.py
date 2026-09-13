"""
REST API endpoint for the DSP Pre-Processing chain.

Provides GET (read params) and POST (update params) routes
for the real-time vocal pre-processing DSP chain.
"""

from fastapi import APIRouter, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from voice_changer.VoiceChangerManager import VoiceChangerManager

import logging

logger = logging.getLogger(__name__)


class MMVC_Rest_DspPreProcessor:
    def __init__(self, voiceChangerManager: VoiceChangerManager):
        self.voiceChangerManager = voiceChangerManager
        self.router = APIRouter()
        self.router.add_api_route(
            "/dsp_preprocess", self.get_params, methods=["GET"]
        )
        self.router.add_api_route(
            "/dsp_preprocess", self.update_params, methods=["POST"]
        )

    def get_params(self):
        """Return current DSP pre-processor parameters."""
        try:
            params = self.voiceChangerManager.dsp_preprocessor.get_params_dict()
            return JSONResponse(content=jsonable_encoder(params))
        except Exception as e:
            logger.exception(e)
            return JSONResponse(
                content={"error": str(e)}, status_code=500
            )

    async def update_params(self, req: Request):
        """
        Update DSP pre-processor parameters.

        Expects a JSON body with any subset of:
        - dspEnabled (bool)
        - dspPreprocessMonitor (bool)
        - dspGateThreshold (float, -80 to 0)
        - dspHighpassCutoff (float, 20 to 300)
        - dspHighshelfCutoff (float, 2000 to 10000)
        - dspHighshelfGain (float, 0 to 12)
        - dspFormantShift (float, -12 to 12)
        - dspCompressorThreshold (float, -40 to 0)
        - dspCompressorRatio (float, 1 to 20)
        - dspCompressorMakeupGain (float, 0 to 24)
        """
        try:
            body = await req.json()
            result = self.voiceChangerManager.dsp_preprocessor.update_params(body)
            return JSONResponse(content=jsonable_encoder(result))
        except Exception as e:
            logger.exception(e)
            return JSONResponse(
                content={"error": str(e)}, status_code=500
            )
