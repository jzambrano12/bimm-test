import { Container, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { CarInventoryList } from "@/components/CarInventoryList";

const theme = createTheme();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
        <CarInventoryList />
      </Container>
    </ThemeProvider>
  );
}
