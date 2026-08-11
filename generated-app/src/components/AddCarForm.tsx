import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
} from "@mui/material";
import { useAddCar } from "../hooks/useAddCar";

export interface AddCarFormProps {
  onCarAdded: () => void;
}

export function AddCarForm({ onCarAdded }: AddCarFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { addCar, loading, error } = useAddCar();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedColor = color.trim();
    const parsedYear = parseInt(year, 10);

    if (!trimmedMake || !trimmedModel || !trimmedColor || !year.trim()) {
      setValidationError("All fields are required.");
      return;
    }

    if (isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) {
      setValidationError("Please enter a plausible year.");
      return;
    }

    try {
      await addCar({
        make: trimmedMake,
        model: trimmedModel,
        year: parsedYear,
        color: trimmedColor,
      });
      setMake("");
      setModel("");
      setYear("");
      setColor("");
      onCarAdded();
    } catch (_err) {
      // Mutation error is already captured in the error state from useAddCar
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
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error.message}
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
        >
          {loading ? "Adding..." : "Add Car"}
        </Button>
      </Box>
    </Box>
  );
}
