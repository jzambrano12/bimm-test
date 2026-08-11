import { useState, useMemo } from "react";
import { Grid2, Typography, CircularProgress, Alert, Box } from "@mui/material";
import { CarCard } from "@/components/CarCard";
import { CarFiltersControls } from "@/components/CarFiltersControls";
import type { Car } from "@/types";

export interface CarInventoryListProps {
  cars: Car[];
  loading: boolean;
  error?: Error;
}

export function CarInventoryList(props: CarInventoryListProps) {
  const { cars, loading, error } = props;

  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  const filteredAndSortedCars = useMemo(() => {
    const filtered = cars.filter((car) =>
      car.model.toLowerCase().includes(searchModel.trim().toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "make") {
        return a.make.localeCompare(b.make);
      }
      return b.year - a.year;
    });
  }, [cars, searchModel, sortBy]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <CarFiltersControls
        searchModel={searchModel}
        onSearchModelChange={setSearchModel}
        sortBy={sortBy}
        onSortByChange={setSortBy}
      />

      {filteredAndSortedCars.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
          No cars match your search criteria.
        </Typography>
      ) : (
        <Grid2 container spacing={3}>
          {filteredAndSortedCars.map((car) => (
            <Grid2 key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CarCard car={car} />
            </Grid2>
          ))}
        </Grid2>
      )}
    </Box>
  );
}
