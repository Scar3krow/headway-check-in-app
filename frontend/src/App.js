import React, { useEffect, useState } from 'react'; 
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, useNavigate } from 'react-router-dom'; 
import Register from './components/Register'; 
import Login from './components/Login';
import Home from './components/Home';
import Logout from './components/Logout';
import Navbar from './components/Navbar';
import ClientDashboard from './components/ClientDashboard';
import ClinicianDashboard from './components/ClinicianDashboard';
import Form from './components/Form';
import ClientResponsesPage from './components/ClientResponsesPage'; 
import SearchResultsPage from "./components/SearchResultsPage";
import ClientResultsPage from "./components/ClientResultsPage";
import SessionDetailsPage from "./components/SessionDetailsPage";
import ClientSessionDetailsPage from "./components/ClientSessionDetailsPage";
import AdminDashboard from "./components/AdminDashboard";
import Unauthorized from "./components/Unauthorized";
import RemoveUserPage from "./components/RemoveUserPage";
import ClinicianDataPage from "./components/ClinicianDataPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import './styles/global.css';

// 🔐 **Protected Route Component**
const ProtectedRoute = ({ element, roleRequired }) => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    // ✅ Admins can access all Clinician pages
    const allowedRoles = Array.isArray(roleRequired) ? roleRequired : [roleRequired];
    if (role === "admin" && allowedRoles.includes("clinician")) {
        return element;
    }

    // ❌ Restrict access if role is not permitted
    if (!allowedRoles.includes(role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return element;
};

// **Component to Handle Storing & Redirecting Last Visited Page**
const RouteHandler = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (!["/login", "/logout"].includes(location.pathname)) {
            console.log("🔹 Storing last visited page:", location.pathname);
            localStorage.setItem("lastVisitedPage", location.pathname);
        }
    }, [location.pathname]); 

    useEffect(() => {
        if (!initialized) {
            const lastPage = localStorage.getItem("lastVisitedPage");
            console.log("🔍 Retrieved last visited page:", lastPage);
            console.log("🔍 Current window location:", window.location.pathname);

            if (lastPage && (window.location.pathname === "/" || window.location.pathname === "/index")) {
                console.log("🚀 Redirecting to last visited page:", lastPage);
                navigate(lastPage, { replace: true });
            }

            setInitialized(true); // ✅ Prevents infinite loops
        }
    }, [initialized, navigate]); // ✅ Dependencies to avoid infinite rerenders

    return null;
};

function App() {
    return (
        <Router>
            <RouteHandler /> {/* ✅ Ensures last visited page logic runs */}
            <div>
                <Navbar />
                <Routes>
                    {/* 🟢 Public Routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="*" element={<Home />} /> 
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />

                    {/* 🔐 **Protected Routes by Role** */}
                    
                    {/* Clients Only */}
                    <Route path="/client-dashboard" element={<ProtectedRoute element={<ClientDashboard />} roleRequired="client" />} />
                    <Route path="/client-responses" element={<ProtectedRoute element={<ClientResponsesPage />} roleRequired="client" />} />
                    <Route path="/session-details/:sessionId" element={<ProtectedRoute element={<SessionDetailsPage />} roleRequired={["client", "clinician", "admin"]} />} />

                    {/* Clinicians Only (Admins included) */}
                    <Route path="/clinician-dashboard" element={<ProtectedRoute element={<ClinicianDashboard />} roleRequired={["clinician", "admin"]} />} />
                    <Route path="/client-results/:userId" element={<ProtectedRoute element={<ClientResultsPage />} roleRequired={["clinician", "admin"]} />} />
                    <Route path="/client-session-details/:sessionId" element={<ProtectedRoute element={<ClientSessionDetailsPage />} roleRequired={["client", "clinician", "admin"]} />} />

                    {/* Admins Only */}
                    <Route path="/clinician-data" element={<ProtectedRoute element={<ClinicianDataPage />} roleRequired="admin" />} />
                    <Route path="/admin-dashboard" element={<ProtectedRoute element={<AdminDashboard />} roleRequired="admin" />} />
                    <Route path="/remove-user" element={<ProtectedRoute element={<RemoveUserPage />} roleRequired="admin" />} />

                    {/* Mixed Roles (Accessible by Multiple Roles) */}
                    <Route path="/forms" element={<ProtectedRoute element={<Form />} roleRequired={["client", "clinician", "admin"]} />} />
                    <Route path="/search-results" element={<ProtectedRoute element={<SearchResultsPage />} roleRequired={["clinician", "admin"]} />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
