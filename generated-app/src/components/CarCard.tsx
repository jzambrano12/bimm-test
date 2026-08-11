import { useTheme, useMediaQuery, Card, CardMedia, CardContent, Typography } from "@mui/material";
import type { Car } from "@/types";

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const isTablet = useMediaQuery(theme.breakpoints.between("sm", "md"));

  let imageSrc = car.mobile;
  if (isDesktop) {
    imageSrc = car.desktop;
  } else if (isTablet) {
    imageSrc = car.tablet;
  }

  return (
    <Card sx={{ maxWidth: 345, height: "100%", display: "flex", flexDirection: "column" }}>
      <CardMedia
        component="img"
        height="194"
        image={imageSrc}
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
