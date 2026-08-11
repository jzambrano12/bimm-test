import { useState } from "react";
import {
  Container,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Box,
  Paper,
} from "@mui/material";
import { useCars, useAddCar } from "@/hooks/useCars";
import { CarCard } from "./CarCard";
import { CarControls } from "./CarControls";
import { AddCarForm } from "./AddCarForm";

export function CarInventory() {
  const { cars, loading, error } = useCars();
  const { addCar, loading: addLoading, error: addError } = useAddCar();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  if (loading && cars.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">{error.message}</Alert>
      </Container>
    );
  }

  const filteredCars = cars.filter((car) =>
    car.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCars = [...filteredCars].sort((a, b) => {
    if (sortBy === "make") {
      return a.make.localeCompare(b.make);
    } else {
      return b.year - a.year;
    }
  });

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Inventory
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: { xs: 3, md: 0 } }}>
            <Typography variant="h6" gutterBottom>
              Add New Car
            </Typography>
            {addError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {addError.message}
              </Alert>
            )}
            <AddCarForm onAddCar={addCar} loading={addLoading} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <CarControls
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {sortedCars.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body1" color="text.secondary">
                No cars found matching your search.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {sortedCars.map((car) => (
                <Grid item xs={12} sm={6} key={car.id}>
                  <CarCard car={car} />
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}
