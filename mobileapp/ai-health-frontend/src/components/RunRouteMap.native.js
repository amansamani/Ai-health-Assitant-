import React, { forwardRef, useImperativeHandle, useRef } from "react";
import MapView, { Marker, Polyline } from "react-native-maps";
import { COLORS } from "../constants/theme";

const RunRouteMap = forwardRef(function RunRouteMap(
  {
    route = [],
    region,
    style,
    live = false,
    showUserLocation = false,
    showStartMarker = true,
    showEndMarker = false,
    strokeColor = COLORS.primary,
    strokeWidth = 4,
    initialRegion,
    ...props
  },
  forwardedRef
) {
  const mapRef = useRef(null);

  useImperativeHandle(forwardedRef, () => ({
    animateCamera: (...args) => mapRef.current?.animateCamera?.(...args),
    animateToRegion: (...args) => mapRef.current?.animateToRegion?.(...args),
    getMapRef: () => mapRef.current,
  }), []);

  const effectiveRegion = region || initialRegion;
  const coordinates = route
    .filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
    .map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <MapView
      ref={mapRef}
      style={style}
      initialRegion={effectiveRegion}
      showsUserLocation={showUserLocation}
      showsMyLocationButton={false}
      {...props}
    >
      {coordinates.length > 1 && (
        <Polyline
          coordinates={coordinates}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
        />
      )}

      {showStartMarker && coordinates.length > 0 && (
        <Marker
          coordinate={coordinates[0]}
          pinColor={COLORS.success}
          title="Start"
        />
      )}

      {showEndMarker && coordinates.length > 1 && (
        <Marker
          coordinate={coordinates[coordinates.length - 1]}
          pinColor={COLORS.error}
          title="Finish"
        />
      )}
    </MapView>
  );
});

export default RunRouteMap;
