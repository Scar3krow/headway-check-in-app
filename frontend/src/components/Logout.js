import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/global.css'; // Ensure global styles are applied

const Logout = () => {
    const navigate = useNavigate();

    useEffect(() => {
        // Clear the token and role from localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('effective_role');

        // Redirect to the login page
        navigate('/login');
    }, [navigate]);

    return (
        <div className="logout-container">
            <h2 className="logout-title">Logging Out...</h2>
        </div>
    );
};

export default Logout;
