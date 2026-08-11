import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";

export interface AddCarFormProps {
  onAddCar: (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }) => Promise<void>;
  loading: boolean;
}

export function AddCarForm({ onAddCar, loading }: AddCarFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedColor = color.trim();
    const parsedYear = parseInt(year, 10);

    if (!trimmedMake || !trimmedModel || !year || !trimmedColor) {
      setValidationError("All fields are required.");
      return;
    }

    if (isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) {
      setValidationError("Please enter a plausible year.");
      return;
    }

    try {
      await onAddCar({
        make: trimmedMake,
        model: trimmedModel,
        year: parsedYear,
        color: trimmedColor,
      });
      setMake("");
      setModel("");
      setYear("");
      setColor("");
    } catch {
      // Error handling can be delegated or handled by parent mutation error state
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Add New Car
      </Typography>
      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Make"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          disabled={loading}
          required
        />
        <TextField
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          required
        />
        <TextField
          label="Year"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          disabled={loading}
          required
        />
        <TextField
          label="Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={loading}
          required
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
        >
          {loading ? "Adding Car..." : "Add Car"}
        </Button>
      </Box>
    </Box>
  );
}
