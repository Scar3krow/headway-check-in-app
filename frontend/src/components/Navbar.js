import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/navbar.css";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false); // State to toggle menu visibility
    const navigate = useNavigate();

    const toggleMenu = () => {
        setIsMenuOpen((prev) => !prev);
    };

    const handleNavigate = (path) => {
        navigate(path);
        setIsMenuOpen(false); // Close the menu after navigation
    };

    return (
        <nav className="navbar">
            <h1 className="navbar-title">Headway Psychology</h1>
            <button
                className="navbar-toggle"
                onClick={toggleMenu}
                aria-label="Toggle navigation"
            >
                ☰
            </button>
            <div className={`nav-links ${isMenuOpen ? "open" : ""}`}>
                <button
                    onClick={() => handleNavigate("/")}
                    className="nav-button"
                >
                    Home
                </button>
                <button
                    onClick={() => handleNavigate("/login")}
                    className="nav-button"
                >
                    Login
                </button>
                <button
                    onClick={() => handleNavigate("/register")}
                    className="nav-button"
                >
                    Register
                </button>
                <button
                    onClick={() => handleNavigate("/logout")}
                    className="nav-button"
                >
                    Logout
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
