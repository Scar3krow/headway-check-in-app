import React, { useEffect } from 'react';
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
import RemoveClinicianPage from "./components/RemoveClinicianPage";
import ClinicianDataPage from "./components/ClinicianDataPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import ResetPasswordPage from "./components/ResetPasswordPage";
import RemoveAdminPage from "./components/RemoveAdminPage";
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

    // Store last visited page (except login/logout pages)
    useEffect(() => {
        if (!["/login", "/logout"].includes(location.pathname)) {
            localStorage.setItem("lastVisitedPage", location.pathname);
        }
    }, [location]);

    // Restore last visited page when reloading
    useEffect(() => {
        const lastPage = localStorage.getItem("lastVisitedPage");
        if (lastPage && window.location.pathname === "/") {
            navigate(lastPage, { replace: true });
        }
    }, [navigate]);

    return null;
};

function App() {
    return (
        <Router>
            <RouteHandler /> {/* Ensures last visited page logic runs */}
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
                    <Route path="/remove-clinician" element={<ProtectedRoute element={<RemoveClinicianPage />} roleRequired="admin" />} />
                    <Route path="/remove-admin" element={<ProtectedRoute element={<RemoveAdminPage />} roleRequired="admin" />} />

                    {/* Mixed Roles (Accessible by Multiple Roles) */}
                    <Route path="/forms" element={<ProtectedRoute element={<Form />} roleRequired={["client", "clinician", "admin"]} />} />
                    <Route path="/search-results" element={<ProtectedRoute element={<SearchResultsPage />} roleRequired={["clinician", "admin"]} />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
