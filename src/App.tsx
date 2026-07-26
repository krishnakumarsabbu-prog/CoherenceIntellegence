import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAppStore } from "./store/appStore";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAppStore((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route
          path="/pipeline-studio"
          element={
            <PlaceholderPage
              title="Pipeline Studio"
              phase="Phase 2"
              description="A drag-and-drop canvas where you compose fraud-detection pipelines from configurable stages and algorithms."
            />
          }
        />
        <Route
          path="/algorithm-library"
          element={
            <PlaceholderPage
              title="Algorithm Library"
              phase="Phase 3"
              description="Browse, configure, and version the detection algorithms available to drop into your pipelines."
            />
          }
        />
        <Route
          path="/execution-console"
          element={
            <PlaceholderPage
              title="Execution Console"
              phase="Phase 4"
              description="Run pipelines against live or batch data, watch progress in real time, and inspect flagged cases as they surface."
            />
          }
        />
        <Route
          path="/pipeline-comparison"
          element={
            <PlaceholderPage
              title="Pipeline Comparison"
              phase="Phase 5"
              description="Compare the accuracy, throughput, and flagged-case overlap of multiple pipelines side by side."
            />
          }
        />
        <Route
          path="/reports"
          element={
            <PlaceholderPage
              title="Reports"
              phase="Phase 5"
              description="Generate and export audit-ready reports on detection performance and flagged activity."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
