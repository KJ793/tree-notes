import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Notes() {
  const navigate = useNavigate();

  // Textboxes
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [graphJson, setGraphJson] = useState("");

  // Button handlers
  function handleSave() {
    console.log("Saving note:", { title, content, tags });
  }

  function handleClear() {
    setTitle("");
    setContent("");
    setTags("");
    setGraphJson("");
  }

  async function handleGenerateGraph() {
    console.log("Sending request to /api/ai/generate");
    console.log("Prompt:", content);

    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt:content }),
    });

    console.log("Response Status:", response.status);

    const raw = await response.text();

    console.log("Raw response text:", raw);

    let data;

    data = JSON.parse(raw);
    console.log("Parsed JSON:", data);

    setGraphJson(JSON.stringify(data.output, null, 2));
  }

  return (
    <main className="notes-page">
      <h1>Create A New Note</h1>
      <div className="notes-form">
        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter note title" />

        <label>Content</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your raw note here..." roaws={6} />

        <label>Tags</label>
        <textarea value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated tags" />

        <label>AI Graph JSON</label>
        <textarea value={graphJson} onChange={(e) => setGraphJson(e.target.value)} placeholder="AI-Generated graph JSON will appear here" rows={10} />

        <div className="notes-buttons">
          <button onClick={handleSave}>Save Note</button>
          <button onClick={handleGenerateGraph}>Generate Graph</button>
          <button onClick={handleClear}>Clear</button>
          <button onClick={() => navigate("/dashboard")}>Dashboard</button>
        </div>
      </div>
    </main>
  );
}

export default Notes;
