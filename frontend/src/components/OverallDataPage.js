import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import LoadingMessage from '../components/LoadingMessage';
import "../styles/global.css";
import "../styles/dashboard.css";

const OverallDataPage = () => {
  const [overallData, setOverallData] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOverallData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_URL}/overall-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch overall data");
        }
        const data = await response.json();
        setOverallData(data);
      } catch (err) {
        console.error("Error fetching overall data:", err);
        setError(err.message || "Error fetching overall data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOverallData();
  }, []);

  return (
    <div className="client-dashboard-container">
      <h2 className="client-dashboard-title">Overall Data</h2>
      {isLoading ? (
        <LoadingMessage text="Loading overall data..." />
      ) : error ? (
        <p className="error-message">{error}</p>
      ) : overallData ? (
        <div className="overall-data">
          <p>Total Clients: {overallData.total_clients}</p>
          <p>% Improved: {overallData.percent_improved.toFixed(2)}%</p>
          <p>% Clinically Significantly Improved: {overallData.percent_clinically_significant.toFixed(2)}%</p>
          <p>% Improved (Last 6 Months): {overallData.percent_improved_last_6_months.toFixed(2)}%</p>
          <p>% Clinically Significantly Improved (Last 6 Months): {overallData.percent_clinically_significant_last_6_months.toFixed(2)}%</p>
        </div>
      ) : null}
      <div className="form-actions">
        <button onClick={() => navigate(-1)} className="dashboard-button secondary">
          Back
        </button>
      </div>
    </div>
  );
};

export default OverallDataPage;
