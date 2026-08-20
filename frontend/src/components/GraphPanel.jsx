import {useState} from 'react';

function GraphPanel({rawNotes}) {
    
    // <<frontend dev >> //
    //stores the graph Json returned from AI//
    const [graphData, setGraphData] = useState(null);

    //Used to handle graph loading time and state//
    const [loading, setLoading] = useState(false);

    //error state for graph generation(if returned by AI)//
    const [error, setError] = useState("");


    async function generateGraph() {

        // <<frontend dev >> //

        //raw note is sent to backend for graph generation//
        //backend returns graph json which is stored in graphData state//

        if (!rawNotes || rawNotes.trim() === "") {
            setError("Please write some notes before generating a graph.");
            return;
        } 

        setLoading(true);
        setError("");

        try{

            // <<Backend connection goes here >> //
            // frontend provides rawnotes: string //


            const response = await fetch("/api/graph", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ rawNotes:rawNotes }),
            });

            // << DAMON / KYLE BACKEND STUFF >> //
            // Backend should return a non-200 status
            // if graph generation fails

            if (!response.ok) {
                throw new Error("Graph generation failed. Please try again.");

        }

        // Hans AI RESPONSE //
        // Hans receives rawNotes from backend //
        // Hans must return graph information as JSON //
        const aiResponse = await fetch("http://localhost:8000/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawNotes: rawNotes })
        })

        // const data = await response.json();
        // Changing name for this response as we have multiple await fetch responses on this page and response.status can get confusing
        const data = await aiResponse.json();

        // <<frontend dev >> //
        // save returned graph json to graphData state for rendering in graph panel//
        setGraphData(data);

        // later cytoscape will use this data as  graphData.node and graphData.edges to render the graph//

    } catch (error) {

        // <<frontend dev >> //
        // error handling for graph generation failure//
        console.error("Graph generation error:", error);

        setError(
            "Unable to generate graph. Please try again."
        );

    } finally {
        // stop loading state after graph generation attempt and failed//
        setLoading(false);

    }

}

// <<frontend dev >> //
// page structure and rendering from data and function above //

return (

    <section className="graph-panel">
        <h2>Graph Panel</h2>

        <div className="graph-placeholder">

            {/* << JEET & DAVID FRONTEND DISPLAY >> */}

            {!graphData && !loading && (
                <p>Graph will appear here</p>)}


            {loading && (
               <p>Generating graph...</p>)}

            {error && (
                <p className="graph-error">{error}</p>)}

            {/* << CYTOSCAPE.JS GRAPH AREA >>
               Later we will replace this temporary
               JSON display with the real Cytoscape graph.
            */}

            {graphData && (
                <div className="graph-container">
                    {/* Render the Cytoscape graph here */}

                    <pre>{JSON.stringify(graphData, null, 2)}</pre>
                </div>
            )}

            <button onClick={generateGraph} disabled={loading}>

                {loading ? "Generating..." : "Generate Graph"}
            </button>

        </div>
    </section>
);
    
}

export default GraphPanel;

