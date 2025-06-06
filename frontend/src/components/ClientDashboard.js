import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/buttons.css";
import "../styles/table.css";
import { API_URL } from "../config";

const ClientDashboard = () => {
    const navigate = useNavigate();

    const handleNavigateToCheckIn = () => {
        navigate("/questionnaire"); // ✅ Redirect to the new questionnaire page
    };

    const handleNavigateToResponses = () => {
        navigate("/client-responses");
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            if (token && deviceToken) {
                await fetch(`${API_URL}/logout-device`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                    body: JSON.stringify({ device_token: deviceToken }),
                });
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
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">Client Dashboard</h2>
            <div className="client-dashboard-content">
                <div className="client-dashboard-buttons">
                    <button
                        onClick={handleNavigateToCheckIn}
                        className="dashboard-button primary"
                    >
                        Start Check-In
                    </button>
                    <button
                        onClick={handleNavigateToResponses}
                        className="dashboard-button info"
                    >
                        View Past Responses
                    </button>
                    <button onClick={handleLogout} className="dashboard-button secondary">
                        Logout
                    </button>
                </div>

                {/* Disclaimer Below the Buttons */}
                <div className="disclaimer">
                    <p>
                        Disclaimer: Please note that this questionnaire is intended to be completed just prior to or during your appointment with your psychologist, and that responses are not monitored in real time. If you are experiencing a crisis or have any safety concerns, please take immediate action by calling Lifeline (13 11 14), Beyond Blue (1300 22 4636) or dial 000.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ClientDashboard;
