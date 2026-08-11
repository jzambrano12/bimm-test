import { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import { useCars, useAddCar } from "@/hooks/useCars";
import { useCarFilterSort, type SortOption } from "@/hooks/useCarFilterSort";
import { CarCard } from "@/components/CarCard";
import { AddCarForm } from "@/components/AddCarForm";

export function CarInventory() {
  const { cars, loading, error, refetch } = useCars();
  const { addCar, loading: addLoading, error: addError } = useAddCar();

  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("year-desc");

  const filteredAndSortedCars = useCarFilterSort({
    cars,
    searchModel,
    sortBy,
  });

  const handleAddCar = async (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }) => {
    await addCar(input);
    refetch();
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItem: "center",
          mt: 8,
        }}
      >
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

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        Car Inventory
      </Typography>

      {addError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {addError.message}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4 }}
      >
        <AddCarForm onAddCar={handleAddCar} loading={addLoading} />
      </Paper>

      <Box
        sx={{
          display: "flex",
          gap: 2,
          mb: 4,
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
        }}
      >
        <TextField
          label="Search by Model"
          variant="outlined"
          value={searchModel}
          onChange={(e) => setSearchModel(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <TextField
          select
          label="Sort By"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="year-desc">Year (Newest First)</MenuItem>
          <MenuItem value="make-asc">Make (Alphabetical)</MenuItem>
        </TextField>
      </Box>

      {filteredAndSortedCars.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
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
