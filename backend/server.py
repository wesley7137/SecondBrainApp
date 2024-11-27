import os
import platform
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'
import json
import base64
import io
import re
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from stt import stt_async
import torch
from TTS.api import TTS

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import io
from pydub import AudioSegment
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from typing import Dict
import uuid



# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = "cuda:0" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)



class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected: {websocket.client}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected: {websocket.client}")
    
    async def broadcast_audio(self, data: bytes):
        for connection in self.active_connections:
            await connection.send_bytes(data)

class DeviceManager:
    def __init__(self):
        self.paired_devices: Dict[str, dict] = {}  # esp_id -> {iphone_ws, session_id}
        self.sessions: Dict[str, dict] = {}        # session_id -> {esp_id, recordings}

    def pair_devices(self, esp_id: str, iphone_ws: WebSocket) -> str:
        session_id = str(uuid.uuid4())
        self.paired_devices[esp_id] = {
            "iphone_ws": iphone_ws,
            "session_id": session_id
        }
        self.sessions[session_id] = {
            "esp_id": esp_id,
            "recordings": []
        }
        return session_id

    def get_session(self, esp_id: str) -> str:
        return self.paired_devices.get(esp_id, {}).get("session_id")

    def add_recording(self, session_id: str, recording_id: str):
        if session_id in self.sessions:
            self.sessions[session_id]["recordings"].append(recording_id)

manager = ConnectionManager()
device_manager = DeviceManager()
class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_message(self, websocket: WebSocket, message: dict):
        await websocket.send_json(message)

manager = ConnectionManager()

# WebSocket Handlers
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            data = json.loads(data)
            logger.info(f"Received WebSocket message: {data}")
            if data['type'] == 'text':
                await handle_text_message(data['text'], websocket)
                logger.info("Handled text message")
            elif data['type'] == 'audio':
                await handle_audio_message(data['audio'], websocket)
                logger.info("Handled audio message")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

async def handle_text_message(text, websocket):
    logger.info(f"Received text message: {text}")
    await generate_response(text, websocket)

async def handle_audio_message(audio_data, websocket):
    audio_data = base64.b64decode(audio_data)
    logger.info("Received audio message")
    text = await stt_async(audio_data)
    logger.info(f"Converted audio to text: {text}")
    await generate_response(text, websocket)



async def generate_response(message, websocket):
    import ollama
    
    try:
        # For now, let's remove the image processing since it's not properly implemented
        response = ollama.chat(
            model='llama3.2-vision:11b-instruct-q8_0 ',
            messages=[{
                'role': 'user',
                'content': 'You are ExoCortex - the human users AI Companion and second brain. You and the user are a fusion of consciousness and intelligence, working in synergy and perfect unison. You receive audio, image, and textual output from the user and you process this image and return whatever information it is that the user requests. Respond to the users message: ' + message
            }]
        )
        response = response['message']['content']
        print(response)
        await process_and_send_chunk(response, websocket)
    except Exception as e:
        logger.error(f"Error in generate_response: {e}")
        # Send an error message to the client
        await manager.send_message(websocket, {
            'type': 'error',
            'message': 'Sorry, I encountered an error processing your request.'
        })

# Text-to-Speech (TTS) Processing
async def process_and_send_chunk(response, websocket):

    # Process TTS
    tts_chunks = re.findall(r'[^.!?]+[.!?]', response)
    processed_audio = set()  # To keep track of processed audio chunks
    for chunk in tts_chunks:
        chunk = chunk.strip()
        if chunk and chunk not in processed_audio:
            logger.info(f"Processing TTS for chunk: {chunk}")
            base64_audio = await text_to_speech(chunk)
            # Send audio chunk to frontend if the WebSocket is still open
            await manager.send_message(websocket, {
                'type': 'audio',
                'audio': base64_audio,
                'text': chunk
            })
        processed_audio.add(chunk)
        logger.info("Sent audio message to WebSocket")

            
async def text_to_speech(text):
    logger.info("Converting text to speech")
    modified_text = text.rstrip('A')
    bytes_buffer = io.BytesIO()

    tts.tts_to_file(
        text=modified_text,
        speaker_wav="voices/colin.wav",
        file_path=bytes_buffer,
        speed=1.7,
        temperature=0.9,
        top_k=50,
        top_p=0.5,
        language="en"
    )
    logger.info("Text-to-speech conversion completed")
    audio_data = bytes_buffer.getvalue()
    bytes_buffer.close()
    logger.info("Converted audio to bytes")
    base64_audio = base64.b64encode(audio_data).decode('utf-8')
    logger.info("Sent audio to base64")
    return base64_audio
   
   



@app.post("/esp32/trigger")
async def esp32_trigger(request: Request):
    esp_id = request.headers.get("ESP-Device-ID")
    if not esp_id:
        return JSONResponse({"status": "error", "message": "No device ID provided"})
    
    session_id = device_manager.get_session(esp_id)
    if not session_id:
        return JSONResponse({"status": "error", "message": "Device not paired"})

    recording_id = str(uuid.uuid4())
    for connection in manager.active_connections:
        await connection.send_json({
            "action": "start_recording",
            "session_id": session_id,
            "recording_id": recording_id
        })
    
    return JSONResponse({"status": "success", "recording_id": recording_id})



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010, reload=True)
