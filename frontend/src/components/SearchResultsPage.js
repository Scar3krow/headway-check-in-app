import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const SearchResultsPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const urlParams = new URLSearchParams(location.search);
    
    // Initialize state from URL if available.
    const [query, setQuery] = useState(urlParams.get("query") || "");
    const [filter, setFilter] = useState(urlParams.get("filter") || "non_archived"); // default filter
    const [page, setPage] = useState(parseInt(urlParams.get("page") || "1", 10));
    
    // allResults holds the full list from the API; searchResults holds only the current page (20 clients)
    const [allResults, setAllResults] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Update URL for bookmarking/sharing whenever search params change.
    const updateURL = (q, f, p) => {
        const params = new URLSearchParams();
        if (q) params.set("query", q);
        params.set("filter", f);
        params.set("page", p);
        navigate(`/search-results?${params.toString()}`, { replace: true });
    };

    // Fetch full search results when query or filter changes.
    useEffect(() => {
        updateURL(query, filter, page);
        
        // Only fetch when a query is provided.
        if (!query) {
            setAllResults([]);
            setSearchResults([]);
            return;
        }
        
        const fetchSearchResults = async () => {
            setIsLoading(true);
            try {
                const token = localStorage.getItem("token");
                const role = localStorage.getItem("role");

                // Build search URL. (Backend may ignore page/limit, so we fetch all.)
                const baseEndpoint = role === "admin"
                    ? `${API_URL}/search-all-clients`
                    : `${API_URL}/search-clients`;
                const searchUrl = `${baseEndpoint}?query=${encodeURIComponent(query)}&filter=${filter}`;
                const response = await fetch(searchUrl, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) throw new Error("Failed to fetch search results");

                const data = await response.json();
                // Assume API returns { clients: [...] } with an "is_archived" flag on each client.
                const clients = data.clients || [];
                setAllResults(clients);
                // Reset to first page on new search.
                setPage(1);
            } catch (error) {
                console.error("Error fetching search results:", error);
                setErrorMessage("Error fetching search results. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchSearchResults();
    }, [query, filter, navigate]);

    // Update the displayed searchResults based on allResults and current page.
    useEffect(() => {
        const startIndex = (page - 1) * 20;
        const endIndex = page * 20;
        setSearchResults(allResults.slice(startIndex, endIndex));
        updateURL(query, filter, page);
    }, [allResults, page, query, filter]);

    // Updated handler: pass the full client object so we can read is_archived.
    const handleClientSelect = (client) => {
        const sourceParam = client.is_archived ? "archived" : "active";
        navigate(`/client-results/${client.id}?source=${sourceParam}`);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        // The query/filter change triggers fetch.
    };

    const handleNextPage = () => {
        if (page * 20 < allResults.length) {
            setPage((prevPage) => prevPage + 1);
        }
    };

    const handlePrevPage = () => {
        if (page > 1) setPage((prevPage) => prevPage - 1);
    };

    const handleBack = () => {
        navigate("/clinician-dashboard");
    };

    // Calculate total pages based on 20 items per page.
    const totalPages = Math.ceil(allResults.length / 20);

    return (
        <div className="client-dashboard-container">
            <h2 className="client-dashboard-title">Search Results</h2>
            {/* Advanced Search Form */}
            <form onSubmit={handleSearchSubmit} className="search-form">
                <input
                    type="text"
                    placeholder="Enter client name or keyword..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="search-input"
                />
                <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="search-select"
                >
                    <option value="non_archived">Non-Archived</option>
                    <option value="archived">Archived</option>
                    <option value="all">All Clients</option>
                </select>
                <button type="submit" className="dashboard-button primary">
                    Search
                </button>
            </form>

            <div className="client-dashboard-content">
                {isLoading ? (
                    <LoadingMessage text="Searching for clients..." />
                ) : searchResults.length > 0 ? (
                    <>
                        <ul className="search-results-list">
                            {searchResults.map((client) => (
                                <li
                                    key={client.id}
                                    onClick={() => handleClientSelect(client)}
                                    className="search-result-item"
                                >
                                    {`${client.first_name} ${client.last_name}`}
                                    {client.is_archived && <span> (Archived)</span>}
                                </li>
                            ))}
                        </ul>
                        <div className="pagination-controls">
                            <button
                                onClick={handlePrevPage}
                                disabled={page <= 1}
                                className="dashboard-button secondary"
                            >
                                Previous
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={page * 20 >= allResults.length}
                                className="dashboard-button secondary"
                            >
                                Next
                            </button>
                            <span>Page {page} of {totalPages}</span>
                        </div>
                    </>
                ) : (
                    // Show "No results found" only if a search query was submitted.
                    query ? <p className="error-message">{errorMessage || "No results found."}</p> : null
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
