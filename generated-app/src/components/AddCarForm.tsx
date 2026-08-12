import { useState, type FormEvent } from "react";
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);
    setSubmitError(null);

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
      setSuccessMessage("Car added successfully!");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to add car. Please try again."
      );
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 400, mx: "auto", my: 4 }}
    >
      <Typography variant="h5" component="h2">
        Add a New Car
      </Typography>

      {validationError && (
        <Alert severity="error" aria-label="validation-error">
          {validationError}
        </Alert>
      )}

      {submitError && (
        <Alert severity="error" aria-label="submit-error">
          {submitError}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" aria-label="success-message">
          {successMessage}
        </Alert>
      )}

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
        label="Colour"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        disabled={loading}
        required
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {loading ? "Adding..." : "Add Car"}
      </Button>
    </Box>
  );
}
