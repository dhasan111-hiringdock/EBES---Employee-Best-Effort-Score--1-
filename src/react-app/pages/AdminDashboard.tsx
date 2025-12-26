import { Routes, Route, Navigate } from "react-router";
import { AdminLayout } from "@/react-app/components/admin/AdminLayout";
import UsersManagement from "@/react-app/components/admin/UsersManagement";
import ClientsManagement from "@/react-app/components/admin/ClientsManagement";
import TeamsManagement from "@/react-app/components/admin/TeamsManagement";
import PerformanceStats from "@/react-app/components/admin/PerformanceStats";
import AdminSettings from "@/react-app/pages/AdminSettings";
import CompanyPage from "@/react-app/pages/CompanyPage";

export default function AdminDashboard() {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/users" replace />} />
        <Route path="/users" element={<UsersManagement />} />
        <Route path="/clients" element={<ClientsManagement />} />
        <Route path="/teams" element={<TeamsManagement />} />
        <Route path="/performance" element={<PerformanceStats />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/settings" element={<AdminSettings />} />
      </Routes>
    </AdminLayout>
  );
}
