import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/questionnaire.css";
import "../styles/dashboard.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";
//UPDATED

const QuestionnairePage = () => {
    const [questionnaires, setQuestionnaires] = useState([]);
    const [selectedQuestionnaire, setSelectedQuestionnaire] = useState("default_questionnaire");
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [responses, setResponses] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const userId = localStorage.getItem("user_id");

    // 🔹 Fetch available questionnaires
    useEffect(() => {
        const fetchQuestionnaires = async () => {
            try {
                const token = localStorage.getItem("token");

                const response = await fetch(`${API_URL}/questionnaires`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) throw new Error("Failed to fetch questionnaires");

                const data = await response.json();
                setQuestionnaires(data);
            } catch (error) {
                console.error("Error fetching questionnaires:", error);
            }
        };

        fetchQuestionnaires();
    }, []);

    // 🔹 Fetch questions for the selected questionnaire
    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                const response = await fetch(`${API_URL}/questions?questionnaire_id=${selectedQuestionnaire}`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!response.ok) throw new Error("Failed to fetch questions.");
                
                const data = await response.json();
                setQuestions(data);
                setResponses({}); // Reset responses when changing questionnaires
                setCurrentIndex(0); // Reset index when changing questionnaires
            } catch (error) {
                console.error("Error fetching questions:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (selectedQuestionnaire) {
            fetchQuestions();
        }
    }, [selectedQuestionnaire]);

    const handleAnswerSelect = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleSubmit = async () => {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");

        const sessionId = `session_${Date.now()}`; // Generate unique session ID

        const payload = {
            session_id: sessionId,
            questionnaire_id: selectedQuestionnaire,
            responses: Object.keys(responses).map((questionId) => ({
                question_id: questionId,
                response_value: responses[questionId],
            })),
        };

        try {
            const response = await fetch(`${API_URL}/user-data/${userId}/sessions/${sessionId}/responses`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    "Device-Token": deviceToken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error("Failed to submit responses.");
            }

            navigate("/client-dashboard");
        } catch (error) {
            console.error("Error submitting responses:", error);
        }
    };

    return (
        <div className="questionnaire-container">
            {isLoading ? <LoadingMessage text="Loading questionnaire..." /> : null}

            {/* 🔹 Questionnaire Selection */}
            <div className="questionnaire-selection">
                <label>Select a Questionnaire:</label>
                <select
                    value={selectedQuestionnaire}
                    onChange={(e) => setSelectedQuestionnaire(e.target.value)}
                    className="form-select"
                >
                    {questionnaires.map((q) => (
                        <option key={q.id} value={q.id}>
                            {q.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ✅ Desktop Questionnaire */}
            <div className="desktop-questionnaire">
                <h2 className="questionnaire-title">Check-In</h2>
                <p className="questionnaire-description">
                    This form has 10 statements about how you have been OVER THE LAST WEEK.
                    Please read each statement and think how often you felt that was last week.
                    Then select the box which is closest to this.
                </p>
                <form className="questionnaire-form">
                    {questions.map((q) => (
                        <div key={q.id} className="question-row">
                            <div className="question-left">
                                <div className="question-text">{q.text}</div>
                            </div>
                            <div className="likert-options">
                                {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                    (label, index) => (
                                        <label key={index} className="likert-option">
                                            <input
                                                type="radio"
                                                name={`question_${q.id}`}
                                                value={index + 1}
                                                checked={responses[q.id] === index + 1}
                                                onChange={() => handleAnswerSelect(q.id, index + 1)}
                                            />
                                            <span className="likert-label">{label}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </form>
                <div className="form-buttons">
                    <button type="button" className="back-btn" onClick={() => navigate("/client-dashboard")}>
                        ⬅ Back
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="submit-btn"
                        disabled={Object.keys(responses).length !== questions.length}
                    >
                        Submit Responses
                    </button>
                </div>
            </div>

            {/* ✅ Mobile Questionnaire */}
            <div className="mobile-questionnaire-container">
                <h2 className="questionnaire-title">Check-In</h2>
                <p className="questionnaire-description">
                    This form has 10 statements about how you have been OVER THE LAST WEEK.
                    Please read each statement and think how often you felt that was last week.
                    Then select the box which is closest to this.
                </p>
                {questions.length > 0 && (
                    <>
                        <p className="question-counter">{currentIndex + 1}/{questions.length}</p>
                        <p className="question-text">{questions[currentIndex].text}</p>
                        <div className="response-options">
                            {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                (label, index) => (
                                    <button
                                        key={index}
                                        className={`response-btn ${responses[questions[currentIndex].id] === index + 1 ? "selected" : ""}`}
                                        onClick={() => handleAnswerSelect(questions[currentIndex].id, index + 1)}
                                    >
                                        {label}
                                    </button>
                                )
                            )}
                        </div>
                        <div className="navigation-buttons">
                            <button className="nav-btn themed-nav-btn" onClick={handlePrevious} disabled={currentIndex === 0}>
                                Previous
                            </button>
                            <button className="nav-btn themed-nav-btn" onClick={handleNext} disabled={currentIndex === questions.length - 1}>
                                Next
                            </button>
                        </div>
                        {currentIndex === questions.length - 1 && (
                            <button className="submit-btn visible" onClick={handleSubmit} disabled={Object.keys(responses).length !== questions.length}>
                                Submit Responses
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default QuestionnairePage;
