import { Routes, Route } from "react-router-dom";
import { DataProvider } from "./store";
import Layout from "./components/Layout";
import OverviewPage from "./pages/OverviewPage";
import ScreenPage from "./pages/ScreenPage";
import WeightLabPage from "./pages/WeightLabPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  return (
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="screen" element={<ScreenPage />} />
          <Route path="lab" element={<WeightLabPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </DataProvider>
  );
}
