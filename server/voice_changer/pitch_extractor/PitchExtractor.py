from typing import Protocol
import torch


class PitchExtractor(Protocol):
    type: str

    def extract(
        self,
        audio: torch.Tensor,
        sr: int,
        window: int,
    ) -> torch.Tensor:
        ...

    def extract_with_confidence(
        self,
        audio: torch.Tensor,
        sr: int,
        window: int,
    ) -> tuple[torch.Tensor, torch.Tensor | None]:
        return self.extract(audio, sr, window), None

    def getPitchExtractorInfo(self):
        return {
            "pitchExtractorType": self.type,
        }
