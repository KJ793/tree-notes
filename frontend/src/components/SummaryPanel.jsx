import { useState } from "react";

import {
  Sparkles,
  Check,
  NotebookPen,
} from "lucide-react";


function SummaryPanel({ rawNotes }) {

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

  // Stores user's own summary
  const [mySummary, setMySummary] = useState("");

  // Handles loading while AI reviews the user's summary
  const [reviewLoading, setReviewLoading] = useState(false);

  // Handles errors while reviewing user's summary
  const [reviewError, setReviewError] = useState("");

  // Flag to use mock summary review data for testing
  const USE_MOCK_SUMMARY_REVIEW = true;


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

  async function generateSummary() { // uses deprecated logic

    // << FRONTEND DEV >> //
    // rawNotes is provided from NoteWorkspace
    // rawNotes is sent to backend for AI summary generation

    if (!rawNotes || rawNotes.trim() === "") {
      setSummaryError(
        "Please write some notes before generating a summary."
      );

      return;
    }


    setSummaryLoading(true);
    setSummaryError("");


    try {

      // =====================================================
      // << BACKEND CONNECTION >>
      // =====================================================

      // Frontend provides:
      //
      // rawNotes: string

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

      if (!response.ok) {
        throw new Error(
          "Summary generation failed. Please try again."
        );
      }


      // =====================================================
      // << HANS AI RESPONSE >>
      // =====================================================

      // Hans receives rawNotes from backend
      //
      // Hans currently returns:
      //
      // {
      //   aiSummary: "AI generated summary text"
      // }

      const aiResponse = await fetch(
        "http://localhost:8000/ai/summarise",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            rawNotes: rawNotes,

            /*
              AI Summary generation should primarily
              depend on Raw Notes.

              Keep userSummary empty here so the user's
              answer does not influence the generated
              reference summary.
            */
            userSummary: "",
          }),
        }
      );


      if (!aiResponse.ok) {
        throw new Error(
          "AI summary generation failed."
        );
      }


      const data = await aiResponse.json();


      // << FRONTEND DEV >> //
      // Hans advises using data.aiSummary rather than
      // data.summary to distinguish summary types

      const generatedSummary =
        data.aiSummary || "";

      setAiSummary(generatedSummary);
      setMySummary(generatedSummary);

      // A newly generated summary has not been reviewed yet
      setSummaryScore(null);
      setSummaryFeedback("");
      setImprovedSummary("");
      setReviewError("");


    } catch (error) {

      console.error(
        "Summary generation error:",
        error
      );


      setSummaryError(
        "Unable to generate summary. Please try again."
      );


    } finally {

      setSummaryLoading(false);

    }
  }

  async function generateOrReviewSummary() {
    if (!rawNotes || rawNotes.trim() == "") {
      setSummaryError("Please write some notes before generating a summary.");
      return;
    }

    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await fetch("api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  // REVIEW USER SUMMARY
  // =========================================================

  async function reviewMySummary() {

    if (!rawNotes || rawNotes.trim() === "") {
        setReviewError(
        "Please write some notes before reviewing your summary."
        );

        return;
    }


    if (!mySummary || mySummary.trim() === "") {
        setReviewError(
        "Write your own summary before asking AI to review it."
        );

        return;
    }


    setReviewLoading(true);
    setReviewError("");

    setSummaryScore(null);
    setSummaryFeedback("");
    setImprovedSummary("");


    try {

        // =====================================================
        // TEMPORARY FRONTEND MOCK
        // =====================================================

        if (USE_MOCK_SUMMARY_REVIEW) {

        /*
            Small delay so the "Reviewing..." state
            is visible during the demonstration.
        */

        await new Promise((resolve) =>
            setTimeout(resolve, 900)
        );


        setSummaryScore(82);


        setSummaryFeedback(
            "Your summary is clear and covers the main ideas well. " +
            "You could improve it by including a little more detail " +
            "about the key concepts discussed in the original notes."
        );


        setImprovedSummary(
            "TreeNotes is an open-source note-taking application " +
            "designed to help users organise and connect their ideas. " +
            "It combines structured notes with graph-based knowledge " +
            "mapping and AI-assisted features to make information " +
            "easier to understand and review."
        );


        return;
        }


        // =====================================================
        // HANS AI USER SUMMARY REVIEW
        // =====================================================

        const aiResponse = await fetch(
        "http://localhost:8000/ai/summarise",
        {
            method: "POST",

            headers: {
            "Content-Type": "application/json",
            },

            body: JSON.stringify({
            rawNotes: rawNotes,
            userSummary: mySummary,
            }),
        }
        );


        if (!aiResponse.ok) {
        throw new Error(
            "User summary review failed."
        );
        }


        const data =
        await aiResponse.json();


        setSummaryScore(
        data.userScore ??
        data.score ??
        null
        );


        setSummaryFeedback(
        data.userReview ??
        data.feedback ??
        ""
        );


        setImprovedSummary(
        data.improvedSummary ??
        data.suggestedSummary ??
        ""
        );


    } catch (error) {

        console.error(
        "User summary review error:",
        error
        );


        setReviewError(
        "Unable to review your summary. Please try again."
        );


    } finally {

        setReviewLoading(false);

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
