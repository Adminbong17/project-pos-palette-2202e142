import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qweekpos.app',
  appName: 'QweekPOS',
  webDir: 'dist',
  server: {
    url: 'https://sell.sheikhpharma.shop',
    cleartext: true,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
