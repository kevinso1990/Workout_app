import React from "react";

// ---------------------------------------------------------------------------
// Helper: chainable animation builder (supports .duration().delay() etc.)
// ---------------------------------------------------------------------------
function animBuilder() {
  const self: any = {};
  const methods = [
    "duration",
    "delay",
    "easing",
    "springify",
    "damping",
    "mass",
    "stiffness",
    "withCallback",
    "withInitialValues",
    "randomDelay",
    "restDisplacementThreshold",
    "restSpeedThreshold",
  ];
  methods.forEach((m) => {
    self[m] = () => self;
  });
  return self;
}

// ---------------------------------------------------------------------------
// Mock @react-native-async-storage/async-storage
// ---------------------------------------------------------------------------
const store: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
    multiGet: vi.fn((keys: string[]) =>
      Promise.resolve(keys.map((k) => [k, store[k] ?? null]))
    ),
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-haptics (no-ops)
// ---------------------------------------------------------------------------
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(() => Promise.resolve()),
  notificationAsync: vi.fn(() => Promise.resolve()),
  selectionAsync: vi.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// ---------------------------------------------------------------------------
// Mock expo-linear-gradient
// ---------------------------------------------------------------------------
vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children, ...rest }: any) =>
    React.createElement("div", { "data-testid": "linear-gradient", ...rest }, children),
}));

// ---------------------------------------------------------------------------
// Mock expo-blur
// ---------------------------------------------------------------------------
vi.mock("expo-blur", () => ({
  BlurView: ({ children, ...rest }: any) =>
    React.createElement("div", rest, children),
}));

// ---------------------------------------------------------------------------
// Mock expo-glass-effect
// ---------------------------------------------------------------------------
vi.mock("expo-glass-effect", () => ({
  GlassView: ({ children, ...rest }: any) =>
    React.createElement("div", rest, children),
}));

// ---------------------------------------------------------------------------
// Mock @expo/vector-icons
// ---------------------------------------------------------------------------
vi.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...rest }: any) =>
    React.createElement("span", { "aria-label": `icon-${name}`, ...rest }),
  MaterialCommunityIcons: ({ name, ...rest }: any) =>
    React.createElement("span", { "aria-label": `icon-${name}`, ...rest }),
  Ionicons: ({ name, ...rest }: any) =>
    React.createElement("span", { "aria-label": `icon-${name}`, ...rest }),
  AntDesign: ({ name, ...rest }: any) =>
    React.createElement("span", { "aria-label": `icon-${name}`, ...rest }),
}));

// ---------------------------------------------------------------------------
// Mock react-native-reanimated (with chainable animation builders)
// ---------------------------------------------------------------------------
vi.mock("react-native-reanimated", () => {
  const builder = animBuilder;
  const Animated = {
    View: ({ entering: _e, exiting: _x, layout: _l, ...props }: any) =>
      React.createElement("div", props),
    Text: ({ entering: _e, ...props }: any) =>
      React.createElement("span", props),
    ScrollView: ({ entering: _e, ...props }: any) =>
      React.createElement("div", props),
    Image: ({ entering: _e, ...props }: any) =>
      React.createElement("img", props),
    createAnimatedComponent: (c: any) => c,
    FlatList: ({ data, renderItem, ...props }: any) =>
      React.createElement(
        "div",
        props,
        (data ?? []).map((item: any, index: number) => renderItem({ item, index }))
      ),
  };
  return {
    default: Animated,
    ...Animated,
    FadeInDown: builder(),
    FadeInUp: builder(),
    FadeOut: builder(),
    FadeIn: builder(),
    ZoomIn: builder(),
    ZoomOut: builder(),
    SlideInLeft: builder(),
    SlideOutRight: builder(),
    useAnimatedStyle: (_fn: any) => ({}),
    useSharedValue: (v: any) => ({ value: v }),
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
    withSequence: (...args: any[]) => args[0],
    withRepeat: (v: any) => v,
    withDelay: (_d: any, v: any) => v,
    runOnJS: (fn: any) => fn,
    runOnUI: (fn: any) => fn,
    interpolate: (v: any) => v,
    interpolateColor: (v: any) => v,
    Extrapolation: { CLAMP: "clamp", EXTEND: "extend" },
    cancelAnimation: () => {},
    useAnimatedRef: () => ({ current: null }),
    measure: () => ({}),
    scrollTo: () => {},
  };
});

// ---------------------------------------------------------------------------
// Mock react-native-gesture-handler
// ---------------------------------------------------------------------------
vi.mock("react-native-gesture-handler", () => ({
  Gesture: { Tap: () => ({ onEnd: () => ({}) }) },
  GestureDetector: ({ children }: any) => children,
  GestureHandlerRootView: ({ children }: any) => children,
  Swipeable: ({ children }: any) => children,
  PanGestureHandler: ({ children }: any) => children,
  TapGestureHandler: ({ children }: any) => children,
  State: {},
}));

// ---------------------------------------------------------------------------
// Mock react-native-safe-area-context
// ---------------------------------------------------------------------------
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// Mock react-native-screens
// ---------------------------------------------------------------------------
vi.mock("react-native-screens", () => ({
  enableScreens: vi.fn(),
  Screen: ({ children }: any) => children,
  ScreenContainer: ({ children }: any) => children,
}));

// ---------------------------------------------------------------------------
// Mock @react-navigation/native
// ---------------------------------------------------------------------------
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    reset: vi.fn(),
    dispatch: vi.fn(),
    setOptions: vi.fn(),
    addListener: () => () => {},
    canGoBack: () => false,
  }),
  useRoute: () => ({ params: {}, name: "Test", key: "test" }),
  useFocusEffect: (fn: any) => fn(),
  NavigationContainer: ({ children }: any) => children,
  CommonActions: {
    navigate: vi.fn(),
    reset: vi.fn((action: any) => action),
    goBack: vi.fn(),
  },
  StackActions: { push: vi.fn(), pop: vi.fn(), replace: vi.fn() },
  ThemeProvider: ({ children }: any) => children,
  DarkTheme: {},
  DefaultTheme: {},
}));

// ---------------------------------------------------------------------------
// Mock @react-navigation/native-stack
// ---------------------------------------------------------------------------
vi.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: () => null,
    Group: ({ children }: any) => children,
  }),
}));

// ---------------------------------------------------------------------------
// Mock @react-navigation/bottom-tabs
// ---------------------------------------------------------------------------
vi.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: () => ({
    Navigator: ({ children }: any) => children,
    Screen: () => null,
  }),
  useBottomTabBarHeight: () => 83,
}));

// ---------------------------------------------------------------------------
// Mock @react-navigation/elements
// ---------------------------------------------------------------------------
vi.mock("@react-navigation/elements", () => ({
  useHeaderHeight: () => 88,
  HeaderButton: ({ onPress, children }: any) =>
    React.createElement("button", { onClick: onPress }, children),
  Header: () => null,
  HeaderTitle: ({ children }: any) => React.createElement("span", null, children),
}));

// ---------------------------------------------------------------------------
// Mock expo-constants
// ---------------------------------------------------------------------------
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: { version: "1.0.0", name: "TestApp" },
    manifest: {},
  },
}));

// ---------------------------------------------------------------------------
// Mock expo-system-ui
// ---------------------------------------------------------------------------
vi.mock("expo-system-ui", () => ({
  setBackgroundColorAsync: vi.fn(() => Promise.resolve()),
  getBackgroundColorAsync: vi.fn(() => Promise.resolve(null)),
}));

// ---------------------------------------------------------------------------
// Mock expo-status-bar
// ---------------------------------------------------------------------------
vi.mock("expo-status-bar", () => ({
  StatusBar: () => null,
  setStatusBarStyle: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock expo-font
// ---------------------------------------------------------------------------
vi.mock("expo-font", () => ({
  useFonts: () => [true, null],
  loadAsync: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Mock expo-splash-screen
// ---------------------------------------------------------------------------
vi.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: vi.fn(() => Promise.resolve()),
  hideAsync: vi.fn(() => Promise.resolve()),
}));
