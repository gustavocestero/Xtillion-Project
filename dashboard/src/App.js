import React from "react";
import { Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Overview from "./pages/Overview";
import Stores from "./pages/Stores";
import Promotions from "./pages/Promotions";
import Transfers from "./pages/Transfers";
import Customers from "./pages/Customers";
import Conversion from "./pages/Conversion";

// global Chart.js setup — register once so individual chart files don't have to
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
);

export default function App() {
  return (
    <div className="app">
      <Sidebar />
      <main className="content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/conversion" element={<Conversion />} />
        </Routes>
      </main>
    </div>
  );
}
