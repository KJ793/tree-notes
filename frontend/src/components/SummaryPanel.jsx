import { useState } from "react";

import {
  Sparkles,
  Check,
  NotebookPen,
} from "lucide-react";


function SummaryPanel({ rawNotes, summary, onSummaryChange }) {

  // =========================================================
  // FRONTEND VIEW STATE
  // =========================================================

  // Controls which summary tab is currently displayed
  // "ai" = AI generated summary
  // "user" = User written summary

  // =========================================================
  // AI SUMMARY STATE
  // =========================================================

  // Stores generated summary returned from backend / AI
  const [aiSummary, setAiSummary] = useState("");

  // Handles loading state while AI summary is being generated
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Handles AI summary generation errors
  const [summaryError, setSummaryError] = useState("");


  // =========================================================
  // USER SUMMARY STATE
  // =========================================================

  // The saved summary state lives in NoteWorkspace so the Navbar
  // Save action can persist it with the rest of the note.
  const mySummary = summary ?? "";

  function setMySummary(value) {
    onSummaryChange?.(value);
  }

  // Handles loading while AI reviews the user's summary
  const [reviewLoading, setReviewLoading] = useState(false);

  // Handles errors while reviewing user's summary
  const [reviewError, setReviewError] = useState("");

  // =========================================================
  // AI USER-SUMMARY REVIEW STATE
  // =========================================================

  // Score returned by AI
  const [summaryScore, setSummaryScore] = useState(null);

  // Feedback returned by AI
  const [summaryFeedback, setSummaryFeedback] = useState("");

  // Optional improved summary returned by AI
  const [improvedSummary, setImprovedSummary] = useState("");

  // =========================================================
  // UNIFIED SUMMARY AI BUTTON STATE
  // =========================================================

  // Determines whether the user currently has a summary
  const hasUserSummary =
    mySummary.trim().length > 0;

  // Either AI operation can make the main button busy
  const aiLoading =
    summaryLoading || reviewLoading;

  // Button automatically changes depending on whether
  // the user has already written/generated a summary
  const aiButtonText = aiLoading
    ? hasUserSummary
      ? "Improving..."
      : "Generating..."
    : hasUserSummary
      ? "Improve with AI"
      : "Generate Summary";

  // =========================================================
  // HANDLE AI SUMMARY GENARATION/REVIEW
  // =========================================================

  async function handleSummaryAI() {
    await generateOrReviewSummary();
//     if (hasUserSummary) {
//       await reviewMySummary();
//     } else {
//       await generateSummary();
//     }
  }

  // =========================================================
  // GENERATE AI SUMMARY
  // =========================================================

  async function generateOrReviewSummary() {
    if (!rawNotes || rawNotes.trim() == "") {
      setSummaryError("Please write some notes before generating a summary.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rawNotes,
//           graphJson: graphData ? JSON.stringify(graphData) : "",
          userSummary: mySummary || "",
        }),
      });

      if (!response.ok) {
        throw new Error("Summary generation failed. Please try again.");
      }

      const data = await response.json();

      // Use backend results directly
      setAiSummary(data.aiSummary);
      setMySummary(data.aiSummary);

      setSummaryScore(data.userScore ?? null);
      setSummaryFeedback(data.userSummaryReview ?? "");

      setImprovedSummary(data.improvedSummary ?? "");

    } catch (error) {
      console.error("Summary generation error:", error);
      setSummaryError("Unable to generate summary. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
  }

  // =========================================================
  // APPLY AI IMPROVED SUMMARY
  // =========================================================

  function useImprovedSummary() {

    if (!improvedSummary) {
      return;
    }


    setMySummary(
      improvedSummary
    );


    /*
      The user's summary has now changed.

      The previous score/review no longer applies,
      so clear it.
    */

    setSummaryScore(null);
    setSummaryFeedback("");
    setImprovedSummary("");
  }

  // =========================================================
  // USER EDITING
  // =========================================================

  function handleMySummaryChange(event) {

    setMySummary(
      event.target.value
    );


    /*
      Once the user changes their summary,
      invalidate the previous AI review.
    */

    setSummaryScore(null);
    setSummaryFeedback("");
    setImprovedSummary("");

    setReviewError("");
    setSummaryError("");
  }

  return (
    <section className="summary-panel">

      {/* ================================================= */}
      {/* SUMMARY HEADING                                   */}
      {/* ================================================= */}

      <div className="summary-panel-heading">

        <div className="summary-panel-heading-title">
          <h2>Summary</h2>

          <NotebookPen
            size={20}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        </div>


        <div className="summary-heading-actions">

          {(summaryError || reviewError) && (
            <span className="summary-header-error">
              {summaryError || reviewError}
            </span>
          )}

          {summaryScore !== null && (
            <div className="summary-score">
              <span>Score</span>

              <strong>
                {summaryScore}/100
              </strong>
            </div>
          )}


          <button
            type="button"
            className="summary-action-button primary-action"
            onClick={handleSummaryAI}
            disabled={
              aiLoading ||
              !rawNotes?.trim()
            }
          >
            <Sparkles
              size={17}
              strokeWidth={1.9}
            />

            <span>
              {aiButtonText}
            </span>
          </button>

        </div>

      </div>


      {/* ================================================= */}
      {/* SUMMARY CONTENT                                   */}
      {/* ================================================= */}

      <div className="summary-view">

        <textarea
          className="user-summary-input"
          value={mySummary}
          onChange={handleMySummaryChange}
          placeholder="Summarise your notes in your own words..."
        />


        {/* ================================================= */}
        {/* AI REVIEW                                        */}
        {/* ================================================= */}

        {(summaryFeedback ||
          improvedSummary) && (

          <div className="summary-review">


            {/* AI Feedback */}

            {summaryFeedback && (

              <div className="summary-feedback">

                <span className="summary-review-label">
                  AI Feedback
                </span>

                <p>
                  {summaryFeedback}
                </p>

              </div>

            )}


            {/* Suggested improved summary */}

            {improvedSummary && (

              <div className="improved-summary">

                <div className="improved-summary-header">

                  <span className="summary-review-label">
                    Suggested Improvement
                  </span>


                  <button
                    type="button"
                    className="use-improved-summary-button"
                    onClick={useImprovedSummary}
                  >

                    <Check
                      size={15}
                      strokeWidth={2}
                    />

                    <span>
                      Use this version
                    </span>

                  </button>

                </div>


                <p>
                  {improvedSummary}
                </p>

              </div>

            )}

          </div>

        )}

      </div>

    </section>
  );
}


export default SummaryPanel;
