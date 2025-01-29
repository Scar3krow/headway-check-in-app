import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const RemoveAdminPage = () => {
    const [admins, setAdmins] = useState([]);
    const [selectedAdminId, setSelectedAdminId] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAdmins = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get("http://127.0.0.1:5000/get-admins", {
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

        fetchAdmins();
    }, []);

    const handleRemoveAdmin = async () => {
        setError("");
        setSuccessMessage("");

        if (!selectedAdminId) {
            setError("Please select an admin to remove.");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            await axios.post(
                "http://127.0.0.1:5000/remove-admin",
                { admin_id: selectedAdminId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccessMessage("Admin removed successfully.");
            setAdmins(admins.filter((a) => a.id !== selectedAdminId));
            setSelectedAdminId(""); // Reset the dropdown
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
