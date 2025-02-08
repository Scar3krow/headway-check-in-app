import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles
import { API_URL } from "../config";

const RemoveUserPage = () => {
    const [role, setRole] = useState("clinician"); // Default to "clinician"
    const [users, setUsers] = useState([]); // Stores clinicians or admins
    const [selectedUserId, setSelectedUserId] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, [role]); // Fetch users when role changes

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const endpoint = role === "clinician" ? "/get-clinicians" : "/get-admins";
            
            const response = await axios.get(`${API_URL}${endpoint}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.data && Array.isArray(response.data[role + "s"])) {
                setUsers(response.data[role + "s"]);
            } else {
                console.error(`Unexpected data structure from ${endpoint}:`, response.data);
                setUsers([]);
            }
        } catch (error) {
            console.error(`Error fetching ${role}s:`, error);
            setError(`Failed to fetch ${role}s. Please try again.`);
        }
    };

    const handleRemoveUser = async () => {
        setError("");
        setSuccessMessage("");

        if (!selectedUserId) {
            setError(`Please select a ${role} to remove.`);
            return;
        }

        try {
            const token = localStorage.getItem("token");

            // ✅ Request user removal from backend
            await axios.post(
                `${API_URL}/remove-user`,
                { user_id: selectedUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // ✅ Log out removed user from all devices
            await axios.post(
                `${API_URL}/logout-all`,
                { user_id: selectedUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccessMessage(`${role.charAt(0).toUpperCase() + role.slice(1)} removed successfully.`);
            setUsers(users.filter((user) => user.id !== selectedUserId));
            setSelectedUserId(""); // Reset dropdown
        } catch (error) {
            console.error(`Error removing ${role}:`, error);
            setError(`Failed to remove ${role}. Please try again.`);
        }
    };

    const handleBack = () => {
        navigate("/admin-dashboard");
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Remove User</h2>
            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}
            
            <form className="form-content">
                <div className="form-group">
                    <label>Select Role:</label>
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="form-select"
                    >
                        <option value="clinician">Clinician</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Choose a {role.charAt(0).toUpperCase() + role.slice(1)} to Remove:</label>
                    <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        className="form-select"
                    >
                        <option value="" disabled>Select a {role}</option>
                        {users.map((user) => (
                            <option key={user.id} value={user.id}>
                                {user.name}
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
                        onClick={handleRemoveUser}
                        className="dashboard-button danger"
                    >
                        Confirm Remove
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RemoveUserPage;
