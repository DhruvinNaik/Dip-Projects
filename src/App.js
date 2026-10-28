import "./App.css";
import { Routes, Route } from "react-router-dom";


import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import HRPortal from "./pages/HRPortal";
import ClientPortal from "./pages/ClientPortal";
import AdminPortal from "./pages/AdminPortal";
import OfficePortal from "./pages/OfficePortal";
import MDOPortal from "./pages/MDOPortal";
import EmployeeForm from "./pages/EmployeeForm";
import ProjectHeadPortal from "./pages/ProjectHeadPortal";
import ApplyLeave from "./pages/ApplyLeave";
import MyLeaves from "./pages/MyLeaves";
import LeaveApprovals from "./pages/LeaveApprovals";
import ManpowerReport from "./pages/Manpowerreport";
//import SitePortal from "./pages/SitePortal_disabled.jsx";
import SitePortal from "./pages/SitePortal";
import QrAttendance from "./pages/QrAttendance";
import OwnerPortal from "./pages/OwnerPortal";
import DatabaseGate from "./components/DatabaseGate";

function App() {
  return (
    <DatabaseGate>
    <Routes>

      <Route path="/" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/hr" element={<HRPortal />} />
      <Route path="/client" element={<ClientPortal />} />
      <Route path="/admin" element={<AdminPortal />} />
      <Route path="/office" element={<OfficePortal />} />
      <Route path="/site" element={<SitePortal />} />
      <Route path="/site/qr-scan" element={<QrAttendance />} />

      <Route path="/mdo" element={<MDOPortal />} />
      <Route path="/owner" element={<OwnerPortal />} />
      <Route path="/head" element={<ProjectHeadPortal/>} />
      <Route path="/employees" element={<EmployeeForm/>} />
      <Route path="/apply-leave" element={<ApplyLeave />}/>
      <Route path="/my-leaves" element={<MyLeaves />}/>
      <Route path="/leave-approvals" element={<LeaveApprovals />}/>
      <Route path="/manpower-report" element={<ManpowerReport/>}/>
    </Routes>
    </DatabaseGate>
  );
}

export default App;
