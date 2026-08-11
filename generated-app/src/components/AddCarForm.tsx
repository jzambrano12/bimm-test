import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert,
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

export function AddCarForm({
  onAddCar,
  loading,
}: AddCarFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearStr, setYearStr] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedColor = color.trim();

    if (!trimmedMake || !trimmedModel || !yearStr.trim() || !trimmedColor) {
      setValidationError("All fields are required.");
      return;
    }

    const year = Number(yearStr);
    const currentYear = new Date().getFullYear();

    if (Number.isNaN(year) || year < 1886 || year > currentYear + 1) {
      setValidationError(
        `Please enter a plausible year between 1886 and ${currentYear + 1}.`
      );
      return;
    }

    try {
      await onAddCar({
        make: trimmedMake,
        model: trimmedModel,
        year,
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
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 400,
        mx: "auto",
        p: 3,
      }}
    >
      <Typography variant="h5" component="h2">
        Add New Car
      </Typography>

      {validationError && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {validationError}
        </Alert>
      )}

      <TextField
        label="Make"
        value={make}
        onChange={(e) => setMake(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />

      <TextField
        label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />

      <TextField
        label="Year"
        type="number"
        value={yearStr}
        onChange={(e) => setYearStr(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />

      <TextField
        label="Color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        required
        fullWidth
        disabled={loading}
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading}
        sx={{ mt: 1 }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Add Car"}
      </Button>
    </Box>
  );
}
