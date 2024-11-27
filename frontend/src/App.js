import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import AudioRecorder from './AudioRecorder';
import manager, { 
  requestPermissions, 
  isBluetoothEnabled, 
  startBluetoothStateMonitoring 
} from './bleManager';
import * as FileSystem from "expo-file-system";

const ESP_DEVICE_ID = "ESP32_001";
const WEBSOCKET_URL = "ws://192.168.1.238:8010/ws";

const Dashboard = () => {
  // WebSocket States
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [wsConnection, setWsConnection] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState(null);

  // BLE States
  const [bleEnabled, setBleEnabled] = useState(false);
  const [blePermissionsGranted, setBlePermissionsGranted] = useState(false);

  // WebSocket Connection Handler
  const handleConnect = async () => {
    if (!isConnected) {
      try {
        const ws = new WebSocket(WEBSOCKET_URL);
        
        ws.onopen = () => {
          console.log("WebSocket Connected");
          setIsConnected(true);
          setIsStreaming(true);
          setWsConnection(ws);
          
          // Send pairing message
          ws.send(JSON.stringify({
            type: "pair",
            esp_id: ESP_DEVICE_ID
          }));
        };

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "paired") {
              setSessionId(data.session_id);
              console.log("ESP32 device paired successfully");
            } else if (data.type === "audio_processed") {
              console.log("Received audio processing result:", data.text);
            }
          } catch (error) {
            console.log("Received raw:", event.data);
          }
        };

        ws.onclose = (event) => {
          console.log("WebSocket Disconnected", event.code, event.reason);
          setIsConnected(false);
          setIsStreaming(false);
          setWsConnection(null);
        };

        ws.onerror = (error) => {
          console.error("WebSocket Error:", error);
          // Don't disconnect on error, let onclose handle it
          console.log("Attempting to reconnect...");
        };

      } catch (error) {
        console.error("Connection failed:", error);
        setIsConnected(false);
        setIsStreaming(false);
      }
    } else {
      if (wsConnection) {
        // Send disconnect message before closing
        try {
          wsConnection.send(JSON.stringify({
            type: "disconnect",
            message: "Client disconnecting"
          }));
          wsConnection.close(1000, "User initiated disconnect");
        } catch (error) {
          console.error("Error during disconnect:", error);
        }
      }
      setIsConnected(false);
      setIsStreaming(false);
      setWsConnection(null);
    }
  };

  // Update audio processing function
  const processAndSendAudio = async (uri) => {
    try {
      setIsProcessing(true);
      console.log("Starting to process audio from:", uri);
      
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      console.log("Audio converted to base64");

      if (!wsConnection) {
        throw new Error("WebSocket not connected");
      }

      // Changed message format to match backend expectations
      const message = JSON.stringify({
        type: "audio",
        audio: base64Audio,  // Keep this as 'audio' to match backend
        format: "3gp",       // Add audio format
        sample_rate: 44100,  // Add sample rate
        channels: 1          // Add channels
      });

      console.log("Sending audio message");
      wsConnection.send(message);
      console.log("Audio message sent");

    } catch (error) {
      console.error("Error in processAndSendAudio:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Initialize BLE
  const initializeBLE = async () => {
    try {
      const permissionsGranted = await requestPermissions();
      setBlePermissionsGranted(permissionsGranted);

      const enabled = await isBluetoothEnabled();
      setBleEnabled(enabled);

      // Start monitoring BLE state changes
      startBluetoothStateMonitoring((enabled) => {
        setBleEnabled(enabled);
      });
    } catch (error) {
      console.error("Error initializing BLE:", error);
    }
  };

  // Add reconnection logic
  useEffect(() => {
    let reconnectTimeout;

    const tryReconnect = () => {
      if (!isConnected) {
        console.log("Attempting to reconnect...");
        handleConnect();
      }
    };

    if (!isConnected) {
      reconnectTimeout = setTimeout(tryReconnect, 5000);
    }

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsConnection) {
        wsConnection.close(1000, "Component unmounting");
      }
    };
  }, [isConnected]);

  useEffect(() => {
    initializeBLE();
    return () => {
      if (wsConnection) {
        wsConnection.close();
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Second Brain</Text>
        <TouchableOpacity
          style={[
            styles.connectButton,
            { backgroundColor: isConnected ? "#ff4444" : "#4CAF50" }
          ]}
          onPress={handleConnect}
        >
          <Text style={styles.connectButtonText}>
            {isConnected ? "Disconnect" : "Connect to Server"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <MaterialIcons
              name={isConnected ? "check-circle" : "error"}
              size={24}
              color={isConnected ? "#4CAF50" : "#ff4444"}
            />
            <Text style={styles.statusText}>
              Server: {isConnected ? "Connected" : "Disconnected"}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <MaterialIcons
              name={isStreaming ? "wifi" : "wifi-off"}
              size={24}
              color={isStreaming ? "#4CAF50" : "#ff4444"}
            />
            <Text style={styles.statusText}>
              Streaming: {isStreaming ? "Active" : "Inactive"}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <MaterialIcons
              name={bleEnabled ? "bluetooth" : "bluetooth-disabled"}
              size={24}
              color={bleEnabled ? "#4CAF50" : "#ff4444"}
            />
            <Text style={styles.statusText}>
              Bluetooth: {bleEnabled ? "Enabled" : "Disabled"}
            </Text>
          </View>

          {/* Audio Recorder Component - Changed to use processAndSendAudio */}
          <AudioRecorder onRecordingComplete={processAndSendAudio} />
        </View>
      </ScrollView>
    </View>
  );
};

// Existing styles remain the same
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5"
  },
  header: {
    padding: 20,
    backgroundColor: "#2196F3",
    alignItems: "center"
  },
  title: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
    marginBottom: 10
  },
  connectButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50"
  },
  connectButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold"
  },
  content: {
    flex: 1,
    padding: 20
  },
  statusContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10
  },
  statusText: {
    marginLeft: 10,
    fontSize: 16
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 5,
    marginTop: 10
  },
  recordButtonText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 16,
    fontWeight: 'bold'
  }
});

export default Dashboard;

