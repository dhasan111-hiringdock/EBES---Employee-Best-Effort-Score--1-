import { Routes, Route, Navigate } from "react-router";
import RecruitmentManagerLayout from "@/react-app/components/recruitment-manager/RecruitmentManagerLayout";
import RMDashboard from "@/react-app/components/recruitment-manager/RMDashboard";
import RMAnalytics from "@/react-app/pages/RMAnalytics";
import RMRoles from "@/react-app/components/recruitment-manager/RMRoles";
import RMTeamManagement from "@/react-app/components/recruitment-manager/RMTeamManagement";
import RMProfile from "@/react-app/components/recruitment-manager/RMProfile";
import CompanyPage from "@/react-app/pages/CompanyPage";
import DropoutRequests from "@/react-app/components/recruitment-manager/DropoutRequests";

export default function RecruitmentManagerDashboard() {
  return (
    <RecruitmentManagerLayout>
      <Routes>
        <Route path="/" element={<RMDashboard />} />
        <Route path="/analytics" element={<RMAnalytics />} />
        <Route path="/roles" element={<RMRoles />} />
        <Route path="/team" element={<RMTeamManagement />} />
        <Route path="/dropouts" element={<DropoutRequests />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/profile" element={<RMProfile />} />
        <Route path="*" element={<Navigate to="/rm" replace />} />
      </Routes>
    </RecruitmentManagerLayout>
  );
}
