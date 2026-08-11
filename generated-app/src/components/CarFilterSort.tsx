import { Box, TextField, MenuItem, Select, FormControl, InputLabel } from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";

export type SortOption = 'make-asc' | 'year-desc';

export interface CarFilterSortProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  sortBy: SortOption;
  onSortByChange: (value: SortOption) => void;
}

export function CarFilterSort({
  searchTerm,
  onSearchTermChange,
  sortBy,
  onSortByChange,
}: CarFilterSortProps) {
  const handleSortChange = (event: SelectChangeEvent<SortOption>) => {
    onSortByChange(event.target.value as SortOption);
  };

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
      <TextField
        label="Filter by model"
        variant="outlined"
        size="small"
        value={searchTerm}
        onChange={(e) => onSearchTermChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: 200 }}
      />
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="sort-by-label">Sort by</InputLabel>
        <Select
          labelId="sort-by-label"
          value={sortBy}
          label="Sort by"
          onChange={handleSortChange}
        >
          <MenuItem value="make-asc">Make (A-Z)</MenuItem>
          <MenuItem value="year-desc">Year (Newest first)</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}
