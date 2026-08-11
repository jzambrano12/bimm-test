import { useMediaQuery } from "@mui/material";

export function useResponsiveImage(images: {
  mobile: string;
  tablet: string;
  desktop: string;
}): string {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isMobile) {
    return images.mobile;
  }

  if (isDesktop) {
    return images.desktop;
  }

  return images.tablet;
}
