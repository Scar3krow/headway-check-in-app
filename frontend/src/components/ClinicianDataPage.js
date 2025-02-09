import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // For form-specific styles
import "../styles/table.css"; // For table-specific styles
import "../styles/cliniciandata.css"; // Page-specific styles
import { API_URL } from "../config";
//UPDATED

const ClinicianDataPage = () => {
    const [clinicians, setClinicians] = useState([]);
    const [selectedClinicianId, setSelectedClinicianId] = useState("");
    const [stats, setStats] = useState(null);
    const [error, setError] = useState("");
    const navigate = useNavigate();

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
                setError(""); // Clear any previous errors
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
        navigate("/admin-dashboard");
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
                            <tr>
                                <td>Total Clients</td>
                                <td>{stats.total_clients}</td>
                            </tr>
                            <tr>
                                <td>% Improved</td>
                                <td>
                                    {stats.percent_improved !== undefined
                                        ? stats.percent_improved.toFixed(2) + "%"
                                        : "N/A"}
                                </td>
                            </tr>
                            <tr>
                                <td>% Clinically Significant</td>
                                <td>{stats.percent_clinically_significant !== undefined
                                    ? stats.percent_clinically_significant.toFixed(2) + "%"
                                    : "N/A"}</td>
                            </tr>
                            <tr>
                                <td>% Improved (Last 6 Months)</td>
                                <td>{stats.percent_improved_last_6_months !== undefined
                                    ? stats.percent_improved_last_6_months.toFixed(2) + "%"
                                    : "N/A"}</td>
                            </tr>
                            <tr>
                                <td>% Clinically Significant (Last 6 Months)</td>
                                <td>{stats.percent_clinically_significant_last_6_months !== undefined
                                    ? stats.percent_clinically_significant_last_6_months.toFixed(2) + "%"
                                    : "N/A"}</td>
                            </tr>
                        </tbody>
                    </table>
                )}
            </div>
            <div className="form-actions">
                <button onClick={handleBack} className="dashboard-button secondary">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ClinicianDataPage;
