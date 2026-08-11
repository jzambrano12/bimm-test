import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import { CarListView } from "@/components/CarListView";

export default function App() {
  return (
    <Box sx={{ flexGrow: 1, minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: "bold" }}>
            Car Fleet Manager
          </Typography>
        </Toolbar>
      </AppBar>
      <Box component="main">
        <CarListView />
      </Box>
    </Box>
  );
}
