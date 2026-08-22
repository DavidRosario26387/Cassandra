import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ScreenPage from "./pages/ScreenPage";
import WeightLabPage from "./pages/WeightLabPage";
import AboutPage from "./pages/AboutPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ScreenPage />} />
        <Route path="lab" element={<WeightLabPage />} />
        <Route path="about" element={<AboutPage />} />
      </Route>
    </Routes>
  );
}
