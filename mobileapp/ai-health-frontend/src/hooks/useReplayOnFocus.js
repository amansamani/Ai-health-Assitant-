import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

// Returns a number that increments every time the screen gains focus —
// on first mount, and again every time the user navigates back to it.
// Pass it as the `trigger` prop to the animated icons in ./icons/MotionIcons
// so their entrance animation replays on each visit instead of looping
// continuously or only playing once ever.
export function useReplayOnFocus() {
  const [key, setKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setKey((k) => k + 1);
    }, [])
  );

  return key;
}
