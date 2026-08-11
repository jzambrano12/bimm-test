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
import { CarFilterSort, SortOption } from "@/components/CarFilterSort";
import type { Car } from "@/types";

export function CarList() {
  const { cars, loading, error, refetch } = useCars();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("make-asc");

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  const filteredCars = cars.filter((car: Car) =>
    car.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCars = [...filteredCars].sort((a: Car, b: Car) => {
    if (sortBy === "make-asc") {
      return a.make.localeCompare(b.make);
    }
    return b.year - a.year;
  });

  return (
    <Box sx={{ py: 4, px: 2, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Car Inventory
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Add New Car
            </Typography>
            <AddCarForm onCarAdded={() => refetch()} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <CarFilterSort
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            sortBy={sortBy}
            onSortByChange={setSortBy}
          />

          {sortedCars.length === 0 ? (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              No matching cars found.
            </Typography>
          ) : (
            <Grid container spacing={2}>
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
