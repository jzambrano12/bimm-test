import { Card, CardContent, CardMedia, Typography, useMediaQuery } from "@mui/material";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1023px)");

  let imageUrl = car.desktop;
  if (isMobile) {
    imageUrl = car.mobile;
  } else if (isTablet) {
    imageUrl = car.tablet;
  }

  return (
    <Card sx={{ mb: 2, height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        height="200"
        image={imageUrl}
        alt={`${car.year} ${car.make} ${car.model}`}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography color="text.secondary">
          Colour: {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
