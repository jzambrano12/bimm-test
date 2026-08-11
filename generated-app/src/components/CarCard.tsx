import { Card, CardContent, Typography } from "@mui/material";
import { ResponsiveCarImage } from "@/components/ResponsiveCarImage";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const altText = `${car.year} ${car.make} ${car.model}`;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ResponsiveCarImage
        mobile={car.mobile}
        tablet={car.tablet}
        desktop={car.desktop}
        alt={altText}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {altText}
        </Typography>
        <Typography color="text.secondary">
          Colour: {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
