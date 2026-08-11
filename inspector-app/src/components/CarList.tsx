import { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  Paper,
} from "@mui/material";
import type { Car } from "@/types";
import { truncateMakeModel } from "@/utils/format";

export interface CarListProps {
  cars: Car[];
  selectedId: string | null;
  onSelectCar: (id: string) => void;
  onRefresh: () => void;
}

export function CarList({
  cars,
  selectedId,
  onSelectCar,
  onRefresh,
}: CarListProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  useEffect(() => {
    if (cars.length === 0) {
      setFocusedIndex(0);
      return;
    }
    if (selectedId) {
      const idx = cars.findIndex((c) => c.id === selectedId);
      if (idx !== -1) {
        setFocusedIndex(idx);
      }
    }
  }, [selectedId, cars]);

  const selectedCar = cars.find((c) => c.id === selectedId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (cars.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % cars.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + cars.length) % cars.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(cars.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = cars[focusedIndex];
      if (target) {
        onSelectCar(target.id);
        onRefresh();
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 2,
        height: "100%",
        width: "100%",
      }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Car browser"
    >
      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          overflowY: "auto",
          maxHeight: "70vh",
        }}
      >
        <List disablePadding>
          {cars.map((car, index) => {
            const isSelected = car.id === selectedId;
            const isFocused = index === focusedIndex;
            const displayText = truncateMakeModel(car.make, car.model);

            return (
              <ListItemButton
                key={car.id}
                selected={isSelected}
                onClick={() => {
                  setFocusedIndex(index);
                  onSelectCar(car.id);
                }}
                sx={{
                  backgroundColor: isFocused
                    ? "action.hover"
                    : "transparent",
                  borderLeft: isFocused ? "4px solid" : "4px solid transparent",
                  borderColor: isFocused ? "primary.main" : "transparent",
                }}
              >
                <ListItemText
                  primary={`${car.year} ${displayText}`}
                />
              </ListItemButton>
            );
          })}
        </List>
      </Paper>

      <Paper
        variant="outlined"
        sx={{
          flex: 1,
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Typography variant="h5" gutterBottom>
          Vehicle Detail
        </Typography>
        <Divider />
        {selectedCar ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1 }}>
            <Typography variant="h6">
              {selectedCar.year} {selectedCar.make} {selectedCar.model}
            </Typography>
            <Typography variant="body1">
              <strong>Color:</strong> {selectedCar.color}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {selectedCar.id}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            No vehicle selected initially.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
