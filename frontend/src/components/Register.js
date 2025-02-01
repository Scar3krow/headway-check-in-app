import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Form-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Register = () => {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        inviteCode: "",
        role: "client", // Default role
        assignedClinicianId: "",
    });
    const [error, setError] = useState("");
    const [clinicians, setClinicians] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        if (formData.role === "client") {
            fetchClinicians();
        }
    }, [formData.role]);

    const fetchClinicians = async () => {
        try {
            const response = await axios.get(`${API_URL}/get-clinicians`);
            setClinicians(response.data.clinicians || []);
        } catch (err) {
            console.error("Error fetching clinicians:", err);
            setError("Failed to fetch clinicians.");
        }
    };

    const validatePassword = (password) => {
        return password.length >= 6 && /[\d@$!%*?&]/.test(password);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        if (name === "role") {
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

        if (
            !formData.firstName ||
            !formData.lastName ||
            !formData.email ||
            !formData.password ||
            !formData.confirmPassword
        ) {
            setError("All fields are required.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (!validatePassword(formData.password)) {
            setError("Password must be at least 6 characters long and contain a digit or special character.");
            return;
        }

        if ((formData.role === "clinician" || formData.role === "admin") && !formData.inviteCode) {
            setError("Invite code is required for Clinician or Admin roles.");
            return;
        }

        if (formData.role === "client" && !formData.assignedClinicianId) {
            setError("Please select a clinician.");
            return;
        }

        try {
            if (formData.role === "clinician" || formData.role === "admin") {
                const inviteResponse = await axios.post(`${API_URL}/validate-invite`, {
                    invite_code: formData.inviteCode,
                });

                if (inviteResponse.data.message !== "Invite code valid") {
                    setError("Invalid invite code.");
                    return;
                }
            }

            const registerResponse = await axios.post(`${API_URL}/register`, {
                first_name: formData.firstName,
                last_name: formData.lastName,
                email: formData.email,
                password: formData.password,
                role: formData.role,
                invite_code: formData.inviteCode,
                assigned_clinician_id: formData.assignedClinicianId,
            });

            const { access_token, role, user_id, session_id } = registerResponse.data;

            // ✅ Store user details & session in localStorage
            localStorage.setItem("token", access_token);
            localStorage.setItem("role", role);
            localStorage.setItem("user_id", user_id);
            localStorage.setItem("session_id", session_id);

            // ✅ Redirect based on role
            if (role === "admin") {
                navigate("/admin-dashboard");
            } else if (role === "client") {
                navigate("/client-dashboard");
            } else if (role === "clinician") {
                navigate("/clinician-dashboard");
            } else {
                setError("Invalid role. Please contact support.");
            }
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
