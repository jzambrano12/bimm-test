import { useMediaQuery } from "@mui/material";

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
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1023px)");

  let src = mobile;
  if (isDesktop) {
    src = desktop;
  } else if (isTablet) {
    src = tablet;
  }

  return <img src={src} alt={alt} style={{ width: "100%", height: "auto" }} />;
}
