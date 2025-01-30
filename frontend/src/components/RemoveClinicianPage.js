import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RemoveClinicianPage = () => {
    const [clinicians, setClinicians] = useState([]);
    const [selectedClinicianId, setSelectedClinicianId] = useState("");
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchClinicians = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(`${API_URL}/get-clinicians`, {  // ✅ FIXED
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.data && Array.isArray(response.data.clinicians)) {
                    setClinicians(response.data.clinicians);
                } else {
                    console.error("Unexpected data structure from /get-clinicians:", response.data);
                    setClinicians([]);
                }
            } catch (error) {
                console.error("Error fetching clinicians:", error);
                setError("Failed to fetch clinicians. Please try again.");
            }
        };

        fetchClinicians();
    }, []);

    const handleRemoveClinician = async () => {
        setError("");
        setSuccessMessage("");

        if (!selectedClinicianId) {
            setError("Please select a clinician to remove.");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_URL}/remove-clinician`,  // ✅ FIXED
                { clinician_id: selectedClinicianId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setSuccessMessage("Clinician removed successfully.");
            setClinicians(clinicians.filter((c) => c.id !== selectedClinicianId));
            setSelectedClinicianId("");
        } catch (error) {
            console.error("Error removing clinician:", error);
            setError("Failed to remove clinician. Please try again.");
        }
    };

    const handleBack = () => {
        navigate("/admin-dashboard");
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Remove Clinician</h2>
            {error && <p className="error-message">{error}</p>}
            {successMessage && <p className="success-message">{successMessage}</p>}
            <form className="form-content">
                <div className="form-group">
                    <label>Choose a Clinician to Remove:</label>
                    <select
                        name="clinician"
                        value={selectedClinicianId}
                        onChange={(e) => setSelectedClinicianId(e.target.value)}
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
                <div className="form-actions">
                    <button
                        type="button"
                        onClick={handleBack}
                        className="dashboard-button secondary"
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleRemoveClinician}
                        className="dashboard-button danger"
                    >
                        Confirm Remove
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RemoveClinicianPage;
