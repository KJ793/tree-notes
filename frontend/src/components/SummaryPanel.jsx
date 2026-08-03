function SummaryPanel({ userSummary, setUserSummary, aiSummary, userSummaryReview, userScore, onGenerateSummary }) {
    return(
        <section className="summary-panel">
      <div className="summary-header">
        <div>
          <button type="button">AI Summary</button>
          <button type="button">My Summary</button>
        </div>

        <button type="button" onClick={onGenerateSummary}>Generate</button>
      </div>

      <div className="summary-content">
        <textarea
          placeholder="AI-generated summary will appear here..."
          readOnly
          value={aiSummary}
        />

        <textarea
          placeholder="Write your own summary here..."
          value={userSummary}
          onChange={(e) => setUserSummary(e.target.value)}
        />
      </div>

      <div className="summary-content">
        <textarea
          placeholder="AI Summary Review"
          readOnly
          value={userSummaryReview}
        />

        <textarea
          placeholder="Summary Review Score"
          readOnly
          value={userScore}
        />
      </div>

    </section>
    );
}

export default SummaryPanel;
