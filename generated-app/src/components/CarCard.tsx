import { Card, CardContent, Typography, Box, CardMedia, useMediaQuery } from "@mui/material";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isTablet = useMediaQuery("(min-width: 641px) and (max-width: 1023px)");

  const imageSrc = isMobile ? car.mobile : isTablet ? car.tablet : car.desktop;

  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box component="picture" sx={{ display: "block", width: "100%" }}>
        <source media="(max-width: 640px)" srcSet={car.mobile} />
        <source media="(min-width: 641px) and (max-width: 1023px)" srcSet={car.tablet} />
        <source media="(min-width: 1024px)" srcSet={car.desktop} />
        <CardMedia
          component="img"
          src={imageSrc}
          alt={`${car.year} ${car.make} ${car.model}`}
          sx={{ height: 200, width: "100%", objectFit: "cover" }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="div" gutterBottom>
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
