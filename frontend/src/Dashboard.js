import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Brain,
  Camera,
  MessageSquare,
  Mic,
  Settings,
  WifiOff,
  Wifi
} from "lucide-react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const ESP_DEVICE_ID = "ESP32_001";
const WEBSOCKET_URL = "ws://192.168.1.238:8010/ws";

const Dashboard = () => {
  // WebSocket and Connection States
  const [wsConnection, setWsConnection] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Audio States
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPermission, setAudioPermission] = useState(false);

  // UI States
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const chatEndRef = useRef(null);

  // New states for enhanced functionality
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);

  // Initialize WebSocket Connection
  const initializeWebSocket = async () => {
    try {
      const ws = new WebSocket(WEBSOCKET_URL);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnectionStatus("connected");
        setIsConnected(true);
        ws.send(
          JSON.stringify({
            type: "pair",
            esp_id: ESP_DEVICE_ID
          })
        );
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "paired") {
            setSessionId(data.session_id);
            setMessages((prev) => [
              ...prev,
              {
                type: "system",
                content: "ESP32 device paired successfully"
              }
            ]);
          } else if (data.type === "audio_processed") {
            setMessages((prev) => [
              ...prev,
              {
                type: "ai",
                content: data.text || "Received audio processing result"
              }
            ]);

            // Handle audio playback
            if (data.audio) {
              try {
                // Decode base64 audio data
                const binaryString = window.atob(data.audio);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                // Create a Blob from the byte array
                const blob = new Blob([bytes], { type: 'audio/m4a' }); // Adjust MIME type if necessary

                // Generate a URL for the audio blob and play it
                const audioUrl = URL.createObjectURL(blob);
                const audio = new Audio(audioUrl);
                audio.play();
              } catch (audioError) {
                console.error("Error playing audio:", audioError);
                setMessages((prev) => [
                  ...prev,
                  {
                    type: "error",
                    content: "Failed to play audio"
                  }
                ]);
              }
            }
          }
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
        setIsConnected(false);
      };

      ws.onclose = () => {
        setConnectionStatus("disconnected");
        setIsConnected(false);
        setSessionId(null);
        // Attempt to reconnect after delay
        setTimeout(initializeWebSocket, 5000);
      };

      setWsConnection(ws);
    } catch (error) {
      console.error("Failed to initialize WebSocket:", error);
      setConnectionStatus("error");
    }
  };

  // Initialize Audio Recording
  const initializeAudio = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      setAudioPermission(permission.granted);

      if (permission.granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true
        });
      }
    } catch (error) {
      console.error("Error initializing audio:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          content: "Failed to initialize audio system"
        }
      ]);
    }
  };

  // Add this new function for handling audio processing
  const processAndSendAudio = async (uri) => {
    try {
      setIsProcessing(true);
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      if (wsConnection && sessionId) {
        wsConnection.send(
          JSON.stringify({
            type: "audio",
            session_id: sessionId,
            audio_data: base64Audio,
            timestamp: Date.now()
          })
        );

        setMessages((prev) => [
          ...prev,
          {
            type: "system",
            content: "Processing audio..."
          }
        ]);
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          content: "Failed to process audio"
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Update the startRecording function
  const startRecording = async () => {
    try {
      if (!audioPermission) {
        await initializeAudio();
      }

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        android: {
          extension: ".m4a",
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: ".m4a",
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false
        }
      });

      // Add recording status updates
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDuration(status.durationMillis);
        }
      });

      setRecording(newRecording);
      await newRecording.startAsync();
      setIsRecording(true);

      // Add recording indicator message
      setMessages((prev) => [
        ...prev,
        {
          type: "system",
          content: "Recording started..."
        }
      ]);
    } catch (error) {
      console.error("Failed to start recording:", error);
      setIsRecording(false);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          content: "Failed to start recording"
        }
      ]);
    }
  };

  // Update the stopRecording function
  const stopRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);

        // Process and send the recorded audio
        await processAndSendAudio(uri);

        setRecording(null);
        setIsRecording(false);
        setRecordingDuration(0);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setMessages((prev) => [
        ...prev,
        {
          type: "error",
          content: "Error stopping recording"
        }
      ]);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (inputMessage.trim() && wsConnection && sessionId) {
      wsConnection.send(
        JSON.stringify({
          type: "message",
          session_id: sessionId,
          content: inputMessage
        })
      );
      setMessages((prev) => [...prev, { type: "user", content: inputMessage }]);
      setInputMessage("");
    }
  };

  // Initialize connections
  useEffect(() => {
    initializeWebSocket();
    initializeAudio();
    return () => {
      stopRecording();
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  // Rest of your UI render code remains the same but with updated status indicators
  return (
    <div className="min-h-screen bg-black text-gray-300">
      {/* ... Header section ... */}
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-2">
            <Brain className="w-6 h-6 text-gray-400" />
            <h1 className="text-xl font-medium text-gray-200">
              Exocortex Dashboard
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span
              className={`flex items-center px-3 py-1 rounded-full text-sm ${
                connectionStatus === "connected"
                  ? "bg-gray-800 text-gray-300"
                  : "bg-gray-900 text-gray-500"
              }`}
            >
              {connectionStatus === "connected" ? (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 mr-2" />
                  Disconnected
                </>
              )}
            </span>
            <Settings className="w-5 h-5 text-gray-500 hover:text-gray-300" />
          </div>
        </header>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <div className="lg:col-span-2 bg-gray-900 rounded-lg shadow-lg">
            <div className="h-[600px] flex flex-col p-4">
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${
                      msg.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.type === "user"
                          ? "bg-gray-800"
                          : msg.type === "error"
                          ? "bg-red-900/20"
                          : msg.type === "system"
                          ? "bg-gray-700/30"
                          : "bg-gray-700"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="What do you want to know?"
                  className="flex-1 bg-gray-800 rounded-lg px-4 py-2 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-700"
                  disabled={!isConnected}
                />
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-lg flex items-center ${
                    isRecording
                      ? "bg-red-600/20 text-red-400"
                      : isProcessing
                      ? "bg-yellow-600/20 text-yellow-400"
                      : "bg-gray-800"
                  }`}
                  disabled={!isConnected || !audioPermission || isProcessing}
                >
                  <Mic className="w-5 h-5" />
                  {isRecording && (
                    <span className="ml-2 text-sm">
                      {Math.floor(recordingDuration / 1000)}s
                    </span>
                  )}
                  {isProcessing && (
                    <span className="ml-2 text-sm">Processing...</span>
                  )}
                </button>
                <button
                  type="submit"
                  className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  disabled={!isConnected}
                >
                  Send
                </button>
              </form>
            </div>
          </div>

          {/* ... Rest of your UI panels ... */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
