import { TextField, ToggleButton, ToggleButtonGroup, Box } from "@mui/material";

export interface CarFiltersControlsProps {
  searchModel: string;
  onSearchModelChange: (value: string) => void;
  sortBy: "make" | "year";
  onSortByChange: (value: "make" | "year") => void;
}

export function CarFiltersControls(props: CarFiltersControlsProps) {
  const { searchModel, onSearchModelChange, sortBy, onSortByChange } = props;

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
        label="Search by model"
        variant="outlined"
        size="small"
        value={searchModel}
        onChange={(e) => onSearchModelChange(e.target.value)}
        sx={{ flexGrow: 1, minWidth: "200px" }}
      />
      <ToggleButtonGroup
        value={sortBy}
        exclusive
        onChange={(_e, newValue) => {
          if (newValue !== null) {
            onSortByChange(newValue);
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
