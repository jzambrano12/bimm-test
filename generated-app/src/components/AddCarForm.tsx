import { useState, type FormEvent } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useAddCar } from "@/hooks/useCars";

export interface AddCarFormProps {
  onCarAdded: () => void;
}

export function AddCarForm({ onCarAdded }: AddCarFormProps) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { addCar, loading, error: mutationError } = useAddCar();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMake = make.trim();
    const trimmedModel = model.trim();
    const trimmedColor = color.trim();

    if (!trimmedMake || !trimmedModel || !year.trim() || !trimmedColor) {
      setValidationError("All fields are required.");
      return;
    }

    const parsedYear = Number(year);
    if (Number.isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) {
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
    } catch {
      // Error handled by mutationError state
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 4 }}>
      <Typography variant="h6">Add New Car</Typography>
      {validationError && <Alert severity="error">{validationError}</Alert>}
      {mutationError && <Alert severity="error">{mutationError.message}</Alert>}
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
        disabled={loading}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : undefined}
      >
        {loading ? "Adding..." : "Add Car"}
      </Button>
    </Box>
  );
}
