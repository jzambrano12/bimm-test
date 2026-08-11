import { Card, CardContent, Typography } from "@mui/material";
import { Car } from "@/types";
import { CarImage } from "@/components/CarImage";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CarImage car={car} />
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
