import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import type { SortOption } from "@/hooks/useCarFilterSort";

export interface CarFilterSortControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  selectedYear?: string;
  onYearChange?: (year: string) => void;
  availableYears?: number[];
}

export function CarFilterSortControls({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  selectedYear = "",
  onYearChange,
  availableYears,
}: CarFilterSortControlsProps): JSX.Element {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Search Model"
          placeholder="Search by model..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          fullWidth
          size="small"
        />

        {availableYears !== undefined && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="year-filter-label">Filter by Year</InputLabel>
            <Select
              labelId="year-filter-label"
              id="year-filter-select"
              value={selectedYear}
              label="Filter by Year"
              onChange={(e) => onYearChange?.(e.target.value)}
            >
              <MenuItem value="">All Years</MenuItem>
              {availableYears.map((year) => (
                <MenuItem key={year} value={year.toString()}>
                  {year}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="sort-by-label">Sort By</InputLabel>
          <Select
            labelId="sort-by-label"
            id="sort-by-select"
            value={sortBy}
            label="Sort By"
            onChange={(e) => onSortChange(e.target.value as SortOption)}
          >
            <MenuItem value="make-asc">Make (A-Z)</MenuItem>
            <MenuItem value="year-desc">Year (Newest First)</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Box>
  );
}
