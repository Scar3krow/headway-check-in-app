import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/buttons.css"; // Button-specific styles
import "../styles/searchdropdown.css"; // Specific for search dropdown

const ClinicianDashboard = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [clientOptions, setClientOptions] = useState([]);
    const navigate = useNavigate();

    const handleSearchChange = async (e) => {
        const query = e.target.value.trim().toLowerCase();
        setSearchQuery(query);

        if (query.length < 2) {
            setClientOptions([]);
            return;
        }

        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `http://127.0.0.1:5000/search-clients?query=${query}`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

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

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">Clinician Dashboard</h2>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClinicianDashboard;
