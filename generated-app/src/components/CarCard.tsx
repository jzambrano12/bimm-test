import { Card, CardContent, CardMedia, Typography, useMediaQuery } from "@mui/material";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1023px)");

  let imageUrl = car.mobile;
  if (isDesktop) {
    imageUrl = car.desktop;
  } else if (isTablet) {
    imageUrl = car.tablet;
  }

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        height="200"
        image={imageUrl}
        alt={`${car.year} ${car.make} ${car.model}`}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div">
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Color: {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
