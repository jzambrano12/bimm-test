import { Card, CardContent, CardMedia, Typography } from '@mui/material';
import { Car } from '../types';
import { useResponsiveImage } from '../hooks/useResponsiveImage';

export interface CarCardProps {
  car: Car;
}

export function CarCard({ car }: CarCardProps): JSX.Element {
  const imageUrl = useResponsiveImage({
    mobile: car.mobile,
    tablet: car.tablet,
    desktop: car.desktop,
  });

  return (
    <Card>
      <CardMedia
        component="img"
        image={imageUrl}
        alt={`${car.year} ${car.make} ${car.model}`}
      />
      <CardContent>
        <Typography variant="h6" component="h2">
          {car.year} {car.make} {car.model}
        </Typography>
        <Typography color="text.secondary">
          {car.color}
        </Typography>
      </CardContent>
    </Card>
  );
}
