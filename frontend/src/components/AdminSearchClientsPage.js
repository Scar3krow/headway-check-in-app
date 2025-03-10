import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

// Helper functions to format metric and time in the title.
const formatMetric = (metric) => {
  const m = metric || "total_clients";
  return m
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatTime = (time) => {
  const t = time || "all";
  if (t === "all") return "All";
  if (t === "6months") return "Past 6 Months";
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const AdminSearchClientsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlParams = new URLSearchParams(location.search);

  // Initialize filter state from URL or default values.
  const [clinicianFilter, setClinicianFilter] = useState(urlParams.get("clinician_id") || "");
  const [metricFilter, setMetricFilter] = useState(urlParams.get("metric") || "total_clients");
  const [timeFilter, setTimeFilter] = useState(urlParams.get("time") || "all");
  const [query, setQuery] = useState(urlParams.get("query") || "");
  const [page, setPage] = useState(parseInt(urlParams.get("page") || "1", 10));

  // Separate state for the query that was last submitted.
  const [submittedQuery, setSubmittedQuery] = useState(query);

  // State to hold the full clinician list.
  const [clinicians, setClinicians] = useState([]);

  // allResults holds the full list from the API; searchResults holds only the current page (20 clients)
  const [allResults, setAllResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch the list of clinicians to populate the Clinician drop-down.
  useEffect(() => {
    const fetchClinicians = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/get-clinicians`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const list = data.clinicians || [];
        setClinicians(list);
        // If no clinicianFilter is set yet, choose blank ("all clinicians")
        if (clinicianFilter === "" && list.length > 0) {
          // Do nothing: blank value means "all clinicians"
        }
      } catch (error) {
        console.error("Error fetching clinicians:", error);
      }
    };
    fetchClinicians();
  }, [clinicianFilter]);

  // Update URL for bookmarking/sharing whenever search params change.
  const updateURL = (q, p) => {
    const params = new URLSearchParams();
    params.set("clinician_id", clinicianFilter);
    params.set("query", q);
    params.set("metric", metricFilter);
    params.set("time", timeFilter);
    params.set("page", p);
    navigate(`/admin-search-clients?${params.toString()}`, { replace: true });
  };

  // Function to fetch search results using the submitted query.
  const fetchSearchResults = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Build URL for admin search with current filter values.
      const searchUrl = `${API_URL}/admin-search-clients?clinician_id=${clinicianFilter}&query=${encodeURIComponent(
        submittedQuery
      )}&metric=${metricFilter}&time=${timeFilter}`;
      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch search results");
      const data = await response.json();
      const clients = data.clients || [];
      setAllResults(clients);
      // Reset to first page on new search.
      setPage(1);
    } catch (error) {
      console.error("Error fetching admin search results:", error);
      setErrorMessage("Error fetching results. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update URL when filters or pagination change.
  useEffect(() => {
    updateURL(submittedQuery, page);
  }, [submittedQuery, clinicianFilter, metricFilter, timeFilter, page]);

  // Update displayed searchResults based on allResults and current page.
  useEffect(() => {
    const startIndex = (page - 1) * 20;
    const endIndex = page * 20;
    setSearchResults(allResults.slice(startIndex, endIndex));
    updateURL(submittedQuery, page);
  }, [allResults, page, submittedQuery]);

  // Handle search form submission: update submittedQuery and fetch results.
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSubmittedQuery(query);
    fetchSearchResults();
  };

  const handleClientSelect = (client) => {
    const sourceParam = client.is_archived ? "archived" : "active";
    navigate(`/client-results/${client.id}?source=${sourceParam}`);
  };

  const handleNextPage = () => {
    if (page * 20 < allResults.length) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((prevPage) => prevPage - 1);
  };

  // Navigate back.
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="client-dashboard-container">
      <h2 className="client-dashboard-title">
        Clients for Clinician{" "}
        {
          // If a clinician is selected, display its name; otherwise, "All Clinicians"
          (clinicians.find((c) => c.id === clinicianFilter) || {}).name || (clinicianFilter || "All Clinicians")
        }
        <br />
        Metric: {formatMetric(metricFilter)}
        <br />
        Time: {formatTime(timeFilter)}
      </h2>
      <form onSubmit={handleSearchSubmit} className="search-form">
        <input
          type="text"
          placeholder="Enter client name or keyword..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input"
        />

        <div className="filter-group">
          <label htmlFor="clinician-select">Clinician:</label>
          <select
            id="clinician-select"
            value={clinicianFilter}
            onChange={(e) => setClinicianFilter(e.target.value)}
            className="filter-select"
          >
            {/* Blank option to indicate "all clinicians" */}
            <option value="">-- All Clinicians --</option>
            {clinicians.map((clinician) => (
              <option key={clinician.id} value={clinician.id}>
                {clinician.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="metric-select">Metric:</label>
          <select
            id="metric-select"
            value={metricFilter}
            onChange={(e) =>
              // If blank, default to "total_clients"
              setMetricFilter(e.target.value || "total_clients")
            }
            className="filter-select"
          >
            <option value="">-- No Filter --</option>
            <option value="total_clients">Total Clients</option>
            <option value="improved">Improved</option>
            <option value="clinically_significant">Clinically Significant</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="time-select">Time:</label>
          <select
            id="time-select"
            value={timeFilter}
            onChange={(e) =>
              // If blank, default to "all"
              setTimeFilter(e.target.value || "all")
            }
            className="filter-select"
          >
            <option value="">-- No Filter --</option>
            <option value="all">All</option>
            <option value="6months">Past 6 Months</option>
          </select>
        </div>

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
              <span>Page {page}</span>
              <button
                onClick={handleNextPage}
                disabled={page * 20 >= allResults.length}
                className="dashboard-button secondary"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <p className="error-message">{errorMessage || "No results found."}</p>
        )}
        <div className="form-actions">
          <button onClick={handleBack} className="dashboard-button secondary">
            Back to Search Results
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSearchClientsPage;
