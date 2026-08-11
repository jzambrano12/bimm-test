import { useState } from "react";
import { Box, CircularProgress, Alert } from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { useCar } from "@/hooks/useCar";
import { CarList } from "@/components/CarList";
import { CarDetail } from "@/components/CarDetail";

export function VehicleInspector() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { cars, loading: carsLoading, error: carsError, refetch } = useCars();
  const { car, loading: carLoading, error: carError, durationMs } = useCar(selectedId);

  if (carsLoading) {
    return (
      <Box sx={{ p: 4, display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (carsError) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">{carsError.message}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 3,
        p: 3,
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, height: "100%" }}>
        <CarList
          cars={cars}
          selectedId={selectedId}
          onSelectCar={(id) => setSelectedId(id)}
          onRefresh={refetch}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, height: "100%" }}>
        <CarDetail
          car={car}
          loading={carLoading}
          error={carError}
          durationMs={durationMs}
          selectedId={selectedId}
        />
      </Box>
    </Box>
  );
}
