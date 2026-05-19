import React from "react";

export function LinearGradient({ children, ...rest }: any) {
  return <div data-mock="linear-gradient" {...rest}>{children}</div>;
}
