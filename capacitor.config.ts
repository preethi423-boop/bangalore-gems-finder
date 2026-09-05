import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.nammaspot",
  appName: "Namma Spot",
  webDir: "dist",
  server: {
    // The app shell is server-rendered, so the Android wrapper loads the hosted site.
    // Replace this with your own published URL after you publish the project.
    url: "https://bangalore-gems-finder.lovable.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;