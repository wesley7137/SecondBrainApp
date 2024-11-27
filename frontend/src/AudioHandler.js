import { Platform } from 'react-native';
import * as Audio from 'expo-av';

class AudioHandler {
  constructor() {
    this.recording = null;
    this.sound = null;
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      } else {
        const permission = await Audio.requestPermissionsAsync();
        return permission.granted;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  async initializeAudio() {
    try {
      const permissionGranted = await this.requestPermissions();
      if (!permissionGranted) {
        throw new Error('Audio permission not granted');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        // Android specific settings
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      });

      return true;
    } catch (error) {
      console.error('Error initializing audio:', error);
      return false;
    }
  }

  async startRecording() {
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      await recording.startAsync();
      this.recording = recording;
      return true;
    } catch (error) {
      console.error('Error starting recording:', error);
      return false;
    }
  }

  async stopRecording() {
    try {
      if (!this.recording) {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      const { sound, status } = await this.recording.createNewLoadedSoundAsync();
      this.sound = sound;
      this.recording = null;

      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }

  async playSound(uri) {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      return true;
    } catch (error) {
      console.error('Error playing sound:', error);
      return false;
    }
  }
}

export default new AudioHandler(); 