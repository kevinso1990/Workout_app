import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { initI18nNative } from "@/i18n.native";

type Props = { children: React.ReactNode };

/**
 * Delays the navigation tree until i18next is initialized (AsyncStorage language).
 */
export function I18nRoot({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initI18nNative()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        console.error("[I18nRoot] init failed", e);
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
