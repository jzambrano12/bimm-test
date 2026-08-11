import { Box, TextField, FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

export interface CarFilterSortControlsProps {
  searchModel: string;
  onSearchModelChange: (value: string) => void;
  sortBy: 'make' | 'year';
  onSortByChange: (value: 'make' | 'year') => void;
}

export function CarFilterSortControls({
  searchModel,
  onSearchModelChange,
  sortBy,
  onSortByChange,
}: CarFilterSortControlsProps) {
  const handleSortChange = (event: SelectChangeEvent<'make' | 'year'>) => {
    const value = event.target.value;
    if (value === 'make' || value === 'year') {
      onSortByChange(value);
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
      <TextField
        label="Search by Model"
        variant="outlined"
        size="small"
        value={searchModel}
        onChange={(e) => onSearchModelChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: "200px" }}
      />
      <FormControl size="small" sx={{ minWidth: "160px" }}>
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select
          labelId="sort-by-label"
          value={sortBy}
          label="Sort by"
          onChange={handleSortChange}
        >
          <MenuItem value="make">Make (A-Z)</MenuItem>
          <MenuItem value="year">Year (Newest)</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
