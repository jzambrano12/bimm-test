import { Container, Typography, Box, Divider } from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { CarInventoryList } from "@/components/CarInventoryList";
import { AddCarForm } from "@/components/AddCarForm";

export default function App() {
  const { cars, loading, error, refetch } = useCars();

  const handleCarAdded = () => {
    refetch();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Inventory
      </Typography>
      <Box sx={{ mb: 4 }}>
        <AddCarForm onCarAdded={handleCarAdded} />
      </Box>
      <Divider sx={{ mb: 4 }} />
      <CarInventoryList cars={cars} loading={loading} error={error} />
    </Container>
  );
}
