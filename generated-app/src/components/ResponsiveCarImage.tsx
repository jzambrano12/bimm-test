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
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1023px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  let src = desktop;
  if (isMobile) {
    src = mobile;
  } else if (isTablet) {
    src = tablet;
  } else if (isDesktop) {
    src = desktop;
  }

  return <img src={src} alt={alt} />;
}
