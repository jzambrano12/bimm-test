import { useState, useMemo } from "react";
import {
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Box,
  TextField,
  MenuItem,
  Stack,
} from "@mui/material";
import type { Car } from "../types";
import { CarCard } from "./CarCard";

export interface CarListProps {
  cars: Car[];
  loading: boolean;
  error?: Error;
  searchModel: string;
  sortBy: 'make' | 'year';
}

export function CarList({ cars, loading, error }: CarListProps) {
  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<'make' | 'year'>("make");

  const filteredAndSortedCars = useMemo(() => {
    const query = searchModel.trim().toLowerCase();
    const filtered = cars.filter((car) =>
      car.model.toLowerCase().includes(query)
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "make") {
        const result = a.make.localeCompare(b.make);
        if (result !== 0) return result;
        return a.model.localeCompare(b.model);
      }
      return b.year - a.year;
    });
  }, [cars, searchModel, sortBy]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  return (
    <Box>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        mb={4}
        justifyContent="space-between"
      >
        <TextField
          label="Filter by Model"
          variant="outlined"
          size="small"
          value={searchModel}
          onChange={(e) => setSearchModel(e.target.value)}
          sx={{ flexGrow: 1, maxWidth: { sm: 400 } }}
        />
        <TextField
          select
          label="Sort by"
          variant="outlined"
          size="small"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'make' | 'year')}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="make">Make (A-Z)</MenuItem>
          <MenuItem value="year">Year (Newest)</MenuItem>
        </TextField>
      </Stack>

      {filteredAndSortedCars.length === 0 ? (
        <Typography color="text.secondary" align="center" py={4}>
          No cars match the filter.
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
