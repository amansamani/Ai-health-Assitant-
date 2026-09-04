export default ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  const googleWebClientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    config.extra?.googleWebClientId ||
    null;

  if (!googleMapsApiKey) {
    console.warn(
      "WARNING: GOOGLE_MAPS_ANDROID_API_KEY is not set. " +
        "Android Google Maps may not work in this build."
    );
  }

  if (!googleWebClientId) {
    console.warn(
      "WARNING: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set. " +
        "Google Sign-In will not work in this build."
    );
  }

  return {
    ...config,

    extra: {
      ...config.extra,
      googleWebClientId,
    },

    android: {
      ...config.android,

      config: {
        ...config.android?.config,

        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};