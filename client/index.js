import { registerRootComponent } from "expo";
import { Platform } from "react-native";

import { installWebGlobalErrorHandlers } from "@/lib/installWebGlobalErrorHandlers";

// React Native defines a global `window` (without DOM APIs), so a bare
// `typeof window !== "undefined"` check is true on native and crashes at
// `window.addEventListener`. Gate on the actual web platform instead — same
// pattern used for `registerWebServiceWorker` in AppNative.tsx.
if (Platform.OS === "web" && typeof window !== "undefined") {
  installWebGlobalErrorHandlers();
}

// IMPORTANT: this file is the Expo (native iOS / Android / mobile preview)
// entry point. It must NOT load `client/App.tsx` — that file is the React
// web SPA built with Wouter and uses browser-only APIs like
// `window.location`, which crash on native with
// `[ReferenceError: Property 'location' doesn't exist]`.
//
// The native app lives under `client/screens/` + `client/navigation/` and is
// composed in `client/AppNative.tsx`.
import AppNative from "@/AppNative";

registerRootComponent(AppNative);
