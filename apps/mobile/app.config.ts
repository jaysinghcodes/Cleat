import type { ConfigContext, ExpoConfig } from "expo/config";

function envValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = envValue("EAS_PROJECT_ID");
  const owner = envValue("EXPO_OWNER");

  const expoConfig: ExpoConfig = {
    ...config,
    name: "Cleat",
    slug: "cleat",
    version: "0.0.1",
    orientation: "portrait",
    icon: "./assets/icon.png",
    scheme: "cleat",
    userInterfaceStyle: "automatic",
    runtimeVersion: {
      policy: "sdkVersion",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.jaysinghcodes.cleat",
      icon: "./assets/icon.png",
    },
    android: {
      package: "com.jaysinghcodes.cleat",
      adaptiveIcon: {
        backgroundColor: "#1C1917",
        foregroundImage: "./assets/adaptive-icon.png",
      },
      predictiveBackGestureEnabled: false,
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#1C1917",
          image: "./assets/splash-icon.png",
          imageWidth: 160,
        },
      ],
      "expo-updates",
    ],
    experiments: {
      typedRoutes: true,
    },
  };

  if (owner) {
    expoConfig.owner = owner;
  } else {
    delete expoConfig.owner;
  }

  if (projectId) {
    expoConfig.updates = {
      url: `https://u.expo.dev/${projectId}`,
    };
    expoConfig.extra = {
      ...expoConfig.extra,
      eas: {
        projectId,
      },
    };
  } else {
    delete expoConfig.updates;
    if (expoConfig.extra && typeof expoConfig.extra === "object") {
      const extra = { ...expoConfig.extra };
      delete extra.eas;
      expoConfig.extra = extra;
    }
  }

  return expoConfig;
};
