import { useCallback, useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useClaimFlow } from "@/context/claim-flow";

/**
 * Guests must not leave the claim stack into the host desk via Android back
 * or iOS swipe-from-edge on the root stack. Hosts keep default back behavior.
 */
export function useGuestClaimBackLock() {
  const flow = useClaimFlow();
  const navigation = useNavigation();

  useEffect(() => {
    if (flow.isHost) return;
    const parent = navigation.getParent();
    parent?.setOptions({ gestureEnabled: false, fullScreenGestureEnabled: false });
    return () => {
      parent?.setOptions({ gestureEnabled: true, fullScreenGestureEnabled: true });
    };
  }, [flow.isHost, navigation]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || flow.isHost) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [flow.isHost]),
  );
}
