import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? config.extra?.eas?.projectId;
  return {
    ...config,
    name: config.name ?? 'SportMatch-app',
    slug: config.slug ?? 'SportMatch-app',
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
    android: { ...config.android,
      ...(process.env.EXPO_ANDROID_PACKAGE ? { package: process.env.EXPO_ANDROID_PACKAGE } : {}),
      ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
    },
    ios: { ...config.ios,
      ...(process.env.EXPO_IOS_BUNDLE_IDENTIFIER ? { bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER } : {}),
    },
  };
};
