import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import { API_URL } from "../config";

const SearchResultsPage = () => {
    const [searchResults, setSearchResults] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();
    const location = useLocation();
    const query = new URLSearchParams(location.search).get("query");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!query) return;

        const fetchSearchResults = async () => {
            try {
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");

                // ✅ **Admins search all clients, Clinicians only their assigned clients**
                const searchUrl = role === "admin"
                    ? `${API_URL}/search-all-clients?query=${query}`
                    : `${API_URL}/search-clients?query=${query}`;

                const response = await fetch(searchUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) throw new Error("Failed to fetch search results");

                const data = await response.json();
                setSearchResults(data.clients || []);
            } catch (error) {
                console.error("Error fetching search results:", error);
                setErrorMessage("Error fetching search results. Please try again later.");
            } finally {
                setIsLoading(false); // Hide loading
            }
        };

        fetchSearchResults();
    }, [query]);

    const handleClientSelect = (clientId) => {
        navigate(`/client-results/${clientId}`);
    };

    const handleBack = () => {
        navigate("/clinician-dashboard");
    };

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">Search Results</h2>
            <div className="client-dashboard-content">
                {isLoading ? <LoadingMessage text="Searching for clients..." /> : null}
                {searchResults.length > 0 ? (
                    <ul className="search-results-list">
                        {searchResults.map((client) => (
                            <li
                                key={client.id}
                                onClick={() => handleClientSelect(client.id)}
                                className="search-result-item"
                            >
                                {`${client.first_name} ${client.last_name}`}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="error-message">{errorMessage || "No results found."}</p>
                )}
                <div className="form-actions">
                    <button onClick={handleBack} className="dashboard-button secondary">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SearchResultsPage;
