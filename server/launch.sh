#!/bin/bash
cd "$(dirname "$0")"

echo "Setting up Telegram Virtual Audio Channels..."
# 1. Create the Virtual Speaker (where the Voice Changer sends its audio)
pactl load-module module-null-sink media.class=Audio/Sink sink_name=TelegramStream sink_properties=device.description="Telegram_Streamer"

# 2. Create the Virtual Mic (what you select as your microphone inside Telegram)
pactl load-module module-remap-source master=TelegramStream.monitor source_name=TelegramMic source_properties=device.description="Telegram_Virtual_Mic"

echo "Launching Voice Changer..."
source venv/bin/activate
python main.py "$@"
