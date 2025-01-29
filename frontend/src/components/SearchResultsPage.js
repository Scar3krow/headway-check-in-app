import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles

const SearchResultsPage = () => {
    const [searchResults, setSearchResults] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();
    const location = useLocation();

    const query = new URLSearchParams(location.search).get("query");

    useEffect(() => {
        const fetchSearchResults = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch(
                    `http://127.0.0.1:5000/search-clients?query=${query}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!response.ok) throw new Error("Failed to fetch search results");

                const data = await response.json();
                setSearchResults(data.clients);
            } catch (error) {
                console.error("Error fetching search results:", error);
                setErrorMessage("Error fetching search results. Please try again later.");
            }
        };

        if (query) {
            fetchSearchResults();
        }
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
