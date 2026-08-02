function SummaryPanel(){
    return(
        <section className="summary-panel">
      <div className="summary-header">
        <div>
          <button type="button">AI Summary</button>
          <button type="button">My Summary</button>
        </div>

        <button type="button">Regenerate</button>
      </div>

      <div className="summary-content">
        <textarea
          placeholder="AI-generated summary will appear here..."
          readOnly
        />

        <textarea
          placeholder="Write your own summary here..."
        />
      </div>
    </section>
    );
}

export default SummaryPanel;