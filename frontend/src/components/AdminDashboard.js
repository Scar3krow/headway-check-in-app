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
    const [isClinicianView, setIsClinicianView] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const role = localStorage.getItem("role");
        if (role !== "admin") {
            navigate("/unauthorized"); 
        }
    }, [navigate]);

    const generateCode = async (role) => {
        setError("");
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token"); 

            const response = await axios.post(
                `${API_URL}/generate-invite`,
                { role },
                {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken, 
                    },
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

    const handleToggleView = () => {
        setIsClinicianView(!isClinicianView);

        // **Redirect Immediately After Toggle**
        if (!isClinicianView) {
            navigate("/clinician-dashboard"); // ✅ Switch to Clinician View
        } else {
            navigate("/admin-dashboard"); // ✅ Switch Back to Admin View
        }
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            if (token && deviceToken) {
                await axios.post(
                    `${API_URL}/logout-device`, // Logout specific device
                    { device_token: deviceToken },
                    {
                        headers: { 
                            Authorization: `Bearer ${token}`,
                            "Device-Token": deviceToken,
                        },
                    }
                );
            }
        } catch (error) {
            console.error("Error logging out:", error);
        }

        // ✅ Clear all stored session data
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("user_id");
        localStorage.removeItem("device_token");

        navigate("/login"); // Redirect to login
    };

    return (
        <div className="admin-dashboard-container">
            <h2 className="admin-dashboard-title">
                {isClinicianView ? "Clinician View" : "Admin Dashboard"}
            </h2>

            {error && <p className="error-message">{error}</p>}

            <div className="admin-dashboard-content">
                {/* 🔄 Toggle Between Admin & Clinician View */}
                <button onClick={handleToggleView} className="dashboard-button info">
                    {isClinicianView ? "Switch to Admin View" : "Switch to Clinician View"}
                </button>

                {/* 🔥 Clinician View */}
                {isClinicianView ? (
                    <>
                        <button
                            onClick={() => navigate("/clinician-dashboard")}
                            className="dashboard-button primary"
                        >
                            Clinician View
                        </button>
                    </>
                ) : (
                    <>
                        {/* 🔥 Admin View */}
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
                            onClick={() => navigate("/clinician-data")}
                            className="dashboard-button info"
                        >
                            View Clinician Data
                        </button>
                        <button
                            onClick={() => navigate("/remove-user")}
                            className="dashboard-button danger"
                        >
                            Remove User
                        </button>
                    </>
                )}

                <button onClick={handleLogout} className="dashboard-button secondary logout-button">
                    Logout
                </button>
            </div>
        </div>
    );
};

export default AdminDashboard;
