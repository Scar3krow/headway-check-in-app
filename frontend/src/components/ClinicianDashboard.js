import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/buttons.css"; // Button-specific styles
import "../styles/searchdropdown.css"; // Specific for search dropdown
import { API_URL } from "../config";

const ClinicianDashboard = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [clientOptions, setClientOptions] = useState([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // 🔥 **Detect if Logged-in User is an Admin**
        const role = localStorage.getItem("role");
        setIsAdmin(role === "admin");
    }, []);

    const handleSearchChange = async (e) => {
        const query = e.target.value.trim().toLowerCase();
        setSearchQuery(query);

        if (query.length < 2) {
            setClientOptions([]);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            // ✅ Admins Search All Clients, Clinicians Only Search Their Own
            const searchUrl = isAdmin
                ? `${API_URL}/search-all-clients?query=${query}`
                : `${API_URL}/search-clients?query=${query}`;

            const response = await fetch(searchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Device-Token": deviceToken, // 🔐 Secure API Request
                },
            });

            if (!response.ok) throw new Error("Failed to fetch client options");

            const data = await response.json();
            setClientOptions(data.clients);
        } catch (error) {
            console.error("Error fetching client options:", error);
        }
    };

    const handleSearchSubmit = () => {
        navigate(`/search-results?query=${searchQuery}`);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault(); // Prevent form submission
            handleSearchSubmit();
        }
    };

    const handleClientSelect = (clientId) => {
        navigate(`/client-results/${clientId}`);
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            await fetch(`${API_URL}/logout-device`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ device_token: deviceToken }),
            });

            localStorage.removeItem("token");
            localStorage.removeItem("device_token");
            navigate("/login");
        } catch (error) {
            console.error("Error logging out:", error);
        }
    };

    const handleSwitchToAdmin = () => {
        navigate("/admin-dashboard"); // ✅ Toggle Back to Admin Dashboard
    };

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">
                {isAdmin ? "Clinician View (Admin)" : "Clinician Dashboard"}
            </h2>
            <div className="client-dashboard-content">
                <div className="search-section">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Search for a client by name..."
                        className="search-input styled-textbox"
                    />
                    {clientOptions.length > 0 ? (
                        <ul className="dropdown-menu">
                            {clientOptions.map((client) => (
                                <li
                                    key={client.id}
                                    onClick={() => handleClientSelect(client.id)}
                                    className="dropdown-item"
                                >
                                    {`${client.first_name} ${client.last_name}`}
                                </li>
                            ))}
                        </ul>
                    ) : searchQuery.length >= 2 ? (
                        <p className="no-results">No matches found</p>
                    ) : null}
                    <div className="search-container">
                        <div className="form-actions">
                            <button
                                onClick={handleSearchSubmit}
                                className="dashboard-button primary"
                            >
                                Search
                            </button>
                            <button
                                onClick={handleLogout}
                                className="dashboard-button secondary logout-button"
                            >
                                Logout
                            </button>
                            {/* 🔥 Only Show "Switch to Admin View" for Admins */}
                            {isAdmin && (
                                <button
                                    onClick={handleSwitchToAdmin}
                                    className="dashboard-button info"
                                >
                                    Admin View
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClinicianDashboard;
