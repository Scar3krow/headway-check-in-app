import React from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
    Title,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import "../styles/global.css";
import "../styles/graphs.css"; // Graph-specific styles

ChartJS.register(
    LineElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Tooltip,
    Legend,
    Title,
    annotationPlugin
);

const ClinicianGraph = ({ graphData, firstSessionScore, sessionIds, onSessionClick }) => {
    const clinicallySignificantThreshold = firstSessionScore - 12;

    const graphOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: "top",
                labels: {
                    usePointStyle: true,
                },
            },
            tooltip: {
                enabled: true,
            },
            annotation: {
                annotations: {
                    nonClinicalShading: {
                        type: "box",
                        yMin: 0,
                        yMax: 11,
                        backgroundColor: "rgba(144, 238, 144, 0.3)", // Light green
                        borderWidth: 0,
                    },
                    clinicallySignificantLine: {
                        type: "line",
                        yMin: clinicallySignificantThreshold,
                        yMax: clinicallySignificantThreshold,
                        borderColor: "rgba(70, 130, 180, 0.8)", // Light blue
                        borderWidth: 2,
                        borderDash: [6, 6],
                        label: {
                            display: true,
                            content: "Clinically Significant Change",
                            position: "end",
                            backgroundColor: "rgba(70, 130, 180, 0.8)",
                            color: "white",
                            padding: 4,
                            font: {
                                size: 12,
                            },
                        },
                    },
                },
            },
        },
        scales: {
            y: {
                min: 0,
                max: 40,
                ticks: {
                    stepSize: 5,
                },
            },
            x: {
                ticks: {
                    autoSkip: false,
                },
            },
        },
        onClick: (event, elements) => {
            if (elements.length > 0 && onSessionClick) {
                const index = elements[0].index; // Get the index of the clicked data point
                const sessionId = sessionIds[index]; // Map index to session ID
                onSessionClick(sessionId); // Call the click handler with the session ID
            }
        },
        elements: {
            point: {
                radius: 10,       // ✅ Slightly larger point
                hoverRadius: 15, // ✅ Enlarged hover area
                hitRadius: 25,   // ✅ Expands tap area for mobile users
            },
            line: {
                tension: 0.4,    // ✅ Smooth curve instead of sharp angles
            },
        },
        scales: {
            y: {
                min: 0,
                max: 40,
                ticks: {
                    stepSize: 5,
                },
            },
            x: {
                ticks: {
                    autoSkip: false, // Ensure all sessions are displayed
                },
            },
        },
    };

    return (
        <div className="graph-container">
            <h3 className="graph-title">Core-10 Results Over Sessions</h3>
            <div className="graph-wrapper">
                <Line data={graphData} options={graphOptions} />
            </div>
        </div>
    );
};

export default ClinicianGraph;
