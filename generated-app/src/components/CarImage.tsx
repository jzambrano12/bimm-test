import { useTheme, useMediaQuery } from "@mui/material";

export interface CarImageProps {
  mobile: string;
  tablet: string;
  desktop: string;
  alt: string;
}

export function CarImage({ mobile, tablet, desktop, alt }: CarImageProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"), { noSsr: true });

  let src = mobile;
  if (isDesktop) {
    src = desktop;
  } else if (isTablet) {
    src = tablet;
  }

  return <img src={src} alt={alt} style={{ width: "100%", height: "auto", display: "block" }} />;
}