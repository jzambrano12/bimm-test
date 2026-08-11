import { useState, useMemo } from "react";
import {
  Container,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Box,
  CircularProgress,
  Alert,
  Paper,
} from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { CarCard } from "@/components/CarCard";
import { AddCarForm } from "@/components/AddCarForm";

type SortOption = "make" | "year";

export function InventoryDashboard() {
  const { cars, loading, error, addCar, addCarLoading } = useCars();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("make");

  const filteredAndSortedCars = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const result = cars.filter((car) => {
      if (!query) return true;
      return car.model.toLowerCase().includes(query);
    });

    result.sort((a, b) => {
      if (sortBy === "make") {
        return a.make.localeCompare(b.make);
      } else {
        return b.year - a.year;
      }
    });

    return result;
  }, [cars, searchQuery, sortBy]);

  if (loading && cars.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="50vh"
      >
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Inventory Dashboard
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: { xs: 4, md: 0 } }}>
            <Typography variant="h6" gutterBottom>
              Add New Car
            </Typography>
            <AddCarForm onSubmit={addCar} loading={addCarLoading} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              mb: 3,
              flexDirection: { xs: "column", sm: "row" },
            }}
          >
            <TextField
              label="Search by Model"
              variant="outlined"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Sort By"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="make">Make (A-Z)</MenuItem>
              <MenuItem value="year">Year (Newest)</MenuItem>
            </TextField>
          </Box>

          {filteredAndSortedCars.length === 0 ? (
            <Alert severity="info">No cars match your search.</Alert>
          ) : (
            <Grid container spacing={3}>
              {filteredAndSortedCars.map((car) => (
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
