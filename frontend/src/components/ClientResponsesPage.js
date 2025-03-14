import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ClientGraph from "./ClientGraph";
import "../styles/global.css";
import "../styles/table.css";
import "../styles/dashboard.css";
import "../styles/responsespage.css";
import "../styles/loading.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

// Helper function to format a date as dd/mm/yy.
const formatDateDDMMYY = (dateInput) => {
  const d = new Date(dateInput);
  let day = d.getDate();
  let month = d.getMonth() + 1;
  let year = d.getFullYear() % 100; // last two digits
  day = day < 10 ? `0${day}` : day;
  month = month < 10 ? `0${month}` : month;
  year = year < 10 ? `0${year}` : year;
  return `${day}/${month}/${year}`;
};

const ClientResponsesPage = () => {
  const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [], sessionIds: [] });
  const [graphData, setGraphData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Chart.js options including tooltip callback.
  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            // Use our stored sessionDates from responsesTable.
            const date = responsesTable.sessionDates[context.dataIndex] || "";
            return `Level of Distress: ${value} (Date: ${date})`;
          },
        },
      },
    },
    scales: {
      x: {
        // With multi-line labels (using "\n") our labels already include the date.
        ticks: {
          callback: function(value, index) {
            return this.getLabelForValue(index);
          },
        },
      },
    },
  };

  useEffect(() => {
    const fetchResponses = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");
        const userId = localStorage.getItem("user_id");

        if (!token || !deviceToken || !userId) {
          setErrorMessage("Session expired. Please log in again.");
          navigate("/login");
          return;
        }

        const response = await fetch(`${API_URL}/past-responses?user_id=${userId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Device-Token": deviceToken,
          },
        });

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
        setErrorMessage("Error fetching responses. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchResponses();
  }, [navigate]);

  const formatResponsesTable = (data) => {
    const sessions = {};

    data.forEach((session) => {
      // Destructure to get the new field summary_responses
      const { session_id, timestamp, summary_responses } = session;
      if (!sessions[session_id]) {
        sessions[session_id] = {
          date: new Date(timestamp),
          responses: {},
        };
      }

      // Use summary_responses (fallback to empty array if undefined)
      (summary_responses || []).forEach(({ question_id, response_value }) => {
        sessions[session_id].responses[question_id] = response_value;
      });
    });

    // Sort session IDs by timestamp
    const sortedSessionIds = Object.keys(sessions).sort(
      (a, b) => sessions[a].date - sessions[b].date
    );

    // Extract all unique question IDs across all sessions using summary_responses
    const allQuestionIds = new Set();
    data.forEach((session) => {
      (session.summary_responses || []).forEach((response) => {
        allQuestionIds.add(response.question_id);
      });
    });

    // Format data into table rows with question text & responses
    const tableRows = [...allQuestionIds].map((questionId) => ({
      questionText: `Question ${questionId}`, // Placeholder; replace if needed
      responses: sortedSessionIds.map(
        (sessionId) => sessions[sessionId]?.responses[questionId] || "-"
      ),
    }));

    // Use our helper to format dates as dd/mm/yy.
    const formattedSessionDates = sortedSessionIds.map(
      (sessionId) => formatDateDDMMYY(sessions[sessionId].date)
    );

    setResponsesTable({
      rows: tableRows,
      sessionDates: formattedSessionDates,
      sessionIds: sortedSessionIds,
    });

    calculateGraphData(sortedSessionIds, sessions, formattedSessionDates);
  };

  const calculateGraphData = (sessionIds, sessions, formattedSessionDates) => {
    const totalScores = sessionIds.map((sessionId) =>
      Object.values(sessions[sessionId]?.responses || {}).reduce(
        (sum, response) => sum + parseInt(response || 0, 10),
        0
      ) - 10
    );
  
    const isMobile = window.innerWidth < 768;
    let labels;
    if (isMobile) {
      // Mobile view: only display date in dd/mm format.
      labels = sessionIds.map((_, index) => {
        const parts = formattedSessionDates[index].split('/');
        // parts = [day, month, yy] => dd/mm
        return `${parts[0]}/${parts[1]}`;
      });
    } else {
      // Desktop view: multi-line label with session number and full date.
      labels = sessionIds.map((_, index) => [
        `Session ${index + 1}`,
        `(${formattedSessionDates[index]})`
      ]);
    }
  
    const graphData = {
      labels,
      datasets: [
        {
          label: "Level of Distress",
          data: totalScores,
          borderColor: "#587266",
          backgroundColor: "rgba(53, 61, 95, 0.2)",
          pointBackgroundColor: "#587266",
          pointBorderColor: "#587266",
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

    localStorage.setItem("selectedSessionData", JSON.stringify({ sessionId, sessionDate, sessionData }));
    navigate(`/session-details/${sessionId}`);
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      const deviceToken = localStorage.getItem("device_token");

      if (token && deviceToken) {
        await fetch(`${API_URL}/logout-device`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "Device-Token": deviceToken,
          },
          body: JSON.stringify({ device_token: deviceToken }),
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("device_token");

    navigate("/login");
  };

  return (
    <div className="responses-page-container">
      <h2 className="responses-title">Your Responses</h2>
      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {isLoading ? (
        <LoadingMessage text="Fetching responses..." />
      ) : responsesTable.rows.length === 0 && !graphData ? (
        <p className="no-data-message">No responses available to display.</p>
      ) : (
        <>
          {graphData && (
            <ClientGraph
              graphData={graphData}
              options={chartOptions}
              onDataPointClick={handleDataPointClick}
            />
          )}
        </>
      )}

      {!isLoading && (
        <div className="form-actions">
          <button onClick={() => navigate("/client-dashboard")} className="dashboard-button secondary">
            Back to Dashboard
          </button>
          <button onClick={handleLogout} className="dashboard-button danger">
            Logout
          </button>
        </div>
      )}

      {!isLoading && graphData && (
        <p className="data-point-instructions">
          Click on a data point to see answers for each question.
        </p>
      )}
    </div>
  );
};

export default ClientResponsesPage;
