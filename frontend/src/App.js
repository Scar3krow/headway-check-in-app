import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import Home from './components/Home';
import Logout from './components/Logout';
import Navbar from './components/Navbar';
import ClientDashboard from './components/ClientDashboard';
import ClinicianDashboard from './components/ClinicianDashboard';
import ClientDataPage from './components/ClientDataPage';
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

// Protected Route Component
const ProtectedRoute = ({ element, roleRequired }) => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (roleRequired && role !== roleRequired) {
        return <Navigate to="/" replace />;
    }

    return element;
};

function App() {
    return (
        <Router>
            <div>
                <Navbar />
                <Routes>
                    {/* Ensure React Router uses "*" to catch all routes */}
                    <Route path="/" element={<Home />} />
                    <Route path="*" element={<Home />} /> 

                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/logout" element={<Logout />} />
                    <Route
                        path="/client-dashboard"
                        element={<ProtectedRoute element={<ClientDashboard />} roleRequired="client" />}
                    />
                    <Route
                        path="/clinician-dashboard"
                        element={<ProtectedRoute element={<ClinicianDashboard />} roleRequired="clinician" />}
                    />
                    <Route
                        path="/client-responses"
                        element={<ProtectedRoute element={<ClientResponsesPage />} roleRequired="client" />}
                    />
                    <Route path="/forms" element={<Form />} />
                    <Route path="/client/:userId" element={<ClientDataPage />} />
                    <Route path="/search-results" element={<SearchResultsPage />} />
                    <Route path="/client-results/:userId" element={<ClientResultsPage />} />
                    <Route path="/session-details/:sessionId" element={<SessionDetailsPage />} />
                    <Route 
                        path="/client-session-details" 
                        element={<ProtectedRoute element={<ClientSessionDetailsPage />} roleRequired="client" />}
                    />
                    <Route path="/admin-dashboard" element={<AdminDashboard />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />;
                    <Route path="/remove-clinician" element={<RemoveClinicianPage />} />
                    <Route path="/clinician-data" element={<ClinicianDataPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/remove-admin" element={<ProtectedRoute element={<RemoveAdminPage />} roleRequired="admin" />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;