import { Card, CardContent, Typography, Box } from "@mui/material";
import { CarImage } from "@/components/CarImage";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <CarImage car={car} />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div" gutterBottom>
          {car.year} {car.make} {car.model}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color="text.secondary">
            Color:
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {car.color}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
