FROM alphacep/kaldi-vosk-server:latest

# Lightweight English model for the prototype. Override these build args later
# if TreeNotes needs a different language/model image.
ARG VOSK_MODEL_NAME=vosk-model-small-en-us-0.15
ARG VOSK_MODEL_BASE_URL=https://alphacephei.com/vosk/models

ENV VOSK_MODEL_PATH=/opt/vosk-model/model
ENV VOSK_SAMPLE_RATE=16000
ENV VOSK_SERVER_INTERFACE=0.0.0.0
ENV VOSK_SERVER_PORT=2700

WORKDIR /opt/vosk-model

RUN wget -q "${VOSK_MODEL_BASE_URL}/${VOSK_MODEL_NAME}.zip" \
    && unzip -q "${VOSK_MODEL_NAME}.zip" \
    && mv "${VOSK_MODEL_NAME}" model \
    && rm "${VOSK_MODEL_NAME}.zip" \
    && test -d /opt/vosk-model/model/am

# Tiny in-container connectivity test. It does not test speech accuracy; it
# verifies that the WebSocket server accepts Vosk config/audio/EOF messages.
COPY smoke_test.py /opt/treenotes/smoke_test.py

EXPOSE 2700

WORKDIR /opt/vosk-server/websocket

CMD ["python3", "./asr_server.py", "/opt/vosk-model/model"]
