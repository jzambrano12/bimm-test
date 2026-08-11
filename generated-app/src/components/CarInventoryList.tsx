import { useState, useMemo } from "react";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import { useCars, useAddCar } from "@/hooks/useCars";
import { CarCard } from "@/components/CarCard";
import { InventoryControls } from "@/components/InventoryControls";
import { AddCarForm } from "@/components/AddCarForm";

export function CarInventoryList() {
  const { cars, loading, error } = useCars();
  const { addCar, loading: addLoading } = useAddCar();

  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  const filteredAndSortedCars = useMemo(() => {
    const filtered = cars.filter((car) =>
      car.model.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "make") {
        return a.make.localeCompare(b.make);
      }
      return b.year - a.year;
    });
  }, [cars, searchTerm, sortBy]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", my: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ my: 4, mx: "auto", maxWidth: 600 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        Car Inventory
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <AddCarForm onAddCar={addCar} loading={addLoading} />
      </Paper>

      <InventoryControls
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {filteredAndSortedCars.length === 0 ? (
        <Typography
          variant="body1"
          color="text.secondary"
          align="center"
          sx={{ my: 6 }}
        >
          No cars match your search.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {filteredAndSortedCars.map((car) => (
            <Grid item xs={12} sm={6} md={4} key={car.id}>
              <CarCard car={car} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
