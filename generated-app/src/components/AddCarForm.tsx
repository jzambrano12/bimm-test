import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import type { AddCarInput } from "../hooks/useCars";

export interface AddCarFormProps {
  onSubmit: (input: AddCarInput) => Promise<void>;
  loading: boolean;
  error?: Error;
  onSuccess?: () => void;
}

export function AddCarForm({
  onSubmit,
  loading,
  error,
  onSuccess,
}: AddCarFormProps): JSX.Element {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [errors, setErrors] = useState<{
    make?: string;
    model?: string;
    year?: string;
    color?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newErrors: {
      make?: string;
      model?: string;
      year?: string;
      color?: string;
    } = {};

    if (!make.trim()) {
      newErrors.make = "Make is required";
    }
    if (!model.trim()) {
      newErrors.model = "Model is required";
    }
    const parsedYear = Number(year);
    if (!year.trim()) {
      newErrors.year = "Year is required";
    } else if (isNaN(parsedYear) || parsedYear <= 0 || !Number.isInteger(parsedYear)) {
      newErrors.year = "Please enter a valid year";
    }
    if (!color.trim()) {
      newErrors.color = "Color is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      await onSubmit({
        make: make.trim(),
        model: model.trim(),
        year: parsedYear,
        color: color.trim(),
      });
      setMake("");
      setModel("");
      setYear("");
      setColor("");
      onSuccess?.();
    } catch {
      // Submission error handled via error prop or parent
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error.message}</Alert>}
        <TextField
          label="Make"
          name="make"
          value={make}
          onChange={(e) => setMake(e.target.value)}
          error={Boolean(errors.make)}
          helperText={errors.make}
          disabled={loading}
          required
          fullWidth
        />
        <TextField
          label="Model"
          name="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          error={Boolean(errors.model)}
          helperText={errors.model}
          disabled={loading}
          required
          fullWidth
        />
        <TextField
          label="Year"
          name="year"
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          error={Boolean(errors.year)}
          helperText={errors.year}
          disabled={loading}
          required
          fullWidth
        />
        <TextField
          label="Color"
          name="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          error={Boolean(errors.color)}
          helperText={errors.color}
          disabled={loading}
          required
          fullWidth
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {loading ? "Adding..." : "Add Car"}
        </Button>
      </Stack>
    </Box>
  );
}
