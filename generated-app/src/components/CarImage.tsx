import { useTheme, useMediaQuery } from "@mui/material";
import { Car } from "../types";

export interface CarImageProps {
  car: Car;
  alt?: string;
}

export function CarImage({ car, alt }: CarImageProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down(641));
  const isTablet = useMediaQuery(theme.breakpoints.between(641, 1024));

  let imageUrl = car.desktop;
  if (isMobile) {
    imageUrl = car.mobile;
  } else if (isTablet) {
    imageUrl = car.tablet;
  }

  const imageAlt = alt ?? `${car.year} ${car.make} ${car.model}`;

  return (
    <img
      src={imageUrl}
      alt={imageAlt}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
      }}
    />
  );
}
