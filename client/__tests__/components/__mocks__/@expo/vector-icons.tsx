import React from "react";

const makeIcon = (iconSet: string) =>
  ({ name, ...rest }: any) =>
    React.createElement("span", { "aria-label": `icon-${name}`, ...rest });

export const Feather = makeIcon("Feather");
export const MaterialCommunityIcons = makeIcon("MaterialCommunityIcons");
export const Ionicons = makeIcon("Ionicons");
export const AntDesign = makeIcon("AntDesign");
