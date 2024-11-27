import { BleManager } from "react-native-ble-plx";
import { Platform } from "react-native";
import * as ExpoDevice from "expo-device";

let manager = null;

try {
  // Only create BLE manager if we're on a real device
  if (!ExpoDevice.isDevice) {
    console.log('Running on simulator/web - BLE not supported');
  } else {
    manager = new BleManager();
  }
} catch (error) {
  console.log('Error initializing BLE manager:', error);
}

export const requestPermissions = async () => {
  if (!manager) return false;
  
  try {
    if (Platform.OS === 'ios') {
      return true; // iOS handles permissions through info.plist
    } else if (Platform.OS === 'android') {
      if (ExpoDevice.platformApiLevel >= 31) {
        // For Android 12 and higher
        const permissions = [
          'android.permission.BLUETOOTH_SCAN',
          'android.permission.BLUETOOTH_CONNECT'
        ];
        
        const results = await Promise.all(
          permissions.map(permission =>
            ExpoDevice.getPermissionsAsync(permission)
          )
        );
        
        const allGranted = results.every(result => result.granted);
        if (!allGranted) {
          const requests = await Promise.all(
            permissions.map(permission =>
              ExpoDevice.requestPermissionsAsync(permission)
            )
          );
          return requests.every(result => result.granted);
        }
        return true;
      }
      return true; // For Android < 12, permissions are handled in AndroidManifest
    }
    return false;
  } catch (error) {
    console.error('Error requesting BLE permissions:', error);
    return false;
  }
};

export const isBluetoothEnabled = async () => {
  if (!manager) return false;
  
  try {
    const state = await manager.state();
    return state === 'PoweredOn';
  } catch (error) {
    console.error('Error checking Bluetooth state:', error);
    return false;
  }
};

export const startBluetoothStateMonitoring = (callback) => {
  if (!manager) {
    callback(false);
    return () => {};
  }
  
  return manager.onStateChange((state) => {
    const isEnabled = state === 'PoweredOn';
    callback(isEnabled);
  }, true);
};

export default manager;
