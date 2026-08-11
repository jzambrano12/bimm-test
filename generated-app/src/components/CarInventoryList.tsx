import { useState } from "react";
import { Box, Grid, CircularProgress, Alert, Typography } from "@mui/material";
import { CarCard } from "@/components/CarCard";
import { CarInventoryFilters } from "@/components/CarInventoryFilters";
import type { Car } from "@/types";

export interface CarInventoryListProps {
  cars: Car[];
  loading: boolean;
  error?: Error;
}

export function CarInventoryList({
  cars,
  loading,
  error,
}: CarInventoryListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  const filteredCars = cars.filter((car) =>
    car.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCars = [...filteredCars].sort((a, b) => {
    if (sortBy === "make") {
      return a.make.localeCompare(b.make);
    }
    return b.year - a.year;
  });

  return (
    <Box>
      <CarInventoryFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
      {sortedCars.length === 0 ? (
        <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
          No cars match your search.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {sortedCars.map((car) => (
            <Grid item xs={12} sm={6} md={4} key={car.id}>
              <CarCard car={car} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
