import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from vosk import Model, KaldiRecognizer

from backend.asr.config import ASR_DIR, ASR_DEFAULT_MODEL

log = logging.getLogger("uvicorn.error")

# load vosk model objects are read-only, one per language
# shared across all connections
# only Kaldi Recognizer needs to be recreated each WebSocket
models : dict[str, Model] = {}

# the browser must resample and convert to int16 for kaldi
SAMPLE_RATE = 16000 # kaldi expects 16kHz mono 16-bit PCM

@asynccontextmanager
async def lifespan(app:FastAPI):
	log.info(f"Loading default ASR model: {ASR_DEFAULT_MODEL}")
	models[ASR_DEFAULT_MODEL] = Model(f"{ASR_DIR}/{ASR_DEFAULT_MODEL}")
	yield
	models.clear()

app = FastAPI(title="TreeNotes ASR", lifespan=lifespan)

def get_model(language: str) -> Model:
	if language not in models:
		# lazy load non-default model
		models[language] = Model(f"{ASR_DIR}/{language}")
	return models[language]

@app.get("/health", tags=["meta"])
def health() -> dict:
	return {"status": "ok", "loaded models": list(models.keys())}

@app.websocket("/ws")
async def transcribe(websocket: WebSocket):
	await websocket.accept()

	# first message from the client picks the language before any audio
	init = await websocket.receive_json()
	language = init.get("language", ASR_DEFAULT_MODEL)
	model = get_model(language)
	recognizer = KaldiRecognizer(model, SAMPLE_RATE)

	try:
		while True:
			data = await websocket.receive_bytes()
			# accepts waveform is a blocking C call
			# loop so one slow decode doesn't stall other connections
			result = await asyncio.to_thread(recognizer.AcceptWaveform, data)
			if result:
				await websocket.send_json(json.loads(recognizer.Result()))
			else:
				await websocket.send_json(json.loads(recognizer.PartialResult()))
	except WebSocketDisconnect:
		pass

# routing: const res = await fetch('/asr/test');
# @app.get("/test")
# def test() -> str:
# 	return "Hello from ASR.test()!"
