import { useState } from "react";
import { Box, Typography, Button, CircularProgress, Alert } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { Car } from "@/types";

export interface CarDetailProps {
  car?: Car;
  loading: boolean;
  error?: Error;
  durationMs?: number;
  selectedId: string | null;
}

export function CarDetail({ car, loading, error, durationMs, selectedId }: CarDetailProps) {
  const [copied, setCopied] = useState(false);

  if (selectedId === null) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Typography variant="body1" color="text.secondary">
          Select a vehicle to inspect
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ p: 3, display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, height: "100%" }}>
        <Typography variant="h6" gutterBottom color="error">
          Vehicle unavailable
        </Typography>
        <Alert severity="error">{error.message}</Alert>
      </Box>
    );
  }

  if (!car) {
    return (
      <Box sx={{ p: 3, height: "100%" }}>
        <Typography variant="h6" gutterBottom color="error">
          Vehicle unavailable
        </Typography>
        <Alert severity="error">Vehicle not found</Alert>
      </Box>
    );
  }

  const handleCopy = async () => {
    const detailsString = `Year: ${car.year}\nMake: ${car.make}\nModel: ${car.model}\nColor: ${car.color}`;
    try {
      await navigator.clipboard.writeText(detailsString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback or ignore if clipboard is restricted
    }
  };

  return (
    <Box sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Typography variant="h5">
          {car.year} {car.make} {car.model}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy details"}
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body1">
          <strong>ID:</strong> {car.id}
        </Typography>
        <Typography variant="body1">
          <strong>Make:</strong> {car.make}
        </Typography>
        <Typography variant="body1">
          <strong>Model:</strong> {car.model}
        </Typography>
        <Typography variant="body1">
          <strong>Year:</strong> {car.year}
        </Typography>
        <Typography variant="body1">
          <strong>Color:</strong> {car.color}
        </Typography>
      </Box>

      {durationMs !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: "auto" }}>
          Lookup took {durationMs} ms
        </Typography>
      )}
    </Box>
  );
}
