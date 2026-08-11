import { Container, CssBaseline } from "@mui/material";
import { CarInventory } from "@/components/CarInventory";

export default function App() {
  return (
    <Container component="main" maxWidth="lg" sx={{ py: 4 }}>
      <CssBaseline />
      <CarInventory />
    </Container>
  );
}