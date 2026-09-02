import { useState } from "react";

import {
  RefreshCw,
  Sparkles,
  Check,
} from "lucide-react";


function SummaryPanel({ rawNotes }) {

  // =========================================================
  // FRONTEND VIEW STATE
  // =========================================================

  // Controls which summary tab is currently displayed
  // "ai" = AI generated summary
  // "user" = User written summary
  const [activeTab, setActiveTab] = useState("ai");


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
  // GENERATE AI SUMMARY
  // =========================================================

  async function generateSummary() {

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

      setAiSummary(
        data.aiSummary || ""
      );


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
  }


  return (
    <section className="summary-panel">

      {/* ================================================= */}
      {/* SUMMARY TABS                                      */}
      {/* ================================================= */}

      <div className="summary-tabs">

        <button
          type="button"
          className={`summary-tab ${
            activeTab === "ai"
              ? "summary-tab-active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("ai")
          }
        >
          AI Summary
        </button>


        <button
          type="button"
          className={`summary-tab ${
            activeTab === "user"
              ? "summary-tab-active"
              : ""
          }`}
          onClick={() =>
            setActiveTab("user")
          }
        >
          My Summary
        </button>

      </div>


      {/* ================================================= */}
      {/* AI SUMMARY TAB                                    */}
      {/* ================================================= */}

      {activeTab === "ai" && (

        <div className="summary-view">

          <div className="summary-view-header">

            <div className="summary-view-title">
              <h3>
                AI Summary
              </h3>

              <p>
                Generate a concise summary from your Raw Notes.
              </p>
            </div>


            <button
              type="button"
              className="summary-action-button"
              onClick={generateSummary}
              disabled={summaryLoading}
            >
              <RefreshCw
                size={17}
                strokeWidth={1.9}
              />

              <span>
                {summaryLoading
                  ? "Generating..."
                  : aiSummary
                    ? "Regenerate"
                    : "Generate Summary"}
              </span>
            </button>

          </div>


          {summaryError && (
            <p className="summary-error">
              {summaryError}
            </p>
          )}


          <div className="ai-summary-content">

            {aiSummary ? (

              <p>
                {aiSummary}
              </p>

            ) : (

              <p className="summary-placeholder">
                AI-generated summary will appear here...
              </p>

            )}

          </div>

        </div>

      )}


      {/* ================================================= */}
      {/* MY SUMMARY TAB                                    */}
      {/* ================================================= */}

      {activeTab === "user" && (

        <div className="summary-view">

          <div className="summary-view-header">

            <div className="summary-view-title">

              <h3>
                My Summary
              </h3>

              <p>
                Summarise the notes in your own words and ask AI for feedback.
              </p>

            </div>


            <div className="summary-user-actions">

              {/* Score only appears after AI review */}

              {summaryScore !== null && (

                <div className="summary-score">

                  <span>
                    Score
                  </span>

                  <strong>
                    {summaryScore}/100
                  </strong>

                </div>

              )}


              <button
                type="button"
                className="summary-action-button"
                onClick={reviewMySummary}
                disabled={reviewLoading}
              >
                <Sparkles
                  size={17}
                  strokeWidth={1.9}
                />

                <span>
                  {reviewLoading
                    ? "Reviewing..."
                    : "Improve with AI"}
                </span>
              </button>

            </div>

          </div>


          {/* ============================================= */}
          {/* USER SUMMARY TEXT                             */}
          {/* ============================================= */}

          <textarea
            className="user-summary-input"
            value={mySummary}
            onChange={handleMySummaryChange}
            placeholder="Write your own summary here..."
          />


          {reviewError && (
            <p className="summary-error">
              {reviewError}
            </p>
          )}


          {/* ============================================= */}
          {/* AI REVIEW                                     */}
          {/* ============================================= */}

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

      )}

    </section>
  );
}


export default SummaryPanel;