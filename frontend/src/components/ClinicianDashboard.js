import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/buttons.css"; // Button-specific styles
import "../styles/searchdropdown.css"; // Specific for search dropdown
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const ClinicianDashboard = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const [clientOptions, setClientOptions] = useState([]);
    const [visibleOptionsCount, setVisibleOptionsCount] = useState(15);
    const [isAdmin, setIsAdmin] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        // 🔥 **Detect if Logged-in User is an Admin**
        const role = localStorage.getItem("role");
        setIsAdmin(role === "admin");
    }, []);

    const [isLoading, setIsLoading] = useState(false);

    const handleSearchChange = async (e) => {
        const inputValue = e.target.value; // use raw input so spaces are preserved
        setSearchQuery(inputValue);
    
        // Use trimmed value only for length check:
        if (inputValue.trim().length < 2) {
            setClientOptions([]);
            return;
        }
    
        setIsLoading(true);
    
        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");
    
            // Lowercase and encode the input value for the query parameter.
            const queryParam = encodeURIComponent(inputValue.toLowerCase());
            const searchUrl = isAdmin
                ? `${API_URL}/search-all-clients?query=${queryParam}`
                : `${API_URL}/search-clients?query=${queryParam}`;
    
            const response = await fetch(searchUrl, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Device-Token": deviceToken,
                },
            });
    
            if (!response.ok) throw new Error("Failed to fetch client options");
    
            const data = await response.json();
            // Expect data.clients to include an "is_archived" flag.
            setClientOptions(data.clients);
            // Reset visible options count when new search occurs.
            setVisibleOptionsCount(15);
        } catch (error) {
            console.error("Error fetching client options:", error);
        } finally {
            setIsLoading(false);
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

    // Update the handler to receive the entire client object.
    const handleClientSelect = (client) => {
        // Pass along the archival status via the source query parameter.
        const sourceParam = client.is_archived ? "archived" : "active";
        navigate(`/client-results/${client.id}?source=${sourceParam}`);
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

    // New scroll handler for the dropdown.
    const handleDropdownScroll = () => {
        const container = dropdownRef.current;
        if (container) {
            // When scrolled near the bottom (5px threshold), load more options.
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
                setVisibleOptionsCount((prev) =>
                    Math.min(prev + 15, clientOptions.length)
                );
            }
        }
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
                    {isLoading ? (
                        <LoadingMessage text="Searching..." />
                    ) : clientOptions.length > 0 ? (
                        <ul
                            className="dropdown-menu"
                            ref={dropdownRef}
                            onScroll={handleDropdownScroll}
                        >
                            {clientOptions.slice(0, visibleOptionsCount).map((client) => (
                                <li
                                    key={client.id}
                                    onClick={() => handleClientSelect(client)}
                                    className="dropdown-item"
                                >
                                    {`${client.first_name} ${client.last_name}`}{" "}
                                    {client.is_archived && <span>(Archived)</span>}
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
                            <button
                                onClick={() => navigate('/search-results')}
                                className="dashboard-button primary"
                            >
                                Advanced Search
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClinicianDashboard;
