Project Overview
You aim to create a system where:

ESP32-S3 Device:

Primary Role: Detect wake words (e.g., "Hey Finn") using a lightweight model.
Secondary Role: Capture and transmit video/image data.
Communication: Signal the user's device (iPhone) upon wake word detection using Bluetooth Low Energy (BLE) and transmit data via Wi-Fi.
User's Device (iPhone):

Primary Role: Act as a mediator between the ESP32-S3 and the backend server.
Functions:
Receive signals from the ESP32-S3 via BLE.
Initiate audio recording upon receiving a wake word signal.
Transmit audio data to the backend server via Wi-Fi.
Receive and play Text-to-Speech (TTS) audio from the backend via AirPods.
Backend Server:

Primary Role: Process incoming data (audio and video/images) and generate TTS audio responses.
Functions:
Handle complex tasks such as image processing or command interpretation.
Generate and stream TTS audio back to the iPhone.
System Architecture
scss
Copy code
ESP32-S3 Device
|
| BLE (Signal)
| Wi-Fi (Data)
|
User's Device (iPhone)
|
| Wi-Fi (Data)
|
Backend Server
Detailed Implementation Steps

1. ESP32-S3 Device: Wake Word Detection and Data Transmission
   1.1. Hardware Setup
   Components Needed:
   ESP32-S3 Development Board
   I2S Microphone: For audio input (if not integrated).
   Camera Module: For capturing images or video.
   Power Supply: Ensure stable power, especially if using peripherals like microphones and cameras.
   Wiring Overview:
   I2S Microphone:
   Connect to appropriate GPIO pins for I2S communication.
   Camera Module:
   Connect to designated GPIO pins as per your camera's specifications.
   1.2. Software Modules
   To maintain a modular codebase, we'll separate functionalities into different modules/files.

Wi-Fi Connectivity Module
BLE Communication Module
Wake Word Detection Module
Camera Interface Module
Data Transmission Module
1.3. Wi-Fi Connectivity Module
Purpose: Establish and maintain a Wi-Fi connection for data transmission.
