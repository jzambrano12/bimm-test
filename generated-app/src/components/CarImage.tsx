import { useTheme, useMediaQuery, Box } from "@mui/material";
import type { Car } from "@/types";

export interface CarImageProps {
  car: Car;
}

export function CarImage({ car }: CarImageProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  let src = car.mobile;
  if (isDesktop) {
    src = car.desktop;
  } else if (isTablet) {
    src = car.tablet;
  }

  return (
    <Box
      component="img"
      src={src}
      alt={`${car.year} ${car.make} ${car.model}`}
      sx={{
        width: "100%",
        height: "auto",
        display: "block",
        objectFit: "cover",
      }}
    />
  );
}
