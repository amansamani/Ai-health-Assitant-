import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useContext, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AppNavigator from "../src/navigation/AppNavigator";

SplashScreen.preventAutoHideAsync();

const splashVideoSource = require("../assets/videos/splash.mp4");

function VideoSplash({ onFinish }: { onFinish: () => void }) {
  const player = useVideoPlayer(splashVideoSource, (p) => {
    p.muted = true; // set false if your video has intentional sound
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", onFinish);
    return () => sub.remove();
  }, [player, onFinish]);

  return (
    <View style={styles.videoWrap}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
    </View>
  );
}

function RootNavigator() {
  const { userToken, loading } = useContext(AuthContext);
  const [videoDone, setVideoDone] = useState(false);

  useEffect(() => {
    // Native static splash's job ends the moment JS is ready — hand off to
    // the video splash immediately instead of waiting on auth.
    SplashScreen.hideAsync();
  }, []);

  if (!videoDone) {
    return <VideoSplash onFinish={() => setVideoDone(true)} />;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return userToken ? <AppNavigator /> : <AuthNavigator />;
}

export default function Page() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  // Match your splash-screen backgroundColor from app.json so there's no
  // color flash between native splash → video → app.
  videoWrap: { flex: 1, backgroundColor: "#29195A" },
});