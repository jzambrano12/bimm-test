import { Card, CardContent, Typography } from "@mui/material";
import { ResponsiveCarImage } from "@/components/ResponsiveCarImage";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ResponsiveCarImage
        mobile={car.mobile}
        tablet={car.tablet}
        desktop={car.desktop}
        alt={`${car.year} ${car.make} ${car.model}`}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Colour: {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
