import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/buttons.css";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const AdminDashboard = () => {
    const [clinicianCode, setClinicianCode] = useState("");
    const [adminCode, setAdminCode] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        // Check if the user is an admin
        const role = localStorage.getItem("role");
        if (role !== "admin") {
            navigate("/unauthorized"); // Redirect non-admin users to an "Unauthorized" page
        }
    }, [navigate]);

    const generateCode = async (role) => {
        setError("");
        try {
            const token = localStorage.getItem("token");
            const response = await axios.post(
                `${API_URL}/generate-invite`,  // ✅ Use dynamic API URL
                { role },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (role === "clinician") {
                setClinicianCode(response.data.code);
            } else if (role === "admin") {
                setAdminCode(response.data.code);
            }
        } catch (error) {
            console.error("Error generating invite code:", error);
            setError("Failed to generate invite code. Please try again.");
        }
    };

    const handleBack = () => {
        setClinicianCode("");
        setAdminCode("");
        setError("");
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const navigateToRemoveClinician = () => navigate("/remove-clinician");
    const navigateToRemoveAdmin = () => navigate("/remove-admin");
    const navigateToClinicianData = () => navigate("/clinician-data");

    return (
        <div className="admin-dashboard-container">
            <h2 className="admin-dashboard-title">Admin Dashboard</h2>
            {error && <p className="error-message">{error}</p>}
            <div className="admin-dashboard-content">
                <div className="admin-actions">
                    <button
                        onClick={() => generateCode("clinician")}
                        className="dashboard-button primary"
                    >
                        Generate Clinician Invite Code
                    </button>
                    {clinicianCode && (
                        <p className="invite-code">
                            Clinician Invite Code: <strong>{clinicianCode}</strong>
                        </p>
                    )}
                    <button
                        onClick={() => generateCode("admin")}
                        className="dashboard-button info"
                    >
                        Generate Admin Invite Code
                    </button>
                    {adminCode && (
                        <p className="invite-code">
                            Admin Invite Code: <strong>{adminCode}</strong>
                        </p>
                    )}
                    <button
                        onClick={navigateToRemoveClinician}
                        className="dashboard-button danger"
                    >
                        Remove Clinician
                    </button>
                    <button
                        onClick={navigateToRemoveAdmin}
                        className="dashboard-button danger"
                    >
                        Remove Admin
                    </button>
                    <button
                        onClick={navigateToClinicianData}
                        className="dashboard-button info"
                    >
                        Clinician Data
                    </button>
                </div>
                <div className="button-group">
                    {(clinicianCode || adminCode) && (
                        <button
                            onClick={handleBack}
                            className="dashboard-button tertiary"
                        >
                            Back
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="dashboard-button secondary logout-button"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
