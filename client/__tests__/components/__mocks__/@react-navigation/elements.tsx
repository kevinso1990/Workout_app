import React from "react";

export const useHeaderHeight = () => 88;
export const HeaderButton = ({ onPress, children }: any) =>
  React.createElement("button", { onClick: onPress }, children);
export const Header = () => null;
export const HeaderTitle = ({ children }: any) => React.createElement("span", null, children);
