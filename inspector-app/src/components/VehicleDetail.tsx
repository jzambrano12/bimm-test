import { useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider,
  CardMedia,
  useMediaQuery,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import type { Car } from "@/types";

export interface VehicleDetailProps {
  car?: Car;
  loading: boolean;
  error?: Error;
  durationMs: number;
  selectedId: string | null;
}

export function VehicleDetail({
  car,
  loading,
  error,
  durationMs,
  selectedId,
}: VehicleDetailProps) {
  const [copied, setCopied] = useState(false);
  const isSmallScreen = useMediaQuery("(max-width: 899px)");

  if (!selectedId) {
    return (
      <Paper
        sx={{
          p: 4,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <Typography color="text.secondary">
          Select a vehicle to inspect
        </Typography>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, height: "100%" }}>
        <Typography variant="h6" gutterBottom>
          Vehicle unavailable
        </Typography>
        <Alert severity="error">{error.message}</Alert>
      </Paper>
    );
  }

  if (loading) {
    return (
      <Paper
        sx={{
          p: 4,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  if (!car) {
    return (
      <Paper
        sx={{
          p: 4,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography color="text.secondary">
          Select a vehicle to inspect
        </Typography>
      </Paper>
    );
  }

  const handleCopy = async () => {
    const details = [
      `Year: ${car.year}`,
      `Make: ${car.make}`,
      `Model: ${car.model}`,
      `Color: ${car.color}`,
      `Mobile Image: ${car.mobile}`,
      `Tablet Image: ${car.tablet}`,
      `Desktop Image: ${car.desktop}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback or ignore clipboard errors
    }
  };

  const imageSrc = isSmallScreen ? car.mobile : car.desktop;

  return (
    <Paper sx={{ p: 3, height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h5" component="h2">
            {car.year} {car.make} {car.model}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Lookup took {durationMs} ms
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy Details"}
        </Button>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Box sx={{ mb: 2, flexShrink: 0 }}>
        <CardMedia
          component="img"
          image={imageSrc}
          alt={`${car.year} ${car.make} ${car.model}`}
          sx={{ borderRadius: 1, maxHeight: 260, objectFit: "cover" }}
        />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flexGrow: 1, overflowY: "auto" }}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Color
          </Typography>
          <Typography variant="body1">{car.color}</Typography>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Mobile Image URL
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            {car.mobile}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Tablet Image URL
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            {car.tablet}
          </Typography>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            Desktop Image URL
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
            {car.desktop}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
