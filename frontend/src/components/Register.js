import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css";  // Form-specific styles
import { API_URL } from "../config";

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
  const [passwordValidations, setPasswordValidations] = useState({
    minLength: false,
    hasNumberOrSpecial: false,
  });
  const [error, setError] = useState("");
  const [clinicians, setClinicians] = useState([]);
  const navigate = useNavigate();

  // On mount, clear any existing session data to log out the current user.
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("device_token");
  }, []);

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

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setFormData({ ...formData, password: newPassword });

    setPasswordValidations({
      minLength: newPassword.length >= 6,
      hasNumberOrSpecial: /[\d@$!%*?&]/.test(newPassword),
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // If the role changes, reset inviteCode and assignedClinicianId
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

    // Validate required fields
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

    if (!passwordValidations.minLength || !passwordValidations.hasNumberOrSpecial) {
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
      // For clinician or admin roles, validate the invite code
      if (formData.role === "clinician" || formData.role === "admin") {
        const inviteResponse = await axios.post(`${API_URL}/validate-invite`, {
          invite_code: formData.inviteCode,
        });

        if (inviteResponse.data.message !== "Invite code valid") {
          setError("Invalid invite code.");
          return;
        }
      }

      // Call the registration API
      const registerResponse = await axios.post(`${API_URL}/register`, {
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        invite_code: formData.inviteCode,
        assigned_clinician_id: formData.assignedClinicianId,
      });

      // Registration successful. Instead of auto-logging in, navigate to the login page.
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
            onChange={handlePasswordChange}
            required
            className="form-input"
          />
          {formData.password && (
            <div className="password-requirements">
              <p className={passwordValidations.minLength ? "valid" : "invalid"}>
                At least 6 characters
              </p>
              <p className={passwordValidations.hasNumberOrSpecial ? "valid" : "invalid"}>
                Contains a number or special character (@, $, !, %, *, ?, &)
              </p>
            </div>
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
