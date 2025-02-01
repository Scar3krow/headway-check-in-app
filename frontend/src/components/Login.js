import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { v4 as uuidv4 } from "uuid"; // ✅ Generate Unique Device Tokens
import "../styles/global.css";
import "../styles/forms.css";

const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("role");

        if (token) {
            if (role === "client") {
                navigate("/client-dashboard");
            } else if (role === "clinician") {
                navigate("/clinician-dashboard");
            } else if (role === "admin") {
                navigate("/admin-dashboard");
            }
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!email || !password) {
            setError("Please enter both email and password.");
            return;
        }

        try {
            // ✅ Generate a Unique Device Token (Used for Multi-Session Security)
            const deviceToken = uuidv4();

            // ✅ Send Login Request
            const response = await axios.post(`${API_URL}/login`, {  
                email,
                password,
                device_token: deviceToken, // 🔥 Send Device Token with Login Request
            });

            const { access_token, role, user_id } = response.data;

            // ✅ Store Token & Device Token for Authentication
            localStorage.setItem("token", access_token);
            localStorage.setItem("role", role);
            localStorage.setItem("user_id", user_id);
            localStorage.setItem("device_token", deviceToken); // 🔥 Store Device Token for Future Requests

            // ✅ Redirect Based on Role
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
            if (err.response && err.response.status === 401) {
                setError("Invalid email or password.");
            } else {
                setError("An error occurred. Please try again later.");
            }
        }
    };

    return (
        <div className="form-container">
            <h2 className="form-title">Login</h2>
            {error && <p className="error-message">{error}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="dashboard-button primary">
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/forgot-password")}
                        className="dashboard-button secondary"
                    >
                        Forgot Password?
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Login;
