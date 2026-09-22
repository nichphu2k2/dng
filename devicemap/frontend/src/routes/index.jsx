import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "../components/ProtectedRoute";

import Dashboard from "../pages/Dashboard";
import DeviceManagement from "../pages/DeviceManagement";
import Report from "../pages/Report";
import PlaceholderPage from "../pages/PlaceholderPage";
import DeviceTypeManagement from "../pages/DeviceTypeManagement";
import PlaneManagement from "../pages/PlaneManagement";
import MonitorList from "../pages/MonitorList";
import MonitorViewer from "../pages/MonitorViewer";
import AlertSetupSettings from "../pages/AlertSetupSettings";
import LineParametersSettings from "../pages/LineParametersSettings";
import Login from "../pages/Login";
import NoPermission from "../pages/NoPermission";
import UserManagement from "../pages/UserManagement";
import ChangePassword from "../pages/ChangePassword";
import NetworkOptixSettings from "../pages/NetworkOptixSettings";
import AuthSessionManager from "../components/AuthSessionManager";

export default function Router() {
  return (
    <BrowserRouter>
      <AuthSessionManager>
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/no-permission" element={<NoPermission />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />

        {/* Layout group */}
        <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/maps" element={<ProtectedRoute><PlaceholderPage title="Maps" /></ProtectedRoute>} />
          <Route path="/monitor" element={<ProtectedRoute><MonitorList /></ProtectedRoute>} />
          <Route path="/monitor/:id" element={<ProtectedRoute><MonitorViewer /></ProtectedRoute>} />
          <Route path="/devices" element={<ProtectedRoute allowedRoles={["ADMIN", "OPERATOR"]}><DeviceManagement /></ProtectedRoute>} />
          <Route path="/device-types" element={<ProtectedRoute allowedRoles={["ADMIN", "OPERATOR"]}><DeviceTypeManagement /></ProtectedRoute>} />
          <Route path="/planes" element={<ProtectedRoute allowedRoles={["ADMIN", "OPERATOR"]}><PlaneManagement /></ProtectedRoute>} />
          <Route path="/settings/alert-setup" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AlertSetupSettings /></ProtectedRoute>} />
          <Route path="/settings/line-parameters" element={<ProtectedRoute allowedRoles={["ADMIN"]}><LineParametersSettings /></ProtectedRoute>} />
          <Route path="/settings/nx" element={<ProtectedRoute allowedRoles={["ADMIN"]}><NetworkOptixSettings /></ProtectedRoute>} />
          <Route path="/settings/users" element={<ProtectedRoute allowedRoles={["ADMIN"]}><UserManagement /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        </Route>

        </Routes>
      </AuthSessionManager>
    </BrowserRouter>
  );
}