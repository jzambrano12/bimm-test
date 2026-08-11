import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack,
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
  const [yearStr, setYearStr] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedColor = color.trim();

    if (!trimmedMake || !trimmedModel || !yearStr.trim() || !trimmedColor) {
      setValidationError("All fields are required.");
      return;
    }

    const parsedYear = Number(yearStr);
    const currentYear = new Date().getFullYear() + 1;

    if (Number.isNaN(parsedYear) || parsedYear < 1886 || parsedYear > currentYear) {
      setValidationError(`Please enter a valid year between 1886 and ${currentYear}.`);
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
      setYearStr("");
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
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
      <Stack spacing={2}>
        {validationError && (
          <Alert severity="error" onClose={() => setValidationError(null)}>
            {validationError}
          </Alert>
        )}

        <TextField
          label="Make"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          disabled={loading}
          fullWidth
          required
        />

        <TextField
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
          fullWidth
          required
        />

        <TextField
          label="Year"
          type="number"
          value={yearStr}
          onChange={(e) => setYearStr(e.target.value)}
          disabled={loading}
          fullWidth
          required
        />

        <TextField
          label="Color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={loading}
          fullWidth
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
      </Stack>
    </Box>
  );
}
