import { Container, Typography, Box, Paper } from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { CarInventoryList } from "@/components/CarInventoryList";
import { AddCarForm } from "@/components/AddCarForm";

export default function App() {
  const { cars, loading, error } = useCars();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 4, display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Car Inventory Manager
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your vehicle fleet, add new cars, and inspect specifications.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
          gap: 4,
          alignItems: "start",
        }}
      >
        <Paper elevation={2} sx={{ p: 3 }}>
          <AddCarForm />
        </Paper>

        <Box>
          <CarInventoryList cars={cars} loading={loading} error={error} />
        </Box>
      </Box>
    </Container>
  );
}
