import { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Container,
  Paper,
} from "@mui/material";
import { useCars, useAddCar } from "@/hooks/useCars";
import { CarCard } from "./CarCard";
import { AddCarForm } from "./AddCarForm";
import { CarFilterSort, type SortOption } from "./CarFilterSort";

export function CarListView() {
  const { cars, loading, error, refetch } = useCars();
  const { addCar, loading: addLoading } = useAddCar();

  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("make-asc");

  const handleAddCar = async (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }) => {
    await addCar(input);
    refetch();
  };

  const filteredCars = cars.filter((car) =>
    car.model.toLowerCase().includes(searchModel.trim().toLowerCase())
  );

  const sortedCars = [...filteredCars].sort((a, b) => {
    if (sortBy === "make-asc") {
      const makeComp = a.make.localeCompare(b.make);
      if (makeComp !== 0) return makeComp;
      return a.model.localeCompare(b.model);
    } else {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return a.make.localeCompare(b.make);
    }
  });

  if (loading && cars.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItem: "center",
          minHeight: "50vh",
          p: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error && cars.length === 0) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">{error.message}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Fleet Management
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2, position: "sticky", top: 24 }}>
            <AddCarForm onAddCar={handleAddCar} loading={addLoading} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <CarFilterSort
            searchModel={searchModel}
            onSearchChange={setSearchModel}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />

          {sortedCars.length === 0 ? (
            <Box
              sx={{
                p: 4,
                textAlign: "center",
                backgroundColor: "background.paper",
                borderRadius: 1,
                border: "1px dashed",
                borderColor: "divider",
              }}
            >
              <Typography variant="body1" color="text.secondary">
                No cars found matching your filter.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
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
