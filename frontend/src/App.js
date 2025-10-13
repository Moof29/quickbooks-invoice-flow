import { useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardV2 from "./pages/DashboardV2";
import TopNav from "./components/TopNav";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <TopNav />
        <Routes>
          <Route path="/" element={<DashboardV2 />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;