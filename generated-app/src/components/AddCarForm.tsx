import { useState, type FormEvent } from "react";
import {
  Box,
  TextField,
  Button,
  Alert,
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
    const parsedYear = parseInt(year, 10);

    if (!trimmedMake || !trimmedModel || !trimmedColor || !year.trim()) {
      setValidationError("All fields are required.");
      return;
    }

    if (isNaN(parsedYear) || parsedYear < 1886 || parsedYear > new Date().getFullYear() + 1) {
      setValidationError("Please enter a plausible car year.");
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
      // Mutation error handled by hook state
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}
      {mutationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {mutationError.message}
        </Alert>
      )}
      <TextField
        label="Make"
        value={make}
        onChange={(e) => setMake(e.target.value)}
        fullWidth
        margin="normal"
        required
        disabled={loading}
      />
      <TextField
        label="Model"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        fullWidth
        margin="normal"
        required
        disabled={loading}
      />
      <TextField
        label="Year"
        type="number"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        fullWidth
        margin="normal"
        required
        disabled={loading}
      />
      <TextField
        label="Color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        fullWidth
        margin="normal"
        required
        disabled={loading}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? "Adding Car..." : "Add Car"}
      </Button>
    </Box>
  );
}
