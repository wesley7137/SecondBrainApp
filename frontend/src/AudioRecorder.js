// AudioRecorder.js
import React, { useState } from "react";
import { View, Button, Text } from "react-native";
import { Audio } from "expo-av";

export default function AudioRecorder({ onRecordingComplete }) {
  const [recording, setRecording] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState("");

  const startRecording = async () => {
    try {
      console.log("Requesting permissions..");
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      console.log("Starting recording..");
      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      setRecordingStatus("Recording...");
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    try {
      console.log("Stopping recording..");
      setRecordingStatus("Stopping...");
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingStatus("Recording stopped");
      console.log("Recording stopped and stored at", uri);
      
      // Call the processAndSendAudio function passed from parent
      if (onRecordingComplete) {
        console.log("Sending recording to server...");
        await onRecordingComplete(uri);
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setRecordingStatus("Error stopping recording");
    }
  };

  return (
    <View style={{ marginTop: 20 }}>
      <Button
        title={recording ? "Stop Recording" : "Start Recording"}
        onPress={recording ? stopRecording : startRecording}
      />
      <Text>{recordingStatus}</Text>
    </View>
  );
}
