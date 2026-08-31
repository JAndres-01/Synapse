import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.synapse.app',
  appName: 'Synapse',
  webDir: 'out',
  backgroundColor: '#09090b',
  server: {
    url: 'http://192.168.0.13:3000',
    cleartext: true,
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
}

export default config
