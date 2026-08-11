import { TextField, MenuItem, Box } from "@mui/material";

export type SortOption = "make-asc" | "year-desc";

export interface CarFilterSortProps {
  searchModel: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function CarFilterSort(props: CarFilterSortProps) {
  const { searchModel, onSearchChange, sortBy, onSortChange } = props;

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
      <TextField
        label="Filter by Model"
        variant="outlined"
        size="small"
        value={searchModel}
        onChange={(e) => onSearchChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: "200px" }}
      />
      <TextField
        select
        label="Sort by"
        variant="outlined"
        size="small"
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value as SortOption)}
        sx={{ minWidth: "180px" }}
      >
        <MenuItem value="make-asc">Make (Alphabetical)</MenuItem>
        <MenuItem value="year-desc">Year (Newest First)</MenuItem>
      </TextField>
    </Box>
  );
}
