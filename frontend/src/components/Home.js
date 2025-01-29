import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/global.css'; // Consolidated global styles
import '../styles/home.css'; // Retaining component-specific styles

const Home = () => {
    useEffect(() => {
        // You can fetch any data or make API calls here, if needed
        fetch('/').then(response => {
            if (!response.ok) {
                console.error('Error loading the home page.');
            }
        });
    }, []);

    return (
        <div className="home-container">
            <h1 className="home-title">Headway Check-In App</h1>
            <p className="home-description">
                Welcome! This app helps clients and clinicians stay connected and track progress with a simple, easy-to-use questionnaire.
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
