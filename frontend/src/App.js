import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardV2 from "./pages/DashboardV2";
import TopNav from "./components/TopNav";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <TopNav />
          <Routes>
            <Route path="/" element={<DashboardV2 />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ThemeProvider>
  );
}

export default App;