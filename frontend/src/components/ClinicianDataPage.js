import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; 
import "../styles/forms.css"; 
import "../styles/table.css"; 
import "../styles/cliniciandata.css"; 
import { API_URL } from "../config";

const ClinicianDataPage = () => {
    const [clinicians, setClinicians] = useState([]);
    const [selectedClinicianId, setSelectedClinicianId] = useState("");
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // Fetch Clinicians on Mount.
    useEffect(() => {
        const fetchClinicians = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                const response = await axios.get(`${API_URL}/get-clinicians`, {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (response.data.clinicians) {
                    setClinicians(response.data.clinicians);
                } else {
                    setClinicians([]);
                }
            } catch (err) {
                console.error("Error fetching clinicians:", err);
                setError("Failed to fetch clinicians.");
            }
        };

        fetchClinicians();
    }, []);

    // Fetch Clinician Stats when a clinician is selected.
    const handleClinicianChange = async (e) => {
        const clinicianId = e.target.value;
        setSelectedClinicianId(clinicianId);

        try {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            const response = await axios.get(`${API_URL}/clinician-data`, {
                params: { clinician_id: clinicianId },
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Device-Token": deviceToken,
                },
            });

            if (response.data) {
                setStats(response.data);
                setError(""); 
            } else {
                setStats(null);
                setError("No data available for the selected clinician.");
            }
        } catch (err) {
            console.error("Error fetching clinician data:", err.response || err);
            setStats(null);
            setError("Failed to fetch clinician data. Please try again.");
        }
    };

    const handleBack = () => {
        navigate(-1); 
    };

    const handleOverallData = () => {
        navigate("/overall-data-page");
    };

    const handleMetricClick = (metric, timeFilter) => {
        // Navigate to admin-search-clients with the selected clinician, metric, and time filter.
        navigate(`/admin-search-clients?clinician_id=${selectedClinicianId}&metric=${metric}&time=${timeFilter}`);
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Clinician Data</h2>
            {error && <p className="error-message">{error}</p>}
            <div className="form-content">
                <div className="form-group">
                    <label className="form-question">Select a Clinician:</label>
                    <select
                        value={selectedClinicianId}
                        onChange={handleClinicianChange}
                        className="form-select"
                    >
                        <option value="" disabled>
                            Select a clinician
                        </option>
                        {clinicians.map((clinician) => (
                            <option key={clinician.id} value={clinician.id}>
                                {clinician.name}
                            </option>
                        ))}
                    </select>
                </div>
                {stats && (
                    <table className="stats-table">
                        <thead>
                            <tr>
                                <th>Metric</th>
                                <th>Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr onClick={() => handleMetricClick("total_clients", "all")}>
                                <td>Total Clients</td>
                                <td>{stats.total_clients}</td>
                            </tr>
                            <tr onClick={() => handleMetricClick("improved", "all")}>
                                <td>% Improved</td>
                                <td>
                                    {stats.percent_improved !== undefined
                                        ? stats.percent_improved.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                            <tr onClick={() => handleMetricClick("clinically_significant", "all")}>
                                <td>% Clinically Significant</td>
                                <td>
                                    {stats.percent_clinically_significant !== undefined
                                        ? stats.percent_clinically_significant.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                            <tr onClick={() => handleMetricClick("not-improving", "all")}>
                                <td>% Not Improving</td>
                                <td>
                                    {stats.percent_not_improving !== undefined
                                        ? stats.percent_not_improving.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                            <tr onClick={() => handleMetricClick("improved", "6months")}>
                                <td>% Improved (Last 6 Months)</td>
                                <td>
                                    {stats.percent_improved_last_6_months !== undefined
                                        ? stats.percent_improved_last_6_months.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                            <tr onClick={() => handleMetricClick("clinically_significant", "6months")}>
                                <td>% Clinically Significant (Last 6 Months)</td>
                                <td>
                                    {stats.percent_clinically_significant_last_6_months !== undefined
                                        ? stats.percent_clinically_significant_last_6_months.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
            <div className="form-actions">
                <button onClick={handleOverallData} className="dashboard-button secondary">
                    Overall Data
                </button>
                <button onClick={handleBack} className="dashboard-button secondary">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ClinicianDataPage;
