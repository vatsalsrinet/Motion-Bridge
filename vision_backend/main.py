from __future__ import annotations

import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .camera_processor import VisionSession
from .models import CalibrationMessage, ErrorPayload, FrameMessage, ResetMessage

app = FastAPI(title="MotionBridge Vision Backend", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "motionbridge-vision"}


@app.websocket("/ws/vision")
async def vision_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    session = VisionSession()
    try:
        await websocket.send_text(session.progress_payload().model_dump_json())
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
                message_type = message.get("type")
                if message_type == "frame":
                    parsed = FrameMessage.model_validate(message)
                    responses = session.process_frame(parsed.image)
                elif message_type == "start_calibration":
                    parsed = CalibrationMessage.model_validate(message)
                    responses = [session.start_calibration(parsed.gesture)]
                elif message_type == "reset":
                    ResetMessage.model_validate(message)
                    responses = [session.reset()]
                else:
                    responses = [ErrorPayload(message="Unknown message type", code="UNKNOWN_MESSAGE")]
                for response in responses:
                    await websocket.send_text(response.model_dump_json())
            except Exception as error:
                await websocket.send_text(ErrorPayload(message=str(error), code="MESSAGE_ERROR").model_dump_json())
    except WebSocketDisconnect:
        pass
    finally:
        session.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("vision_backend.main:app", host="127.0.0.1", port=8000, reload=False)
