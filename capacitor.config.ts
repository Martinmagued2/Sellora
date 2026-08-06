import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sellora.app',
  appName: 'Sellora',
  webDir: 'out',
  server: {
    // Production: points to the live web app (Capacitor wraps it as a native app)
    url: process.env.NODE_ENV === 'production'
      ? 'https://www.sellorachat.com'
      : 'http://localhost:3000',
    cleartext: true,
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
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  android: {
    backgroundColor: '#191A23',
    allowMixedContent: true,
  },
  ios: {
    backgroundColor: '#191A23',
    contentInset: "always",
  },
};

export default config;
