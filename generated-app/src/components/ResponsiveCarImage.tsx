import { useMediaQuery, useTheme } from "@mui/material";

export interface ResponsiveCarImageProps {
  mobile: string;
  tablet: string;
  desktop: string;
  alt: string;
}

export function ResponsiveCarImage({
  mobile,
  tablet,
  desktop,
  alt,
}: ResponsiveCarImageProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"), {
    noSsr: true,
  });

  let src = mobile;
  if (isDesktop) {
    src = desktop;
  } else if (isTablet) {
    src = tablet;
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
        objectFit: "cover",
      }}
    />
  );
}
