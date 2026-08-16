import { useState } from "react";


function SummaryPanel({rawNotes}) {

    // << frontend dev >> //
    // Stores generated summasry returned from backend / AI //
    const [aiSummary, setAiSummary] = useState("");

    // Stores users own summary //
    const [mySummary, setMySummary] = useState("");

    // Handles loading state while AI summary is being generated //
    const [loading, setLoading] = useState(false);

    // Handles any summary generation errors //
    const [error, setError] = useState("");


    async function generateSummary() {

        // << frontend dev >> //
        // rawNotes is provided from NoteWorkspace //
        // rawNotes is sent to backend for AI summary generation //

        if (!rawNotes || rawNotes.trim() === "") {
            setError("Please write some notes before generating a summary.");
            return;
        }

        setLoading(true);
        setError("");

        try {

            // << BACKEND CONNECTION GOES HERE >> //
            // frontend provides rawNotes: type string //

            const response = await fetch("/api/summary", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    rawNotes: rawNotes,
                }),
            });


            // << DAMON / KYLE BACKEND STUFF >> //

            // if summary generation fails //

            if (!response.ok) {
                throw new Error(
                    "Summary generation failed. Please try again."
                );
            }


            // << HANS AI RESPONSE >> //
            // Hans receives rawNotes from backend //
            // Hans must return AI summary as a string //
            // { summary: "AI generated summary text" } //

            const aiResponse = await fetch("http://localhost:8000/ai/summarise", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawNotes: rawNotes, userSummary: mySummary })
                // body: JSON.stringify({ rawNotes: rawNotes, graphJson: graphJson, userSummary: userSummary })
            });

            // >>>>>> FRONTEND TEAM <<<<<< //
            // If you provide me with graphJson (from GraphPanel.jsx) I can send this to the AI model as additional content with which it can produce a summary (not needed)
            // If you provide me with a userSummary, then the AI can produce a review of the user Summary + a User score. But you will need HTML to present this data.
            // Let me know what you want to do here.

            // const data = await response.json();
            // Changing name for this response as we have multiple await fetch responses on this page and response.status can get confusing
            const data = await aiResponse.json();

            // << frontend dev >> //
            // Save returned AI summary into state //

            // setAiSummary(data.summary);
            // HANS advises to change "data.summary" -> "data.aiSummary" to avoid confusion between multiple summaries between user and AI
            // "aiSummary" also matches the return type Schema in the AI component
            setAiSummary(data.aiSummary);


        } catch (error) {

            // << frontend dev >> //
            // Error handling for summary generation failure //

            console.error("Summary generation error:", error);

            setError(
                "Unable to generate summary. Please try again."
            );

        } finally {

            // Stop loading state after request succeeds or fails //

            setLoading(false);
        }
    }

    return(
        <section className="summary-panel">
      <div className="summary-header">
        <div>
          <button type="button">AI Summary</button>
          <button type="button">My Summary</button>
        </div>

        <button type="button"
            onClick={generateSummary}
            disabled={loading}
        >
        {loading
            ? "Generating..."
            : "Regenerate"}
        </button>
      </div>

    {/* << FRONTEND DISPLAY >> */}


    {error && (
        <p className="summary-error">
            {error}
        </p>)}


      <div className="summary-content">
        {/* << AI SUMMARY DISPLAY >> */}
        <textarea
          value={aiSummary}
          placeholder="AI-generated summary will appear here..."
          readOnly
        />

        {/* << USER SUMMARY DISPLAY >> */}

        <textarea
          value={mySummary}
          onChange={(e) => setMySummary(e.target.value)}
          placeholder="Write your own summary here..."
        />
      </div>
    </section>
    );
}

export default SummaryPanel;    
