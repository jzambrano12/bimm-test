import { TextField, ToggleButton, ToggleButtonGroup, Box } from "@mui/material";

export interface CarInventoryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: "make" | "year";
  onSortChange: (value: "make" | "year") => void;
}

export function CarInventoryFilters({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}: CarInventoryFiltersProps) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        mb: 3,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <TextField
        label="Filter by model"
        variant="outlined"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: 200 }}
      />
      <ToggleButtonGroup
        value={sortBy}
        exclusive
        onChange={(_e, val: "make" | "year" | null) => {
          if (val !== null) {
            onSortChange(val);
          }
        }}
        size="small"
        aria-label="Sort by"
      >
        <ToggleButton value="make" aria-label="Sort by make">
          Make
        </ToggleButton>
        <ToggleButton value="year" aria-label="Sort by year">
          Year
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
