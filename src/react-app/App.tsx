import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import ProtectedRoute from "@/react-app/components/ProtectedRoute";

// Eager load Login page (needed immediately)
import Login from "@/react-app/pages/Login";

// Lazy load all dashboard pages (loaded only when needed)
const AdminDashboard = lazy(() => import("@/react-app/pages/AdminDashboard"));
const AccountManagerDashboard = lazy(() => import("@/react-app/pages/AccountManagerDashboard"));
const RecruitmentManagerDashboard = lazy(() => import("@/react-app/pages/RecruitmentManagerDashboard"));
const RecruiterDashboard = lazy(() => import("@/react-app/pages/RecruiterDashboard"));
const SuperAdminLayout = lazy(() => import("@/react-app/components/super-admin/SuperAdminLayout"));
const SuperAdminHome = lazy(() => import("@/react-app/components/super-admin/SuperAdminHome"));
const CompaniesManagement = lazy(() => import("@/react-app/components/super-admin/CompaniesManagement"));
const AllUsersManagement = lazy(() => import("@/react-app/components/super-admin/AllUsersManagement"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<SuperAdminHome />} />
            <Route path="companies" element={<CompaniesManagement />} />
            <Route path="users" element={<AllUsersManagement />} />
          </Route>
          
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/am/*"
            element={
              <ProtectedRoute allowedRoles={['account_manager']}>
                <AccountManagerDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/rm/*"
            element={
              <ProtectedRoute allowedRoles={['recruitment_manager']}>
                <RecruitmentManagerDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/recruiter/*"
            element={
              <ProtectedRoute allowedRoles={['recruiter']}>
                <RecruiterDashboard />
              </ProtectedRoute>
            }
          />
          
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
