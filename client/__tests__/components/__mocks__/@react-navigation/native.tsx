import React from "react";

export const useNavigation = () => ({
  navigate: () => {},
  goBack: () => {},
  push: () => {},
  replace: () => {},
  reset: () => {},
  dispatch: () => {},
  setOptions: () => {},
  addListener: () => () => {},
  canGoBack: () => false,
});
export const useRoute = () => ({ params: {}, name: "Test", key: "test" });
export const useFocusEffect = (fn: any) => fn();
export const NavigationContainer = ({ children }: any) => children;
export const createNavigatorFactory = (n: any) => n;
export const useNavigationContainerRef = () => ({ current: null, navigate: () => {} });
export const createNavigationContainerRef = () => ({
  isReady: () => true,
  navigate: () => {},
  dispatch: () => {},
  getRootState: () => ({}),
  getCurrentRoute: () => null,
  current: null,
});
export const StackActions = { push: () => {}, pop: () => {}, replace: () => {} };
export const CommonActions = { navigate: () => {}, reset: () => {}, goBack: () => {} };
export const ThemeProvider = ({ children }: any) => children;
export const DarkTheme = {};
export const DefaultTheme = {};
