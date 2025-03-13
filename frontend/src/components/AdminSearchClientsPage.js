import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/loading.css";
import "../styles/adminsearchclients.css";
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

  // Initialize state from URL or default values.
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
      } catch (error) {
        console.error("Error fetching clinicians:", error);
      }
    };
    fetchClinicians();
  }, []);

  // Restore search state from sessionStorage on mount.
  useEffect(() => {
    const savedState = sessionStorage.getItem("adminSearchResults");
    if (savedState) {
      const parsed = JSON.parse(savedState);
      setQuery(parsed.query);
      setSubmittedQuery(parsed.query);
      setPage(parsed.page);
      setAllResults(parsed.allResults);
      // Optionally, also restore metricFilter and timeFilter:
      if (parsed.metricFilter) setMetricFilter(parsed.metricFilter);
      if (parsed.timeFilter) setTimeFilter(parsed.timeFilter);
      sessionStorage.removeItem("adminSearchResults");
    } else if (query) {
      fetchSearchResults();
    } else {
      setAllResults([]);
      setSearchResults([]);
    }
    updateURL(submittedQuery, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update URL when filters or pagination change.
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
      // Filter out any users that are not clients.
      const filteredClients = clients.filter(client => {
        const role = client.role ? client.role.toLowerCase() : "client";
        return role === "client";
      });
      setAllResults(filteredClients);
      // Reset to first page on new search.
      setPage(1);
    } catch (error) {
      console.error("Error fetching admin search results:", error);
      setErrorMessage("Error fetching results. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update displayed searchResults based on allResults and current page.
  useEffect(() => {
    const startIndex = (page - 1) * 20;
    const endIndex = page * 20;
    setSearchResults(allResults.slice(startIndex, endIndex));
    updateURL(submittedQuery, page);
  }, [allResults, page, submittedQuery, clinicianFilter, metricFilter, timeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSubmittedQuery(query);
    fetchSearchResults();
  };

  const handleClientSelect = (client) => {
    const sourceParam = client.is_archived ? "archived" : "active";
    navigate(`/client-results/${client.user_id}?source=${sourceParam}`);
  };

  const handleNextPage = () => {
    if (page * 20 < allResults.length) {
      setPage((prevPage) => prevPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((prevPage) => prevPage - 1);
  };

  // Save current state and go back.
  const handleBack = () => {
    const savedState = {
      query,
      metricFilter,
      timeFilter,
      page,
      allResults
    };
    sessionStorage.setItem("adminSearchResults", JSON.stringify(savedState));
    navigate(-1);
  };

  const totalPages = Math.ceil(allResults.length / 20);

  return (
    <div className="client-dashboard-container">
      <div className="admin-search-title-container">
        <h1 className="main-title">
          Clients for Clinician:{" "}
          {(clinicians.find((c) => c.id === clinicianFilter) || {}).name ||
            (clinicianFilter || "All Clinicians")}
        </h1>
        <p className="sub-title">
          <span className="category">Metric:</span> {formatMetric(metricFilter)}
        </p>
        <p className="sub-title">
          <span className="category">Time:</span> {formatTime(timeFilter)}
        </p>
      </div>
      <form onSubmit={handleSearchSubmit} className="admin-search-form">
        {/* Search input moved above the filters */}
        <input
          type="text"
          placeholder="Enter client name or keyword..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search-input admin-search-input"
        />

        <div className="admin-filter-row">
          <div className="filter-group">
            <label htmlFor="clinician-select">Clinician:</label>
            <select
              id="clinician-select"
              value={clinicianFilter}
              onChange={(e) => setClinicianFilter(e.target.value)}
              className="filter-select admin-filter-select"
            >
              <option value="">-- All Clinicians --</option>
              {clinicians.map((clinician) => (
                <option key={clinician.id} value={clinician.id}>
                  {clinician.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="metric-select">Clinical Change:</label>
            <select
              id="metric-select"
              value={metricFilter}
              onChange={(e) =>
                setMetricFilter(e.target.value || "total_clients")
              }
              className="filter-select admin-filter-select"
            >
              <option value="total_clients">All Levels of Change</option>
              <option value="improved">Improved</option>
              <option value="clinically_significant">
                Clinically Significant Improvement
              </option>
              <option value="not-improving">Not Improving</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="time-select">Time:</label>
            <select
              id="time-select"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value || "all")}
              className="filter-select admin-filter-select"
            >
              <option value="all">All</option>
              <option value="6months">Past 6 Months</option>
            </select>
          </div>
        </div>

        <button type="submit" className="dashboard-button primary admin-search-button">
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
            <div className="admin-pagination-controls">
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
              <span>
                Page {page} of {totalPages}
              </span>
            </div>
          </>
        ) : (
          submittedQuery && <p className="error-message">{errorMessage || "No results found."}</p>
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

export default AdminSearchClientsPage;
