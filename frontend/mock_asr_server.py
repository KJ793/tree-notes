"""TreeNotes Stage 4.2 transport-only ASR mock.

This is NOT speech recognition. It only proves that the browser can:
  1. connect over WebSocket,
  2. send Vosk-style JSON config,
  3. stream binary PCM16 audio frames,
  4. receive partial/final JSON transcript messages,
  5. send {"eof": 1} and close cleanly.

Run:
    pip install websockets
    python mock_asr_server.py

TreeNotes defaults to ws://localhost:2700, so no .env change is needed.
"""

import asyncio
import json
import websockets

HOST = "0.0.0.0"
PORT = 2700


async def handle_connection(websocket):
    sample_rate = 16000.0
    bytes_received = 0
    partial_stage = 0

    print("TreeNotes ASR mock: client connected")

    async for message in websocket:
        if isinstance(message, str):
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                await websocket.send(json.dumps({"error": "Invalid JSON control message"}))
                continue

            if "config" in payload:
                config = payload.get("config") or {}
                sample_rate = float(config.get("sample_rate", sample_rate))
                print(f"Config received: sample_rate={sample_rate:g} Hz")
                continue

            if payload.get("eof") == 1:
                await websocket.send(
                    json.dumps(
                        {
                            "text": "TreeNotes ASR WebSocket transport test completed successfully"
                        }
                    )
                )
                print(f"Session complete: {bytes_received} PCM bytes received")
                await websocket.close(code=1000, reason="Mock transcription complete")
                return

            continue

        bytes_received += len(message)

        # PCM16 mono = two bytes per sample. These milestones only create
        # fake interim text so the TreeNotes UI can be tested end-to-end.
        seconds = bytes_received / max(1.0, sample_rate * 2.0)

        if seconds >= 1.0 and partial_stage < 1:
            partial_stage = 1
            await websocket.send(json.dumps({"partial": "treenotes websocket"}))
        elif seconds >= 2.0 and partial_stage < 2:
            partial_stage = 2
            await websocket.send(json.dumps({"partial": "treenotes websocket audio streaming"}))
        elif seconds >= 3.0 and partial_stage < 3:
            partial_stage = 3
            await websocket.send(
                json.dumps({"text": "TreeNotes WebSocket audio streaming is working"})
            )


async def main():
    print(f"TreeNotes ASR mock listening on ws://localhost:{PORT}")
    async with websockets.serve(handle_connection, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
