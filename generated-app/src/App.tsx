import { useState } from "react";
import { Container, Typography, Box, Paper, Grid } from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { CarList } from "@/components/CarList";
import { CarFilterSortControls } from "@/components/CarFilterSortControls";
import { AddCarForm } from "@/components/AddCarForm";

export default function App() {
  const { cars, loading, error, refetch } = useCars();
  const [searchModel, setSearchModel] = useState("");
  const [sortBy, setSortBy] = useState<"make" | "year">("make");

  const handleCarAdded = async () => {
    await refetch();
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom fontWeight="bold">
        Car Inventory Manager
      </Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 3, position: "sticky", top: 24 }}>
            <AddCarForm onCarAdded={handleCarAdded} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 3 }}>
            <CarFilterSortControls
              searchModel={searchModel}
              onSearchModelChange={setSearchModel}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />
          </Box>
          <CarList
            cars={cars}
            loading={loading}
            error={error}
            searchModel={searchModel}
            sortBy={sortBy}
          />
        </Grid>
      </Grid>
    </Container>
  );
}
