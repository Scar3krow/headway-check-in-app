import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClientGraph from "./ClientGraph";
import "../styles/global.css"; // Consolidated global styles
import "../styles/table.css"; // Shared table styles
import "../styles/dashboard.css"; // Dashboard-specific styles
import "../styles/responsespage.css"; // Page-specific styles

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000"

const ClientResponsesPage = () => {
    const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [], sessionIds: [] });
    const [graphData, setGraphData] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchResponses = async () => {
            try {
                const token = localStorage.getItem("token");
                const userId = localStorage.getItem("user_id");

                if (!userId) {
                    setErrorMessage("User ID not found. Please log in again.");
                    return;
                }

                const response = await fetch(
                    `${API_URL}/past-responses?user_id=${userId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                const responseData = await response.json();

                if (response.ok) {
                    if (responseData.message === "No responses available for this user") {
                        setGraphData(null);
                        setResponsesTable({ rows: [], sessionDates: [], sessionIds: [] });
                    } else {
                        formatResponsesTable(responseData);
                    }
                } else {
                    throw new Error(responseData.message || "Failed to fetch responses.");
                }
            } catch (error) {
                console.error("Error fetching responses:", error);
                setErrorMessage("");
            }
        };

        fetchResponses();
    }, []);

    const formatResponsesTable = (data) => {
        const sessions = data.reduce((acc, response) => {
            const { session_id, question_id, response_value, timestamp } = response;

            if (!acc[session_id]) {
                acc[session_id] = {
                    date: new Date(timestamp),
                    responses: {},
                };
            }
            acc[session_id].responses[question_id] = response_value;
            return acc;
        }, {});

        const sortedSessionIds = Object.keys(sessions).sort(
            (a, b) => sessions[a].date - sessions[b].date
        );

        const tableRows = Object.keys(data[0]?.responses || {}).map((questionId) => ({
            questionText: `Question ${questionId}`,
            responses: sortedSessionIds.map(
                (sessionId) => sessions[sessionId]?.responses[questionId] || "-"
            ),
        }));

        setResponsesTable({
            rows: tableRows,
            sessionDates: sortedSessionIds.map(
                (sessionId) => sessions[sessionId].date.toLocaleDateString()
            ),
            sessionIds: sortedSessionIds,
        });

        calculateGraphData(sortedSessionIds, sessions);
    };

    const calculateGraphData = (sessionIds, sessions) => {
        const totalScores = sessionIds.map((sessionId) =>
            Object.values(sessions[sessionId]?.responses || {}).reduce(
                (sum, response) => sum + parseInt(response || 0, 10),
                0
            ) - 10
        );

        const graphData = {
            labels: sessionIds.map((sessionId, index) => `Session ${index + 1}`),
            datasets: [
                {
                    label: "Level of Distress",
                    data: totalScores,
                    borderColor: "#353d5f",
                    backgroundColor: "rgba(53, 61, 95, 0.2)",
                    pointBackgroundColor: "#353d5f",
                    pointBorderColor: "#353d5f",
                    tension: 0.4,
                },
            ],
        };

        setGraphData(graphData);
    };

    const handleDataPointClick = (sessionIndex) => {
        const sessionId = responsesTable.sessionIds[sessionIndex];
        const sessionDate = responsesTable.sessionDates[sessionIndex];
        const sessionData = responsesTable.rows.map((row) => ({
            questionText: row.questionText,
            responseValue: row.responses[sessionIndex],
        }));

        // Store the session data in localStorage for the details page
        localStorage.setItem(
            "selectedSessionData",
            JSON.stringify({ sessionId, sessionDate, sessionData })
        );

        // Navigate to the session details page with sessionId
        navigate(`/session-details/${sessionId}`);
    };

    return (
        <div className="responses-page-container">
            <h2 className="responses-title">Your Responses</h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {!responsesTable.rows.length && !graphData ? (
                <p className="no-data-message">No responses available to display.</p>
            ) : (
                <>
                    {graphData && (
                        <ClientGraph
                            graphData={graphData}
                            onDataPointClick={handleDataPointClick}
                        />
                    )}
                </>
            )}
            <div className="form-actions">
                <button
                    onClick={() => navigate("/client-dashboard")}
                    className="dashboard-button secondary"
                >
                    Back to Dashboard
                </button>
            </div>
            {graphData && (
                <p className="data-point-instructions">
                    Click on a data point to see answers for each question.
                </p>
            )}
        </div>
    );
};

export default ClientResponsesPage;
