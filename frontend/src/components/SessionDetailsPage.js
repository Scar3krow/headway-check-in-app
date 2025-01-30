import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../styles/global.css"; // Consolidated global styles
import "../styles/forms.css"; // For form-related layouts and messages
import "../styles/table.css"; // Shared table styles
import "../styles/sessiondetails.css"; // Specific to this page

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"

const SessionDetailsPage = () => {
    const { sessionId } = useParams();
    const [sessionDetails, setSessionDetails] = useState([]);
    const [questionMap, setQuestionMap] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    const responseTextMap = {
        1: "Not at all",
        2: "Occasionally",
        3: "Sometimes",
        4: "Often",
        5: "All the time",
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");

                const [sessionResponse, questionsResponse] = await Promise.all([
                    fetch(`${API_URL}/session-details?session_id=${sessionId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch('${API_URL}/questions', {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                if (!sessionResponse.ok || !questionsResponse.ok) {
                    throw new Error("Failed to fetch data");
                }

                const sessionData = await sessionResponse.json();
                const questionsData = await questionsResponse.json();

                const questionMap = questionsData.reduce((acc, question) => {
                    acc[question.id] = question.text;
                    return acc;
                }, {});

                setSessionDetails(sessionData);
                setQuestionMap(questionMap);
            } catch (error) {
                console.error("Error fetching session details:", error);
                setErrorMessage("Error fetching session details. Please try again later.");
            }
        };

        fetchData();
    }, [sessionId]);

    const handleBackToClientResults = () => {
        navigate(-1); // Navigate back to the previous page
    };

    return (
        <div className="session-details-container">
            <h2 className="session-details-title">Session Details</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {sessionDetails.length > 0 ? (
                <div className="session-details-table-wrapper">
                    <table className="session-details-table">
                        <thead>
                            <tr>
                                <th>Question</th>
                                <th>Response</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessionDetails.map((detail) => (
                                <tr key={detail.question_id}>
                                    <td>{questionMap[detail.question_id] || `Question ${detail.question_id}`}</td>
                                    <td>{responseTextMap[detail.response_value] || "Unknown"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="no-data-message">No session details available.</p>
            )}
            <div className="form-actions">
                <button
                    onClick={handleBackToClientResults}
                    className="dashboard-button secondary"
                >
                    Back to Results
                </button>
            </div>
        </div>
    );
};

export default SessionDetailsPage;
