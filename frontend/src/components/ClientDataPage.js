/*
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/buttons.css";
import "../styles/table.css";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const ClientDataPage = () => {
    const { userId } = useParams();
    const [clientName, setClientName] = useState("");
    const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [] });
    const [loading, setLoading] = useState(false);
    const [graphData, setGraphData] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("token");

        if (!token) {
            navigate("/login");
            return;
        }

        const fetchClientData = async () => {
            setLoading(true);
            try {
                const nameResponse = await fetch(`http://127.0.0.1:5000/user-info?user_id=${userId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!nameResponse.ok) {
                    throw new Error("Failed to fetch client name.");
                }

                const nameData = await nameResponse.json();
                setClientName(nameData.username || "Client");

                const responsesResponse = await fetch(
                    `http://127.0.0.1:5000/past-responses?user_id=${userId}`,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );

                if (!responsesResponse.ok) {
                    throw new Error("Failed to fetch client responses.");
                }

                const responseData = await responsesResponse.json();
                if (responseData.message === "No responses available for this user") {
                    setResponsesTable({ rows: [], sessionDates: [] });
                    setGraphData(null); // No graph data available
                } else {
                    formatResponsesTable(responseData);
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
                setErrorMessage("An error occurred while fetching client data. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchClientData();
    }, [userId, navigate]);

    const formatResponsesTable = (data) => {
        const groupedByQuestion = data.reduce((acc, response) => {
            const { question_id, question_text, session_id, response_value } = response;

            if (!acc[question_id]) {
                acc[question_id] = {
                    questionText: question_text,
                    responses: {},
                };
            }

            acc[question_id].responses[session_id] = response_value;

            return acc;
        }, {});

        const sessions = [...new Set(data.map((r) => r.session_id))];
        const sortedSessionIds = sessions.sort((a, b) => {
            const dateA = new Date(data.find((r) => r.session_id === a).timestamp);
            const dateB = new Date(data.find((r) => r.session_id === b).timestamp);
            return dateA - dateB;
        });

        const tableRows = Object.values(groupedByQuestion).map((question) => ({
            questionText: question.questionText,
            responses: sortedSessionIds.map(
                (sessionId) => question.responses[sessionId] || "-"
            ),
        }));

        setResponsesTable({
            rows: tableRows,
            sessionDates: sortedSessionIds.map((_, index) => `Session ${index + 1}`),
        });

        calculateGraphData(sortedSessionIds, groupedByQuestion);
    };

    const calculateGraphData = (sortedSessionIds, groupedByQuestion) => {
        const totalScores = sortedSessionIds.map((sessionId) =>
            Object.values(groupedByQuestion).reduce((sum, question) => {
                const responseValue = parseInt(question.responses[sessionId] || 0, 10);
                return sum + responseValue;
            }, 0) - 10
        );

        const graphData = {
            labels: sortedSessionIds.map((_, index) => `Session ${index + 1}`),
            datasets: [
                {
                    label: "Total Score Over Time",
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

    return (
        <div className="responses-page-container">
            <h2 className="responses-title">
                {loading ? "Loading..." : `${clientName}'s Results`}
            </h2>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            {!responsesTable.rows.length && !graphData ? (
                <p className="no-data-message">No check-ins have been completed.</p>
            ) : (
                <>
                    {responsesTable.rows.length > 0 && (
                        <div className="responses-table-container">
                            <table className="responses-table">
                                <thead>
                                    <tr>
                                        <th className="question-column">Questions</th>
                                        {responsesTable.sessionDates.map((session, index) => (
                                            <th key={index}>{session}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {responsesTable.rows.map((row, index) => (
                                        <tr key={index}>
                                            <td className="question-column">{row.questionText}</td>
                                            {row.responses.map((response, colIndex) => (
                                                <td key={colIndex}>{response}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {graphData && (
                        <div className="graph-container">
                            <h3 className="graph-title">Total Score Over Sessions</h3>
                            <Line
                                data={graphData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: true },
                                        tooltip: { enabled: true },
                                    },
                                    scales: {
                                        y: {
                                            min: 0,
                                            max: 40,
                                            ticks: { stepSize: 5 },
                                        },
                                    },
                                }}
                            />
                        </div>
                    )}
                </>
            )}
            <div className="form-actions">
                <button
                    onClick={() => navigate("/clinician-dashboard")}
                    className="dashboard-button secondary"
                >
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default ClientDataPage; 
*/