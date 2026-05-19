import React from "react";

export const createBottomTabNavigator = () => ({
  Navigator: ({ children }: any) => children,
  Screen: ({ component: Component }: any) =>
    Component ? React.createElement(Component) : null,
});
export const useBottomTabBarHeight = () => 83;
