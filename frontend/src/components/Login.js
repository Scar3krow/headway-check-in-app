import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // Retaining form-specific styles

// 🔥 Dynamically Set API URL (Works in both Local & Live Deployments)
const API_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:5000";

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");
        const role = localStorage.getItem("effective_role");
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
            const response = await axios.post(`${API_URL}/login`, {  
                email,
                password,
            });
    
            const { access_token, role, user_id } = response.data;
    
            // ✅ **Fix: Store `effective_role` correctly**
            let effective_role = role;
            if (role === "admin") {
                effective_role = "clinician";  // Admins should also be clinicians
            }
    
            // ✅ **Fix: Store both role & effective_role**
            localStorage.setItem("token", access_token);
            localStorage.setItem("role", role);  // 🔥 This is still "admin"
            localStorage.setItem("effective_role", effective_role);  // 🔥 This is now "clinician"
            localStorage.setItem("user_id", user_id);
    
            // ✅ **Fix: Redirect Admins Correctly**
            if (role === "admin") {
                navigate("/admin-dashboard");  // 🔥 Admins go to admin-dashboard
            } else if (effective_role === "client") {
                navigate("/client-dashboard");
            } else if (effective_role === "clinician") {
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
