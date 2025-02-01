import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/home.css";

const Home = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // 🔐 **Redirect Logged-in Users**
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

    return (
        <div className="home-container">
            <h1 className="home-title">Welcome to Headway Check-In App</h1>
            <p className="home-description">
                Stay connected and track progress with a simple, easy-to-use questionnaire.
            </p>
            <div className="home-buttons">
                <Link to="/login" className="dashboard-button primary">
                    Login
                </Link>
                <Link to="/register" className="dashboard-button secondary">
                    Register
                </Link>
            </div>
        </div>
    );
};

export default Home;
