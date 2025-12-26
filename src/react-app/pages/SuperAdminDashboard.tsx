import { Route, Routes } from 'react-router';
import SuperAdminHome from '@/react-app/components/super-admin/SuperAdminHome';
import CompaniesManagement from '@/react-app/components/super-admin/CompaniesManagement';
import AllUsersManagement from '@/react-app/components/super-admin/AllUsersManagement';

export default function SuperAdminDashboard() {
  return (
    <Routes>
      <Route path="/" element={<SuperAdminHome />} />
      <Route path="/companies" element={<CompaniesManagement />} />
      <Route path="/users" element={<AllUsersManagement />} />
    </Routes>
  );
}
