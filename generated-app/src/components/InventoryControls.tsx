import { Box, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";

export interface InventoryControlsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: "make" | "year";
  onSortChange: (value: "make" | "year") => void;
}

export function InventoryControls({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}: InventoryControlsProps) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        mb: 3,
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TextField
        label="Search by model"
        variant="outlined"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: 220 }}
      />
      <ToggleButtonGroup
        value={sortBy}
        exclusive
        onChange={(_e, newValue) => {
          if (newValue !== null) {
            onSortChange(newValue as "make" | "year");
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
