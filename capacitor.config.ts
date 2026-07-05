import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sellora.app',
  appName: 'Sellora',
  webDir: 'out',
  server: {
    // In production, remove this and use the deployed URL
    // url: 'https://your-vercel-app.vercel.app',
    // cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#191A23',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#191A23',
      showSpinner: true,
      spinnerColor: '#5865F2',
    },
    App: {
      launchUrl: '/',
    },
  },
  android: {
    backgroundColor: '#191A23',
  },
  ios: {
    backgroundColor: '#191A23',
  },
};

export default config;
