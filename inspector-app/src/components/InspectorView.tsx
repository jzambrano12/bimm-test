import { useState } from "react";
import { Box, Paper, Alert } from "@mui/material";
import { useCars } from "@/hooks/useCars";
import { useCar } from "@/hooks/useCar";
import { VehicleList } from "@/components/VehicleList";
import { VehicleDetail } from "@/components/VehicleDetail";

export function InspectorView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { cars, loading: listLoading, error: listError, refetch: refetchList } = useCars();
  const { car, loading: detailLoading, error: detailError, durationMs, refetch: refetchCar } = useCar(selectedId);

  if (listLoading && cars.length === 0) {
    return (
      <Box sx={{ p: 4, display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        Loading vehicles...
      </Box>
    );
  }

  if (listError && cars.length === 0) {
    return (
      <Box sx={{ p: 4, height: "100vh" }}>
        <Alert severity="error">Failed to load vehicles: {listError.message}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        p: 2,
        height: "100vh",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Paper
        elevation={1}
        sx={{
          width: { xs: "100%", md: "360px" },
          flexShrink: 0,
          height: { xs: "auto", md: "100%" },
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <VehicleList
          cars={cars}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id)}
          onRefetchSelected={() => {
            refetchList();
            refetchCar();
          }}
        />
      </Paper>
      <Box sx={{ flexGrow: 1, height: { xs: "auto", md: "100%" }, overflow: "hidden" }}>
        <VehicleDetail
          car={car}
          loading={detailLoading}
          error={detailError}
          durationMs={durationMs}
          selectedId={selectedId}
        />
      </Box>
    </Box>
  );
}
