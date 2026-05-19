import { registerRootComponent } from "expo";

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
