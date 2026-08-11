import { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { CarCard } from "@/components/CarCard";
import { AddCarForm } from "@/components/AddCarForm";
import { CarFilterSortControls } from "@/components/CarFilterSortControls";
import type { Car } from "@/types";

export function CarInventory() {
  const { cars, loading, error, refetch } = useCars();
  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  if (loading && cars.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && cars.length === 0) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  const filteredCars = cars.filter((car: Car) =>
    car.model.toLowerCase().includes(searchModel.trim().toLowerCase())
  );

  const sortedCars = [...filteredCars].sort((a: Car, b: Car) => {
    if (sortBy === "make") {
      return a.make.localeCompare(b.make);
    } else {
      return b.year - a.year;
    }
  });

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Inventory
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, position: { md: "sticky" }, top: 24 }}>
            <AddCarForm onCarAdded={() => refetch()} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <CarFilterSortControls
            searchModel={searchModel}
            onSearchModelChange={setSearchModel}
            sortBy={sortBy}
            onSortByChange={setSortBy}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error.message}
            </Alert>
          )}

          {sortedCars.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                No cars found matching your search criteria.
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {sortedCars.map((car: Car) => (
                <Grid item xs={12} sm={6} key={car.id}>
                  <CarCard car={car} />
                </Grid>
              ))}
            </Grid>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
