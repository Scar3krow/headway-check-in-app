import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        inviteCode: "",
        role: "client", // Default role
        assignedClinicianId: "", // For clients to select a clinician
    });
    const [error, setError] = useState("");
    const [passwordFeedback, setPasswordFeedback] = useState({
        length: false,
        digitOrSpecial: false,
    });
    const [showPasswordFeedback, setShowPasswordFeedback] = useState(false);
    const [clinicians, setClinicians] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch clinicians for clients
        const fetchClinicians = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await axios.get(`${API_URL}/get-clinicians`, {  // 👈 Uses API_URL
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.data.clinicians) {
                    setClinicians(response.data.clinicians);
                } else {
                    setClinicians([]);
                }
            } catch (err) {
                console.error("Error fetching clinicians:", err);
                setError("Failed to fetch clinicians. Please try again.");
                setClinicians([]);
            }
        };

        if (formData.role === "client") {
            fetchClinicians();
        }
    }, [formData.role]);

    const validatePassword = (password) => {
        const length = password.length >= 6;
        const digitOrSpecial = /[\d@$!%*?&]/.test(password);
        setPasswordFeedback({ length, digitOrSpecial });
        return length && digitOrSpecial;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (name === "password") {
            if (!showPasswordFeedback) {
                setShowPasswordFeedback(true);
            }
            validatePassword(value);
        }

        if (name === "role") {
            // Reset invite code and clinician ID when switching roles
            setFormData({
                ...formData,
                inviteCode: "",
                assignedClinicianId: "",
                role: value,
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            role,
            inviteCode,
            assignedClinicianId,
        } = formData;

        if (!firstName || !lastName || !email || !password || !confirmPassword) {
            setError("All fields are required.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!validatePassword(password)) {
            setError("Password does not meet the required conditions.");
            return;
        }

        if ((role === "clinician" || role === "admin") && !inviteCode) {
            setError("Invite code is required for Clinician or Admin roles.");
            return;
        }

        if (role === "client" && !assignedClinicianId) {
            setError("Please select a clinician.");
            return;
        }

        try {
            if (role === "clinician" || role === "admin") {
                const inviteResponse = await axios.post(`${API_URL}/validate-invite`, {  // 👈 Uses API_URL
                    invite_code: inviteCode,
                });

                if (inviteResponse.data.message !== "Invite code valid") {
                    setError("Invalid invite code.");
                    return;
                }
            }

            await axios.post(`${API_URL}/register`, {  // 👈 Uses API_URL
                first_name: firstName,
                last_name: lastName,
                email,
                password,
                role,
                invite_code: inviteCode,
                assigned_clinician_id: assignedClinicianId,
            });

            navigate("/login");
        } catch (err) {
            console.error("Error during registration:", err);
            setError(err.response?.data?.message || "An error occurred. Please try again.");
        }
    };

    const handleBack = () => {
        navigate("/login");
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Register</h2>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit} className="form-content">
                <div className="form-group">
                    <label>First Name:</label>
                    <input
                        type="text"
                        name="firstName"
                        placeholder="Enter first name"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Last Name:</label>
                    <input
                        type="text"
                        name="lastName"
                        placeholder="Enter last name"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        name="email"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        name="password"
                        placeholder="Enter password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        className="form-input"
                    />
                    {showPasswordFeedback && (
                        <ul className="password-feedback">
                            <li style={{ color: passwordFeedback.length ? "green" : "red" }}>
                                At least 6 characters
                            </li>
                            <li style={{ color: passwordFeedback.digitOrSpecial ? "green" : "red" }}>
                                At least one digit or special character
                            </li>
                        </ul>
                    )}
                </div>
                <div className="form-group">
                    <label>Confirm Password:</label>
                    <input
                        type="password"
                        name="confirmPassword"
                        placeholder="Confirm password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Role:</label>
                    <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="form-select"
                    >
                        <option value="client">Client</option>
                        <option value="clinician">Clinician</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                {formData.role === "client" && (
                    <div className="form-group">
                        <label>Choose Clinician:</label>
                        <select
                            name="assignedClinicianId"
                            value={formData.assignedClinicianId}
                            onChange={handleChange}
                            required
                            className="form-select"
                        >
                            <option value="">-- Select Clinician --</option>
                            {clinicians.map((clinician) => (
                                <option key={clinician.id} value={clinician.id}>
                                    {clinician.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {(formData.role === "clinician" || formData.role === "admin") && (
                    <div className="form-group">
                        <label>Invite Code:</label>
                        <input
                            type="text"
                            name="inviteCode"
                            placeholder="Enter your invite code"
                            value={formData.inviteCode}
                            onChange={handleChange}
                            required
                            className="form-input"
                        />
                    </div>
                )}
                <div className="form-actions">
                    <button
                        type="button"
                        className="dashboard-button secondary"
                        onClick={handleBack}
                    >
                        Back
                    </button>
                    <button type="submit" className="dashboard-button primary">
                        Register
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Register;
