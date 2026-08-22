import {useRef, useEffect ,useState} from 'react';
import cytoscape from 'cytoscape';

function GraphPanel({rawNotes}) {
    
    // <<frontend dev >> //
    //stores the graph Json returned from AI//
    const [graphData, setGraphData] = useState(null);

    //Used to handle graph loading time and state//
    const [loading, setLoading] = useState(false);

    //error state for graph generation(if returned by AI)//
    const [error, setError] = useState("");

    // << CYTOSCAPE FRONTEND >> //
    // References the HTML div where Cytoscape will render the graph //
    const graphContainerRef = useRef(null);




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

        // HANS AI GRAPH INTEGRATION //
        // HANS RECIEVES RAW NOTES FROM BACKEND AND RETURNS GRAPH JSON //

        // AI/BACKEND MUS RETURN GRAPH IN JSON FORMAT LIKE BELOW //
        // {
        //     nodes: [
        //         { data: { id: "1", label: "Node 1" } },
        //         { data: { id: "2", label: "Node 2" } },
        //     ],
        //     edges: [
        //         { data: { id: "e1", source: "1", target: "2" } },
        //     ],
        // }

        // NODE REQUIREMENTS //
        // Id is unique for each node
        // Label is the text displayed on the node

        // EDGE REQUIREMENTS //
        // Id is unique for each edge
        // Source is the id of the source node
        // Target is the id of the target node

        // <<frontend dev >> //
        // frontend expects:
        // graphData.nodes
        // graphData.edges
        // which will be used by cytoscape to render the graph//
        // As per current set up no more chnages from frontend side are required for graph rendering//
        // We will continue to add stlying but it should not affect the graph rendering as long as the graphData format is maintained//
        
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

        //cytoscape uses this data as  graphData.node and graphData.edges to render the graph//

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
// we will remove this test graph data once the backend is integrated and working properly//
    const testGraphData = {
    nodes: [
        { data: { id: "1", label: "React" } },
        { data: { id: "2", label: "JavaScript" } },
        { data: { id: "3", label: "Components" } },
    ],

    edges: [
        { data: { id: "e1", source: "1", target: "2" } },
        { data: { id: "e2", source: "1", target: "3" } },
    ],
    };

    setGraphData(testGraphData);
    return;




}

// <<frontend dev cytoscape>> // 

        useEffect(() => {
            if (!graphData || !graphContainerRef.current) {   
                return;
            }


            const cy = cytoscape({
                container: graphContainerRef.current,
                elements:[
                    ...graphData.nodes, 
                    ...graphData.edges, 
                ],

                layout: {
                    name: 'cose',
                    animate: true,
                    fit: true,
                    padding: 50,
                },
                
                style: [
                    {
                        selector: 'node',
                        style: {
                            'background-color': '#6366F1',
                            'label': 'data(label)',
                            'color': '#fff',
                            'text-valign': 'center',
                            'text-halign': 'center',    
                            'font-size': '12px',    
                        },  
                    },
                    {
                        selector: 'edge',
                        style: {
                            'width': 2, 
                            'line-color': '#64748b',
                            'target-arrow-color': '#64748b',    
                            'target-arrow-shape': 'triangle',
                            'curve-style': 'bezier',
                        },


                        


                    },
                
                ]
            });
            cy.one("layoutstop", () => {
                cy.resize();
                cy.fit(cy.elements(), 50);
            });

            return () => {
                cy.destroy();
            };

        }, [graphData]);


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

            <div
                ref={graphContainerRef}
                className="graph-container"
            >
            </div>

            <button onClick={generateGraph} disabled={loading}>

                {loading ? "Generating..." : "Generate Graph"}
            </button>

        </div>
    </section>
);
    
}

export default GraphPanel;

