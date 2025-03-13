import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import "../styles/global.css";
import "../styles/dashboard.css";
import "../styles/table.css";
import "../styles/loading.css";
import ClinicianGraph from "./ClinicianGraph";
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

const ClientResultsPage = () => {
  const { userId } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();

  // Read the 'source' query parameter from the URL; default to "active"
  const urlParams = new URLSearchParams(location.search);
  const sourceParam = urlParams.get("source") || "active";

  const [clientName, setClientName] = useState("");
  const [isArchived, setIsArchived] = useState(false); // tracks client's archive status
  const [responsesTable, setResponsesTable] = useState({ rows: [], sessionDates: [], sessionIds: [] });
  const [graphData, setGraphData] = useState(null);
  const [sessionIds, setSessionIds] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");

        if (!token || !deviceToken) {
          setErrorMessage("Session expired. Please log in again.");
          navigate("/login");
          return;
        }

        // Fetch client info, using the source parameter to target the correct collection.
        const userInfoResponse = await fetch(`${API_URL}/user-info?user_id=${userId}&source=${sourceParam}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Device-Token": deviceToken,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error("Failed to fetch client info");
        }

        const userInfo = await userInfoResponse.json();
        setClientName(`${userInfo.first_name} ${userInfo.last_name}`);
        // API returns an "is_archived" flag; we use that to set local state.
        setIsArchived(userInfo.is_archived || false);

        // Fetch past responses, including the source parameter.
        const responsesResponse = await fetch(`${API_URL}/past-responses?user_id=${userId}&source=${sourceParam}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Device-Token": deviceToken,
          },
        });

        const responseData = await responsesResponse.json();

        if (responsesResponse.ok) {
          if (responseData.message === "No responses available for this user") {
            setGraphData(null);
            setResponsesTable({ rows: [], sessionDates: [], sessionIds: [] });
          } else {
            formatResponsesTable(responseData);
          }
        } else {
          throw new Error(responseData.message || "Failed to fetch client responses.");
        }
      } catch (error) {
        console.error("Error fetching client data:", error);
        setErrorMessage("Error fetching client data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClientData();
  }, [userId, navigate, sourceParam]);

  const formatResponsesTable = (data) => {
    const sessions = {};

    // Iterate over each session from the API response.
    data.forEach((session) => {
      const { session_id, timestamp, summary_responses } = session;
      if (!sessions[session_id]) {
        sessions[session_id] = {
          date: new Date(timestamp),
          responses: {},
        };
      }
      (summary_responses || []).forEach(({ question_id, response_value }) => {
        sessions[session_id].responses[question_id] = response_value;
      });
    });

    const sortedSessionIds = Object.keys(sessions).sort(
      (a, b) => sessions[a].date - sessions[b].date
    );

    const allQuestionIds = new Set();
    data.forEach((session) => {
      (session.summary_responses || []).forEach(({ question_id }) => allQuestionIds.add(question_id));
    });

    const tableRows = [...allQuestionIds].map((questionId) => ({
      questionText: `Question ${questionId}`,
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

    setSessionIds(sortedSessionIds);
    calculateGraphData(sortedSessionIds, sessions, formattedSessionDates);
  };

  const calculateGraphData = (sessionIds, sessions, formattedSessionDates) => {
    const totalScores = sessionIds.map((sessionId) =>
      Object.values(sessions[sessionId]?.responses || {}).reduce(
        (sum, response) => sum + parseInt(response || 0, 10),
        0
      ) - 10
    );

    // Create labels as an array of two strings (multi-line) for each session.
    const labels = sessionIds.map((_, index) => [
      `Session ${index + 1}`,
      `(${formattedSessionDates[index]})`
    ]);

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

  // Define Chart.js options for tooltips.
  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            // Use the sessionDates from responsesTable.
            const date = responsesTable.sessionDates[context.dataIndex] || "";
            return `Level of Distress: ${value} (Date: ${date})`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          // When labels are arrays, Chart.js will render them on separate lines.
          callback: function(value, index) {
            return this.getLabelForValue(index);
          },
        },
      },
    },
  };

  const handleBack = () => {
    navigate(-1);
  };  

  const handleSessionClick = (selectedSessionId) => {
    const sessionIndex = sessionIds.indexOf(selectedSessionId);
    if (sessionIndex === -1) {
      console.error("Selected session ID not found in sessionIds array.");
      return;
    }

    const sessionDate = responsesTable.sessionDates[sessionIndex];
    const sessionData = responsesTable.rows.map((row) => ({
      questionText: row.questionText,
      responseValue: row.responses[sessionIndex],
    }));

    // Pass the source parameter along when navigating to session details.
    localStorage.setItem(
      "selectedSessionData",
      JSON.stringify({ sessionId: selectedSessionId, sessionDate, sessionData })
    );
    navigate(`/client-session-details/${userId}/${selectedSessionId}?source=${sourceParam}`);
  };

  const toggleArchive = async () => {
    const action = isArchived ? "Unarchive" : "Archive";
    const confirmMessage = `Are you sure you want to ${action.toLowerCase()} this client?`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const deviceToken = localStorage.getItem("device_token");
      const endpoint = isArchived
        ? `${API_URL}/unarchive-client/${userId}`
        : `${API_URL}/archive-client/${userId}`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Device-Token": deviceToken,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Operation failed.");
      }
      setIsArchived(!isArchived);
      alert(`Client ${action.toLowerCase()}d successfully.`);
    } catch (error) {
      console.error(`${action} error:`, error);
      alert(`${action} error: ${error.message}`);
    }
  };

  return (
    <div className="client-dashboard-container">
      {isLoading ? (
        <LoadingMessage text="Loading client details..." />
      ) : (
        <>
          <div className="client-header">
            <h2 className="client-dashboard-title">{`${clientName}'s Results`}</h2>
          </div>
          {errorMessage && <p className="error-message">{errorMessage}</p>}
          {!graphData && responsesTable.rows.length === 0 ? (
            <p className="no-data-message">No check-ins have been completed.</p>
          ) : (
            <ClinicianGraph
              graphData={graphData}
              firstSessionScore={graphData.datasets[0]?.data[0] || 0}
              sessionIds={sessionIds}
              onSessionClick={handleSessionClick}
              options={chartOptions}
            />
          )}
          {graphData && (
            <p className="data-point-instructions">
              Click on a data point to see answers for each question.
            </p>
          )}
          <div className="form-actions">
            <button onClick={handleBack} className="dashboard-button secondary">
              Back
            </button>
          </div>
          <button onClick={toggleArchive} className="dashboard-button secondary">
              {isArchived ? "Unarchive Client" : "Archive Client"}
            </button>
        </>
      )}
    </div>
  );
};

export default ClientResultsPage;
