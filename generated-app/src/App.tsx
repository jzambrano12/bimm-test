import { Container, CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { CarInventory } from "@/components/CarInventory";

const theme = createTheme({
  palette: {
    mode: "light",
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <CarInventory />
      </Container>
    </ThemeProvider>
  );
}
