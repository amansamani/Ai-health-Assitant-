import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useContext, useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useVideoPlayer, VideoView } from "expo-video";
import { Redirect } from "expo-router";
import { AuthContext } from "@/src/context/AuthContext";

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

// "/" itself is just the boot sequence: play the splash video, wait for auth
// state to resolve, then hand off to a real route. (auth)/(app) layouts also
// guard themselves, so deep links land in the right place too.
export default function Index() {
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

  return <Redirect href={userToken ? "/(app)/home" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  // Match your splash-screen backgroundColor from app.json so there's no
  // color flash between native splash → video → app.
  videoWrap: { flex: 1, backgroundColor: "#29195A" },
});
