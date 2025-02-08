import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/global.css";
import "../styles/forms.css";
import "../styles/questionnaire.css";
import { API_URL } from "../config";
import LoadingMessage from "../components/LoadingMessage";

const QuestionnairePage = () => {
    const [questions, setQuestions] = useState([]);
    const [responses, setResponses] = useState({});
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const token = localStorage.getItem("token");
                const deviceToken = localStorage.getItem("device_token");

                if (!token) {
                    navigate("/login");
                    return;
                }

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
                setErrorMessage("Error fetching questions. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestions();
    }, [navigate]);

    const handleResponseChange = (questionId, value) => {
        setResponses({ ...responses, [questionId]: value });
    };

    const handleNext = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrevious = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
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

            navigate("/client-dashboard"); // Redirect to dashboard after submission
        } catch (error) {
            console.error("Error submitting responses:", error);
            setErrorMessage("Error submitting responses. Please try again later.");
        }
    };

    return (
        <div className="questionnaire-container">
            {isLoading ? (
                <LoadingMessage text="Loading questionnaire..." />
            ) : (
                <>
                    <h2 className="questionnaire-title">Check-In</h2>
                    <button onClick={() => navigate("/client-dashboard")} className="dashboard-button secondary">
                        Back to Dashboard
                    </button>

                    {errorMessage && <p className="error-message">{errorMessage}</p>}

                    <div className="questionnaire-content">
                        {/* ✅ Mobile View: Show One Question at a Time */}
                        <div className="questionnaire-mobile">
                            <div className="question-row">
                                <div className="question-left">
                                    <div className="question-text">{questions[currentQuestionIndex]?.text}</div>
                                </div>
                                <div className="likert-options">
                                    {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map((label, index) => (
                                        <label key={index} className="likert-option">
                                            <input
                                                type="radio"
                                                name={`question_${questions[currentQuestionIndex]?.id}`}
                                                value={index + 1}
                                                checked={responses[questions[currentQuestionIndex]?.id] === index + 1}
                                                onChange={() => handleResponseChange(questions[currentQuestionIndex]?.id, index + 1)}
                                            />
                                            <span className="likert-label">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="form-buttons">
                                {currentQuestionIndex > 0 && (
                                    <button type="button" onClick={handlePrevious} className="dashboard-button secondary">
                                        Previous
                                    </button>
                                )}
                                {currentQuestionIndex < questions.length - 1 ? (
                                    <button type="button" onClick={handleNext} className="dashboard-button primary">
                                        Next
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleSubmitResponses}
                                        className="dashboard-button primary"
                                        disabled={Object.keys(responses).length !== questions.length}
                                    >
                                        Submit Responses
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ✅ Desktop View: Show All Questions at Once */}
                        <div className="questionnaire-desktop">
                            <form className="questionnaire-form">
                                {questions.map((q) => (
                                    <div key={q.id} className="question-row">
                                        <div className="question-left">
                                            <div className="question-text">{q.text}</div>
                                        </div>
                                        <div className="likert-options">
                                            {["Not at all", "Occasionally", "Sometimes", "Often", "All the time"].map((label, index) => (
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
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="form-buttons">
                                    <button
                                        type="button"
                                        onClick={handleSubmitResponses}
                                        className="dashboard-button primary"
                                        disabled={Object.keys(responses).length !== questions.length}
                                    >
                                        Submit Responses
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default QuestionnairePage;
