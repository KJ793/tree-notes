import GraphPanel from "./GraphPanel";
import SummaryPanel from "./SummaryPanel";

import { useNavigate } from "react-router-dom";
import { useState } from "react";

function NoteWorkspace({ note }) {
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
    <div className="note-workspace">
      <input
        type="text"
        defaultValue={note.title}
        className="note-title"
      />

      <div className="notes-layout">
        <section className="raw-notes">
          <h2>Raw Notes</h2>

          <textarea
            className="text-area"
            placeholder="Start writing..."
            value={rawData}
            onChange={(e) => setRawData(e.target.value)}
          />
        </section>

        <GraphPanel
          graphJson={graphJson}
          setGraphJson={setGraphJson}
          onGenerateGraph={handleGenerateGraph}
        />
      </div>

      <SummaryPanel
        setUserSummary={setUserSummary}
        aiSummary={aiSummary}
        userSummaryReview={userSummaryReview}
        userScore={userScore}
        onGenerateSummary={handleGenerateSummary}
      />
    </div>
  );
}

export default NoteWorkspace;
