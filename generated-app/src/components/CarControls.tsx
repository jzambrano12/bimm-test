import { TextField, ToggleButton, ToggleButtonGroup, Box } from "@mui/material";

export interface CarControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'make' | 'year';
  onSortChange: (value: 'make' | 'year') => void;
}

export function CarControls({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}: CarControlsProps) {
  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
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
        onChange={(_e, value: 'make' | 'year' | null) => {
          if (value !== null) {
            onSortChange(value);
          }
        }}
        size="small"
      >
        <ToggleButton value="make">Sort by Make</ToggleButton>
        <ToggleButton value="year">Sort by Year</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}
