#!/usr/bin/env python3
"""TreeNotes Vosk WebSocket transport smoke test.

Run inside the running container:
    docker exec treenotes-vosk-asr python3 /opt/treenotes/smoke_test.py

The test sends 1 second of 16 kHz mono PCM16 silence, then EOF. A valid JSON
response proves the Vosk WebSocket server is alive and speaking the protocol
used by the TreeNotes frontend.
"""

import asyncio
import json
from array import array

import websockets

URL = "ws://127.0.0.1:2700"
SAMPLE_RATE = 16000


async def main():
    print(f"Connecting to {URL} ...")

    async with websockets.connect(URL, max_size=None) as socket:
        await socket.send(
            json.dumps(
                {
                    "config": {
                        "sample_rate": SAMPLE_RATE,
                    }
                }
            )
        )

        # 100 ms chunks, matching the kind of incremental stream a browser
        # sends. Ten chunks = one second of silence.
        samples_per_chunk = SAMPLE_RATE // 10
        silence_chunk = array("h", [0] * samples_per_chunk).tobytes()

        for _ in range(10):
            await socket.send(silence_chunk)
            response = await asyncio.wait_for(socket.recv(), timeout=5)
            json.loads(response)

        await socket.send('{"eof" : 1}')
        final_response = await asyncio.wait_for(socket.recv(), timeout=5)
        parsed = json.loads(final_response)

        print("Vosk WebSocket responded successfully:")
        print(json.dumps(parsed, indent=2))
        print("Smoke test passed.")


if __name__ == "__main__":
    asyncio.run(main())
