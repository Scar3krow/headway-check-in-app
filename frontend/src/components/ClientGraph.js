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
} from "chart.js";
import "../styles/global.css";
import "../styles/graphs.css"; // Graph-specific styles

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

const ClientGraph = ({ graphData, onDataPointClick }) => {
    const options = {
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
        },
        onClick: (event, elements) => {
            if (elements && elements.length > 0) {
                const sessionIndex = elements[0].index; // Get index of clicked point
                onDataPointClick(sessionIndex);
            }
        },
        elements: {
            point: {
                radius: 7,       // ✅ Slightly larger point
                hoverRadius: 10, // ✅ Enlarged hover area
                hitRadius: 22,   // ✅ Expands tap area for mobile users
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
                <Line data={graphData} options={options} />
            </div>
        </div>
    );
};

export default ClientGraph;
