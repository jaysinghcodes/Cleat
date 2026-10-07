import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "CoachLoop",
  slug: "coachloop",
  version: "0.0.1",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "coachloop",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.coachloop.app",
    icon: "./assets/icon.png",
  },
  android: {
    package: "com.coachloop.app",
    adaptiveIcon: {
      backgroundColor: "#0B1220",
      foregroundImage: "./assets/adaptive-icon.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0B1220",
        image: "./assets/splash-icon.png",
        imageWidth: 160,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // `eas init` writes extra.eas.projectId. Expo Go does not need it.
  },
});
