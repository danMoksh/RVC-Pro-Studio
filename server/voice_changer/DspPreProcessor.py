"""
Real-Time Vocal Pre-Processing DSP Chain (Fallback Implementation).

Uses scipy.signal and numpy instead of Pedalboard to prevent 'Illegal instruction'
(SIGILL) core dumps on CPUs that do not support modern AVX instructions.
"""

import numpy as np
import scipy.signal as signal
import threading
import logging
import json
import os
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

DSP_SETTING_FILE = "stored_dsp_setting.json"

@dataclass
class DspPreProcessorParams:
    """Parameters for the DSP pre-processing chain."""
    enabled: bool = False
    preprocess_monitor: bool = False
    gate_threshold_db: float = -50.0  # -80 to 0
    gate_attack_ms: float = 2.0       # 1 to 50
    gate_release_ms: float = 150.0    # 10 to 500
    highpass_cutoff_hz: float = 80.0  # 20 to 300
    highshelf_cutoff_hz: float = 4000.0  # 2000 to 10000
    highshelf_gain_db: float = 0.0  # 0 to +12
    compressor_threshold_db: float = -20.0  # -40 to 0
    compressor_ratio: float = 4.0  # 1 to 20
    comp_attack_ms: float = 5.0    # 1 to 100
    comp_release_ms: float = 50.0  # 10 to 500
    compressor_makeup_gain_db: float = 0.0  # 0 to +24


class DspPreProcessor:
    """
    Applies a chain of audio effects to the input signal using scipy/numpy.
    Thread-safe parameter updates.
    """

    def __init__(self):
        self._params = DspPreProcessorParams()
        self._lock = threading.Lock()
        
        # Cache filter coefficients so we don't recalculate every chunk
        self._cache_sr = 0
        self._cache_hp_b = None
        self._cache_hp_a = None
        self._cache_hs_b = None
        self._cache_hs_a = None
        self._dirty = True
        
        # Envelope states for Attack/Release
        self._gate_gain = 1.0
        self._comp_gain = 1.0

        self.load_settings()

    def load_settings(self):
        if os.path.exists(DSP_SETTING_FILE):
            try:
                with open(DSP_SETTING_FILE, "r") as f:
                    data = json.load(f)
                    for k, v in data.items():
                        if hasattr(self._params, k):
                            setattr(self._params, k, v)
                self._dirty = True
            except Exception as e:
                logger.error(f"Failed to load DSP settings: {e}")

    def save_settings(self):
        try:
            with open(DSP_SETTING_FILE, "w") as f:
                json.dump(self._params.__dict__, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save DSP settings: {e}")

    @property
    def params(self) -> DspPreProcessorParams:
        return self._params

    def get_params_dict(self) -> dict:
        with self._lock:
            return {
                "dspEnabled": self._params.enabled,
                "dspPreprocessMonitor": self._params.preprocess_monitor,
                "dspGateThreshold": self._params.gate_threshold_db,
                "dspGateAttack": self._params.gate_attack_ms,
                "dspGateRelease": self._params.gate_release_ms,
                "dspHighpassCutoff": self._params.highpass_cutoff_hz,
                "dspHighshelfCutoff": self._params.highshelf_cutoff_hz,
                "dspHighshelfGain": self._params.highshelf_gain_db,
                "dspCompressorThreshold": self._params.compressor_threshold_db,
                "dspCompressorRatio": self._params.compressor_ratio,
                "dspCompAttack": self._params.comp_attack_ms,
                "dspCompRelease": self._params.comp_release_ms,
                "dspCompressorMakeupGain": self._params.compressor_makeup_gain_db,
            }

    def update_params(self, updates: dict) -> dict:
        key_map = {
            "dspEnabled": ("enabled", bool),
            "dspPreprocessMonitor": ("preprocess_monitor", bool),
            "dspGateThreshold": ("gate_threshold_db", float),
            "dspGateAttack": ("gate_attack_ms", float),
            "dspGateRelease": ("gate_release_ms", float),
            "dspHighpassCutoff": ("highpass_cutoff_hz", float),
            "dspHighshelfCutoff": ("highshelf_cutoff_hz", float),
            "dspHighshelfGain": ("highshelf_gain_db", float),
            "dspCompressorThreshold": ("compressor_threshold_db", float),
            "dspCompressorRatio": ("compressor_ratio", float),
            "dspCompAttack": ("comp_attack_ms", float),
            "dspCompRelease": ("comp_release_ms", float),
            "dspCompressorMakeupGain": ("compressor_makeup_gain_db", float),
        }

        with self._lock:
            for api_key, (attr, typ) in key_map.items():
                if api_key in updates:
                    raw = updates[api_key]
                    val = raw if isinstance(raw, bool) else str(raw).lower() in ("true", "1") if typ is bool else typ(raw)
                    if getattr(self._params, attr) != val:
                        setattr(self._params, attr, val)
                        self._dirty = True
            
            if self._dirty:
                self.save_settings()

        return self.get_params_dict()

    def process(self, audio: np.ndarray, sample_rate: int) -> np.ndarray:
        if not self._params.enabled or len(audio) == 0:
            return audio

        # Work on a copy
        x = audio.copy().astype(np.float32)

        with self._lock:
            p = DspPreProcessorParams(**self._params.__dict__)
            
            if self._dirty or self._cache_sr != sample_rate:
                nyq = 0.5 * sample_rate
                # Highpass
                self._cache_hp_b, self._cache_hp_a = signal.butter(2, p.highpass_cutoff_hz / nyq, btype='high')
                # Highshelf (using highpass for boost)
                self._cache_hs_b, self._cache_hs_a = signal.butter(1, p.highshelf_cutoff_hz / nyq, btype='high')
                
                self._cache_sr = sample_rate
                self._dirty = False
                
            hp_b, hp_a = self._cache_hp_b, self._cache_hp_a
            hs_b, hs_a = self._cache_hs_b, self._cache_hs_a

        chunk_duration_sec = len(x) / sample_rate

        # 1. Noise Gate with Attack/Release Envelope
        rms = np.sqrt(np.mean(x**2))
        db = 20 * np.log10(rms + 1e-7)
        target_gate_gain = 1.0 if db >= p.gate_threshold_db else 0.0
        
        if target_gate_gain < self._gate_gain:
            # Releasing (Gate closing, gain going down)
            alpha = np.exp(-chunk_duration_sec / (p.gate_release_ms / 1000.0))
        else:
            # Attacking (Gate opening, gain going up)
            alpha = np.exp(-chunk_duration_sec / (p.gate_attack_ms / 1000.0))
            
        new_gate_gain = alpha * self._gate_gain + (1 - alpha) * target_gate_gain
        # Interpolate gain across the chunk to prevent zipper noise/clicks
        gate_gains = np.linspace(self._gate_gain, new_gate_gain, len(x), dtype=np.float32)
        x = x * gate_gains
        self._gate_gain = new_gate_gain

        # 2. High-Pass Filter (Low Cut)
        x = signal.lfilter(hp_b, hp_a, x)

        # 3. High-Shelf Filter (High Boost)
        if p.highshelf_gain_db > 0.0:
            boost = signal.lfilter(hs_b, hs_a, x)
            gain_lin = (10 ** (p.highshelf_gain_db / 20.0)) - 1.0
            x = x + (boost * gain_lin)

        # 4. Compressor with Attack/Release Envelope
        comp_rms = np.sqrt(np.mean(x**2))
        comp_db = 20 * np.log10(comp_rms + 1e-7)
        
        if comp_db > p.compressor_threshold_db:
            excess = comp_db - p.compressor_threshold_db
            reduction = excess - (excess / p.compressor_ratio)
            target_comp_gain = 10 ** (-reduction / 20.0)
        else:
            target_comp_gain = 1.0
            
        if target_comp_gain < self._comp_gain:
            # Attacking (Gain going down)
            alpha = np.exp(-chunk_duration_sec / (p.comp_attack_ms / 1000.0))
        else:
            # Releasing (Gain going up)
            alpha = np.exp(-chunk_duration_sec / (p.comp_release_ms / 1000.0))
            
        new_comp_gain = alpha * self._comp_gain + (1 - alpha) * target_comp_gain
        comp_gains = np.linspace(self._comp_gain, new_comp_gain, len(x), dtype=np.float32)
        x = x * comp_gains
        self._comp_gain = new_comp_gain
            
        # 5. Makeup Gain
        if p.compressor_makeup_gain_db > 0.0:
            x = x * (10 ** (p.compressor_makeup_gain_db / 20.0))

        # 6. Formant Shift
        # Note: Real-time high-quality pitch shift in pure python is too slow for 128-sample chunks.
        if p.formant_shift_semitones != 0.0:
            pass 

        # Prevent clipping
        x = np.clip(x, -1.0, 1.0)
        return x.astype(np.float32)
