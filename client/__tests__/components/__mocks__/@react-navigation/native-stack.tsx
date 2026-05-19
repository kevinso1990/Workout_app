import React from "react";

const createNativeStackNavigator = () => ({
  Navigator: ({ children }: any) => children,
  Screen: ({ component: Component }: any) =>
    Component ? React.createElement(Component) : null,
  Group: ({ children }: any) => children,
});

export { createNativeStackNavigator };
export default { createNativeStackNavigator };
