import { Card, CardContent, Typography } from "@mui/material";
import { CarImage } from "@/components/CarImage";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const altText = `${car.year} ${car.make} ${car.model}`;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CarImage
        mobile={car.mobile}
        tablet={car.tablet}
        desktop={car.desktop}
        alt={altText}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div" gutterBottom>
          {altText}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Color: {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
