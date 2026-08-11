import { useState, type FormEvent } from "react";
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";

export interface AddCarFormProps {
  onSubmit: (input: {
    make: string;
    model: string;
    year: number;
    color: string;
  }) => Promise<void>;
  loading: boolean;
}

export function AddCarForm({ onSubmit, loading }: AddCarFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
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
      await onSubmit({
        make: trimmedMake,
        model: trimmedModel,
        year: parsedYear,
        color: trimmedColor,
      });
      setMake("");
      setModel("");
      setYear("");
      setColor("");
    } catch (err) {
      if (err instanceof Error) {
        setValidationError(err.message);
      } else {
        setValidationError("An unexpected error occurred.");
      }
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}
    >
      {validationError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {validationError}
        </Alert>
      )}

      <TextField
        label="Make"
        value={make}
        onChange={(e) => setMake(e.target.value)}
        disabled={loading}
        required
        fullWidth
      />

      <TextField
        label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={loading}
        required
        fullWidth
      />

      <TextField
        label="Year"
        type="number"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        disabled={loading}
        required
        fullWidth
      />

      <TextField
        label="Colour"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        disabled={loading}
        required
        fullWidth
      />

      <Button
        type="submit"
        variant="contained"
        disabled={loading}
        sx={{ position: "relative" }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Add Car"}
      </Button>
    </Box>
  );
}
