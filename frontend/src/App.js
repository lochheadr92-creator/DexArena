import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameProvider } from "@/context/GameContext";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import RosterPage from "@/pages/RosterPage";
import TerrainPage from "@/pages/TerrainPage";
import SavePage from "@/pages/SavePage";
import BattlePage from "@/pages/BattlePage";

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/battle" element={<BattlePage />} />
          <Route element={<AppShell />}>
            <Route path="/" element={<RosterPage />} />
            <Route path="/arena" element={<TerrainPage />} />
            <Route path="/save" element={<SavePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" position="top-center" richColors closeButton duration={2500} />
    </GameProvider>
  );
}

export default App;
