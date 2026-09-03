export default ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  if (!googleMapsApiKey) {
    console.warn(
      "WARNING: GOOGLE_MAPS_ANDROID_API_KEY is not set. " +
        "Android Google Maps may not work in this build."
    );
  }

  return {
    ...config,

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