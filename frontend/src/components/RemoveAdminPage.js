import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RemoveAdminPage = () => {
    const [admins, setAdmins] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_URL}/get-admins`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data && Array.isArray(response.data.admins)) {
                setAdmins(response.data.admins);
            } else {
                console.error("Unexpected data structure from /get-admins:", response.data);
                setAdmins([]);
            }
        } catch (error) {
            console.error("Error fetching admins:", error);
            setError("Failed to fetch admins. Please try again.");
        }
    };

    const handleRemoveAdmin = async () => {
        setError("");
        setSuccessMessage("");

        if (!selectedAdminId) {
            setError("Please select an admin to remove.");
            return;
        }

        try {
            const token = localStorage.getItem("token");

            // ✅ Request admin removal from backend
            await axios.post(
                `${API_URL}/remove-admin`,
                { admin_id: selectedAdminId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // ✅ Log out removed admin from all devices
            await axios.post(
                `${API_URL}/logout-all`,
                { user_id: selectedAdminId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccessMessage("Admin removed successfully.");
            setAdmins(admins.filter((admin) => admin.id !== selectedAdminId));
            setSelectedAdminId(""); // Reset dropdown
        } catch (error) {
            console.error("Error removing admin:", error);
            setError("Failed to remove admin. Please try again.");
        }
    };

    const handleBack = () => {
        navigate("/admin-dashboard");
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Remove Admin</h2>
            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}
            <form className="form-content">
                <div className="form-group">
                    <label>Choose an Admin to Remove:</label>
                    <select
                        name="admin"
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        className="form-select"
                    >
                        <option value="" disabled>
                            Select an admin
                        </option>
                        {admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                                {admin.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-actions">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="dashboard-button secondary"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleRemoveAdmin}
                        className="dashboard-button danger"
                    >
                        Confirm Remove
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RemoveAdminPage;
