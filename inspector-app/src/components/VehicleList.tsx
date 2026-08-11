import { useRef } from "react";
import {
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import type { Car } from "@/types";

export interface VehicleListProps {
  cars: Car[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefetchSelected: () => void;
}

export function VehicleList({
  cars,
  selectedId,
  onSelect,
  onRefetchSelected,
}: VehicleListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "…";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (cars.length === 0) return;

    const currentIndex = cars.findIndex((c) => c.id === selectedId);

    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        const nextIndex =
          currentIndex === -1 || currentIndex >= cars.length - 1
            ? 0
            : currentIndex + 1;
        const targetCar = cars[nextIndex];
        if (targetCar) {
          onSelect(targetCar.id);
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prevIndex =
          currentIndex <= 0 ? cars.length - 1 : currentIndex - 1;
        const targetCar = cars[prevIndex];
        if (targetCar) {
          onSelect(targetCar.id);
        }
        break;
      }
      case "Home": {
        e.preventDefault();
        const firstCar = cars[0];
        if (firstCar) {
          onSelect(firstCar.id);
        }
        break;
      }
      case "End": {
        e.preventDefault();
        const lastCar = cars[cars.length - 1];
        if (lastCar) {
          onSelect(lastCar.id);
        }
        break;
      }
      case "Enter": {
        e.preventDefault();
        if (selectedId) {
          onRefetchSelected();
        }
        break;
      }
    }
  };

  return (
    <List
      ref={listRef}
      tabIndex={0}
      aria-label="Vehicle List"
      onKeyDown={handleKeyDown}
      sx={{
        width: "100%",
        maxWidth: 360,
        bgcolor: "background.paper",
        position: "relative",
        overflow: "auto",
        maxHeight: "100%",
        p: 0,
        "&:focus": {
          outline: "2px solid",
          outlineColor: "primary.main",
        },
      }}
    >
      {cars.map((car) => {
        const isSelected = car.id === selectedId;
        const combined = `${car.make} ${car.model}`;
        const truncated = truncateText(combined, 22);

        return (
          <ListItemButton
            key={car.id}
            selected={isSelected}
            onClick={() => onSelect(car.id)}
            sx={{
              "&.Mui-selected": {
                bgcolor: "action.selected",
                "&:hover": {
                  bgcolor: "action.selected",
                },
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "secondary.main",
                outlineOffset: "-2px",
              },
            }}
          >
            <ListItemText
              primary={
                <Typography variant="body1" component="span">
                  {car.year} {truncated}
                </Typography>
              }
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}
