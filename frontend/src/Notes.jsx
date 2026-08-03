import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Notes() {
  const navigate = useNavigate();

  // Textboxes
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [rawData, setRawData] = useState("");
  const [graphJson, setGraphJson] = useState("");
  const [userSummary, setUserSummary] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [userSummaryReview, setUserSummaryReview] = useState("");
  const [userScore, setUserScore] = useState(0);

  // Button handlers
  function handleSave() {
    console.log("Saving note:", { title, tags, rawData, userSummary });
  }

  function handleClear() {
    setTitle("");
    setTags("");
    setRawData("");
    setGraphJson("");
    setUserSummary("");
    setAiSummary("");
    setUserSummaryReview("");
    setUserScore(0);
  }

  async function handleGenerateGraph() {
    const response = await fetch("http://localhost:8000/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawData:rawData }),
    });

    const data = await response.json();
    setGraphJson(JSON.stringify(data.output, null, 2));
    console.log("Graph generated successfully...");
  }

  async function handleGenerateSummary() {
    const response = await fetch("http://localhost:8000/ai/summarise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawData: rawData,
        graphJson: graphJson, // include the weight and importance scores captured by the graph to influence summary phrasing
        userSummary: userSummary, // to evaluate relative accuracy of the user's summary; if above threshold similarity, we promote self-summary
      }),
    });

    const data = await response.json();
    setAiSummary(data.aiSummary);
    setUserSummaryReview(data.userSummaryReview);
    setUserScore(data.userScore);
    console.log("Summary generated successfully...");
  }

  return (
    <main className="notes-page">
      <h1>Create A New Note</h1>
      <div className="notes-form">
        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter note title" />

        <br />

        <label>Tags</label>
        <textarea value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated tags" />

        <br />
        <br />

        <label>Raw Data</label>
        <textarea value={rawData} onChange={(e) => setRawData(e.target.value)} placeholder="Write your raw note here..." rows={6} />
        <br />
        <button onClick={handleGenerateGraph}>Generate Graph</button>
        <br />

        <label>AI Graph JSON</label>
        <textarea value={graphJson} onChange={(e) => setGraphJson(e.target.value)} placeholder="AI-Generated graph JSON will appear here" rows={6} />

        <br />
        <br />

        <label>User Summary</label>
        <textarea value={userSummary} onChange={(e) => setUserSummary(e.target.value)} placeholder="Write your own summary here" rows={3} />
        <br />
        <button onClick={handleGenerateSummary}>Generate Summary</button>
        <br />

        <label>AI Summary</label>
        <textarea value={aiSummary} onChange={(e) => setAiSummary(e.target.value)} placeholder="AI-Generated Summary will appear here" rows={6} />

        <br />
        <label>User Summary Review</label>
        <textarea value={userSummaryReview} onChange={(e) => setUserSummaryReview(e.target.value)} placeholder="AI-Generated Review of your summary will appear here" rows={6} />

        <br />
        <label>User Summary Score</label>
        <textarea type="number" value={userScore} onChange={(e) => setUserScore(e.target.value)} placeholder="AI Score for your Summary" rows={2} />

        <div className="notes-buttons">
          <button onClick={handleSave}>Save Note</button>
          <button onClick={handleClear}>Clear</button>
          <br />
          <button onClick={() => navigate("/dashboard")}>Dashboard</button>
        </div>
      </div>
    </main>
  );
}

export default Notes;
