import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/questionnaire.css";
import "../styles/dashboard.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const QuestionnairePage = () => {
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuestions = async () => {
            const token = localStorage.getItem("token");
            const deviceToken = localStorage.getItem("device_token");

            if (!token) {
                navigate("/login");
                return;
            }

            try {
                const response = await fetch(`${API_URL}/questions`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Device-Token": deviceToken,
                    },
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch questions.");
                }

                const data = await response.json();
                setQuestions(data);
            } catch (error) {
                console.error("Error fetching questions:", error);
                setErrorMessage("Error fetching questions. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestions();
    }, [navigate]);

    const handleResponseChange = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleSubmitResponses = async () => {
        const token = localStorage.getItem("token");
        const deviceToken = localStorage.getItem("device_token");

        const payload = {
            responses: Object.keys(responses).map((questionId) => ({
                question_id: questionId,
                response_value: responses[questionId],
            })),
        };

        try {
            const response = await fetch(`${API_URL}/submit-responses`, {
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
            setErrorMessage("Error submitting responses. Please try again.");
        }
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex((prev) => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex((prev) => prev - 1);
        }
    };

    return (
        <div className="questionnaire-container">
            <h2 className="questionnaire-title">Check-In</h2>
            {isLoading ? <LoadingMessage text="Loading questionnaire..." /> : null}
            {errorMessage && <p className="error-message">{errorMessage}</p>}

            {/* ✅ Desktop View: Show All Questions at Once */}
            <div className="questionnaire-form desktop-view">
                {questions.map((q) => (
                    <div key={q.id} className="question-row">
                        <div className="question-left">{q.text}</div>
                        <div className="likert-options">
                            {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                (label, index) => (
                                    <label key={index} className="likert-option">
                                        <input
                                            type="radio"
                                            name={`question_${q.id}`}
                                            value={index + 1}
                                            checked={responses[q.id] === index + 1}
                                            onChange={() => handleResponseChange(q.id, index + 1)}
                                        />
                                        <span className="likert-label">{label}</span>
                                    </label>
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ✅ Mobile View: Show One Question at a Time */}
            <div className="questionnaire-form mobile-view">
                {questions.length > 0 && (
                    <div className="question-box">
                        <p className="question-text">{questions[currentQuestionIndex].text}</p>
                        <div className="response-options">
                            {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map(
                                (label, index) => (
                                    <button
                                        key={index}
                                        className={`response-btn ${
                                            responses[questions[currentQuestionIndex].id] === index + 1 ? "selected" : ""
                                        }`}
                                        onClick={() => handleResponseChange(questions[currentQuestionIndex].id, index + 1)}
                                    >
                                        {label}
                                    </button>
                                )
                            )}
                        </div>
                        <div className="nav-buttons">
                            <button className="nav-btn" onClick={handlePrev} disabled={currentQuestionIndex === 0}>
                                ◀
                            </button>
                            <button className="nav-btn" onClick={handleNext} disabled={currentQuestionIndex === questions.length - 1}>
                                ▶
                            </button>
                        </div>
                        {currentQuestionIndex === questions.length - 1 && (
                            <button className="submit-btn" onClick={handleSubmitResponses} disabled={Object.keys(responses).length !== questions.length}>
                                Submit
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Back Button */}
            <div className="form-actions">
                <button onClick={() => navigate("/client-dashboard")} className="dashboard-button secondary">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};

export default QuestionnairePage;
