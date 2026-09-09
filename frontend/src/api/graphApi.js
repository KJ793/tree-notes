/* =========================================================
   GRAPH API
   =========================================================

   TEMPORARY FRONTEND DEVELOPMENT MODE
   -----------------------------------
   While USE_MOCK_GRAPH_API is true, semantic graph search
   uses temporary frontend mock matching.

   This allows the frontend to demonstrate:

   - opening semantic search
   - searching for a graph concept
   - selecting/focusing the matched Cytoscape node
   - successful search feedback
   - no-match/error feedback

   WITHOUT requiring the AI/backend search service yet.

   Once the backend endpoint is implemented, simply set:

       const USE_MOCK_GRAPH_API = false;

   GraphPanel does NOT need to change.

   Expected backend endpoint:

       POST /api/notes/:noteId/graph/search

   Recommended future graph persistence endpoints:

       GET /api/notes/:noteId/graph
       PUT /api/notes/:noteId/graph
   ========================================================= */


const USE_MOCK_GRAPH_API = true;


/*
  Optional backend URL.

  If VITE_API_URL is not defined, requests use:

      /api

  Example .env later:

      VITE_API_URL=http://localhost:3000/api
*/
const API_BASE =
  import.meta.env.VITE_API_URL ??
  "/api";



/* =========================================================
   TEMPORARY MOCK SEMANTIC SEARCH
   =========================================================

   These search terms exist ONLY for frontend development.

   They correspond to the JavaScript node in the current
   mock Cytoscape graph:

       node_id: "2"
       label: "JavaScript"

   The backend will eventually replace this with real
   fuzzy / semantic / embedding-based matching.
   ========================================================= */

const MOCK_SEMANTIC_MATCHES = [
  "java",
  "script",
  "programming",
];


const MOCK_JAVASCRIPT_NODE = {
  node_id: "2",
  label: "JavaScript",
  score: 0.95,
};



/* =========================================================
   BACKEND RESPONSE HELPER
   ========================================================= */

async function handleApiResponse(
  response,
  fallbackMessage
) {

  if (!response.ok) {

    let message =
      fallbackMessage;


    try {

      const data =
        await response.json();


      message =
        data.message ??
        data.error ??
        message;

    } catch {

      /*
        Backend did not return JSON.

        Continue using the fallback message.
      */

    }


    throw new Error(message);
  }


  /*
    Some future graph operations may return
    HTTP 204 with no response body.
  */
  if (response.status === 204) {
    return null;
  }


  return response.json();
}



/* =========================================================
   SEARCH RESULT NORMALISATION
   =========================================================

   Keeps the frontend contract predictable.

   GraphPanel expects:

       {
         match: {
           node_id: "2",
           label: "JavaScript",
           score: 0.95
         }
       }

   or:

       {
         match: null
       }

   Cytoscape node IDs are treated as strings, so this also
   converts numeric database IDs if necessary.
   ========================================================= */

function normaliseSearchResult(data) {

  const match =
    data?.match ??
    null;


  if (!match) {
    return {
      match: null,
    };
  }


  return {
    match: {

      ...match,

      node_id:
        String(
          match.node_id
        ),

      label:
        match.label ??
        "",

      score:
        match.score ??
        null,
    },
  };
}



/* =========================================================
   SEMANTIC GRAPH SEARCH
   =========================================================

   FRONTEND USAGE:

       const result =
         await semanticSearchGraph(
           noteId,
           query
         );


   ---------------------------------------------------------
   MOCK MODE
   ---------------------------------------------------------

   Searches containing:

       java
       script
       programming

   currently return:

       JavaScript
       node_id "2"

   Any other search returns:

       match: null


   ---------------------------------------------------------
   BACKEND MODE
   ---------------------------------------------------------

   POST:

       /api/notes/:noteId/graph/search

   Request:

       {
         "query": "java"
       }

   Recommended successful backend response:

       {
         "match": {
           "node_id": "2",
           "label": "JavaScript",
           "score": 0.95
         }
       }

   No semantic match:

       {
         "match": null
       }

   ========================================================= */

export async function semanticSearchGraph(
  noteId,
  query
) {

  const normalizedQuery =
    query
      .trim()
      .toLowerCase();



  /* =======================================================
     TEMPORARY MOCK IMPLEMENTATION
     ======================================================= */

  if (USE_MOCK_GRAPH_API) {

    console.log(
      "Mock semantic graph search:",
      {
        noteId,
        query,
      }
    );


    /*
      Simulates a short AI/backend delay so the
      loading feedback can be demonstrated.
    */
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          500
        )
    );


    /*
      Empty query should never normally arrive here because
      GraphPanel already prevents it, but this keeps the
      mock API defensive.
    */
    if (!normalizedQuery) {

      return {
        match: null,
      };
    }


    const hasMockMatch =
      MOCK_SEMANTIC_MATCHES.some(
        (keyword) =>
          normalizedQuery.includes(
            keyword
          )
      );


    if (hasMockMatch) {

      return {
        match: {
          ...MOCK_JAVASCRIPT_NODE,
        },
      };
    }


    return {
      match: null,
    };
  }



  /* =======================================================
     REAL BACKEND IMPLEMENTATION
     ======================================================= */

  if (!noteId) {

    throw new Error(
      "A note ID is required to search the graph."
    );
  }


  if (!normalizedQuery) {

    throw new Error(
      "A search query is required."
    );
  }


  const response =
    await fetch(
      `${API_BASE}/notes/${noteId}/graph/search`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        /*
          Assumes authentication currently uses
          the user's session cookie.
        */
        credentials:
          "include",

        body:
          JSON.stringify({
            query:
              query.trim(),
          }),
      }
    );


  const data =
    await handleApiResponse(
      response,
      "Unable to search the graph."
    );


  return normaliseSearchResult(
    data
  );
}



/* =========================================================
   FUTURE: LOAD SAVED GRAPH
   =========================================================

   This is ready for backend integration but does not
   interfere with the current mock graph inside GraphPanel.

   Backend endpoint:

       GET /api/notes/:noteId/graph

   Suggested response:

       {
         "nodes": [...],
         "edges": [...]
       }

   You do NOT need to use this function in GraphPanel yet.
   ========================================================= */

export async function getGraph(
  noteId
) {

  if (USE_MOCK_GRAPH_API) {

    /*
      Current mock graph data still lives inside
      GraphPanel.jsx.

      Returning null here makes it explicit that graph
      persistence has not been connected yet.
    */
    console.log(
      "Mock graph load skipped:",
      {
        noteId,
      }
    );


    return null;
  }


  const response =
    await fetch(
      `${API_BASE}/notes/${noteId}/graph`,
      {
        method: "GET",

        credentials:
          "include",
      }
    );


  return handleApiResponse(
    response,
    "Unable to load graph."
  );
}



/* =========================================================
   FUTURE: SAVE GRAPH
   =========================================================

   Intended for the Navbar Save workflow later.

   Backend endpoint:

       PUT /api/notes/:noteId/graph

   Example graphData:

       {
         "nodes": [
           {
             "id": "1",
             "label": "React",
             "color": "#6366f1",
             "shape": "rectangle",
             "position": {
               "x": 250,
               "y": 160
             }
           }
         ],

         "edges": [
           {
             "id": "edge-1",
             "source": "1",
             "target": "2"
           }
         ]
       }

   This function can remain unused until graph persistence
   is connected.
   ========================================================= */

export async function saveGraph(
  noteId,
  graphData
) {

  if (USE_MOCK_GRAPH_API) {

    /*
      We currently do NOT persist the mock Cytoscape graph.

      Keeping this as a harmless development stub means the
      real API contract is already documented without
      changing current frontend behaviour.
    */
    console.log(
      "Mock graph save:",
      {
        noteId,
        graphData,
      }
    );


    return graphData;
  }


  const response =
    await fetch(
      `${API_BASE}/notes/${noteId}/graph`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        credentials:
          "include",

        body:
          JSON.stringify(
            graphData
          ),
      }
    );


  return handleApiResponse(
    response,
    "Unable to save graph."
  );
}