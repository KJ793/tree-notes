import requests, json, re, logging

from .models import SummaryResponse, ConceptGraphResponse, SearchGraphResult

from ..schemas import SemanticSearchRequest

from .config import OLLAMA_URL, ACTIVE_MODEL

logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

summary_generation_templates = {
    "provide_summary": """
You are an expert summarisation assistant. Your task is to produce a clear, concise, and accurate summary based strictly on the information provided.

You will be given:
1. Raw Notes - the ground-truth source of information. This may be unstructured, incomplete, or poorly formatted.
2. Optional Graph Data - a JSON representation of concepts and relationships extracted from the Raw Notes. If provided, you may use it only to reinforce or clarify information already present in the Raw Notes.

Rules:
- Base your summary primarily on the Raw Notes.
- You may use Graph Data only when it supports or clarifies information already present in the Raw Notes.
- Do NOT invent new information or make assumptions beyond what is explicitly stated in the sources.
- Do NOT include headings or lists. Write in plain paragraph form.
- Your output must be concise and factual.
- Your output must be a valid JSON matching this exact schema:

```json
{"aiSummary": "<string>"}
```

Return ONLY the JSON object. Do NOT return any commentary, markdown fences, or explanations.

Your sources:
""",
    "provide_user_summary": """
You are an expert writing reviewer. Your task is to evaluate a user's summary based strictly on the information provided.

You will be given:
1. Raw Notes — the ground‑truth source of information. This may be unstructured, incomplete, or poorly formatted.
2. User Summary — the summary written by the user.

Your job:
- Identify whether the user's summary accurately reflects the Raw Notes.
- Point out any factual mistakes, omissions, or unsupported claims.
- Provide constructive, supportive feedback.
- Assign a score between 0 and 100 based on accuracy, clarity, and completeness.

Rules:
- Base your evaluation primarily on the Raw Notes.
- You may use Graph Data only when it supports or clarifies information already present in the Raw Notes.
- Do NOT invent new information or make assumptions beyond what is explicitly stated.
- Your feedback must be concise, supportive, and constructive.
- Your output must be valid JSON matching this exact schema:

```json
{"userSummaryReview": "<string>", "userScore": <integer>}
```

Return ONLY the JSON object. Do NOT return any commentary, markdown fences, or explanations.

Your sources:
"""
}

def graph_searching_template(wrapped_json) -> str:
    return f"""
You are searching for a node in a JSON representation of a graph. You're provided with JSON Input which has a "query" and a "graph" element.

The "query" element contains a string with one or multiple words.
The "graph" element contains a list of edges.
An edge is described by an edge id, an edge source (a node), and edge target (a different node), and the relationship between the nodes.

You are are to look for the query word or phrase from within the graph and edge items. Sometimes, the query can contain symbols or spelling mistakes; Remove symbols or correct spelling mistakes internally. Find the edge which contains the node or relationship most semantically relevant to the query.

Rule:
1. Return the SOURCE NODE if the query best matches either the source or relationship fields of the edge.
2. Otherwise, return the TARGET NODE if the query best matches the target node more than the source or relationship.
3. If the target and source nodes are equally matched, default to the source node.
4. Do NOT invent or replace the derived element from the schema into your answer: Your "found_node" must be EXACTLY verbatim to either a Source or Target from the edge.

Your output MUST be a valid JSON matching this exact schema:
{{"found_node": str, "score": float}}

If no node is semantically correlated with the query, return EXACTLY:
{{"found_node": "", "score": -1.0}}

Scoring:
- You MUST output a SEMANTIC SIMILARITY SCORE ("score")
- score MUST be a float between 0.00 and 1.00 and MUST include a leading zero(e.g., 0.92).
- 0.00 = no similarity.
- 1.00 = identical similarity.

EXAMPLE 1
Input: {{'query': 'traffic', 'graph': {{'edges': [{{'id': 'firewalls-unauthorized data', 'source': 'firewalls', 'target': 'unauthorized data', 'relationship': None}}, {{'id': 'unauthorized data-private computer networks', 'source': 'unauthorized data', 'target': 'private computer networks', 'relationship': None}}, {{'id': 'artificial intelligence-incoming traffic', 'source': 'artificial intelligence', 'target': 'incoming traffic', 'relationship': None}}, {{'id': 'systems-hidden digital threats', 'source': 'systems', 'target': 'hidden digital threats', 'relationship': None}}, {{'id': 'cyberattack-security protocols', 'source': 'cyberattack', 'target': 'security protocols', 'relationship': None}}, {{'id': 'security protocols-infected files', 'source': 'security protocols', 'target': 'infected files', 'relationship': None}}, {{'id': 'regular updates-systems', 'source': 'regular updates', 'target': 'systems', 'relationship': None}}, {{'id': 'systems-new viruses', 'source': 'systems', 'target': 'new viruses', 'relationship': None}}]}}}}
Output: {{"found_node": "incoming traffic", "score": 0.70}}
Note (NOT part of output): "traffic" is a strong semantic match to target node "incoming traffic" than the source node "artificial intelligence" so return target node instead.

EXAMPLE 2
Input: {{'query': 'squirrels', 'graph': {{'edges': [{{'id': 'firewalls-unauthorized data', 'source': 'firewalls', 'target': 'unauthorized data', 'relationship': None}}, {{'id': 'unauthorized data-private computer networks', 'source': 'unauthorized data', 'target': 'private computer networks', 'relationship': None}}, {{'id': 'artificial intelligence-incoming traffic', 'source': 'artificial intelligence', 'target': 'incoming traffic', 'relationship': None}}, {{'id': 'systems-hidden digital threats', 'source': 'systems', 'target': 'hidden digital threats', 'relationship': None}}, {{'id': 'cyberattack-security protocols', 'source': 'cyberattack', 'target': 'security protocols', 'relationship': None}}, {{'id': 'security protocols-infected files', 'source': 'security protocols', 'target': 'infected files', 'relationship': None}}, {{'id': 'regular updates-systems', 'source': 'regular updates', 'target': 'systems', 'relationship': None}}, {{'id': 'systems-new viruses', 'source': 'systems', 'target': 'new viruses', 'relationship': None}}]}}}}
Output: {{"found_node": "", "score": -1.00}}
Note (NOT part of output): "squirrels" cannot be meaningfully connected with any source, target, or relationship in any edge.

EXAMPLE 3
{{'query': 'core', 'graph': {{'edges': [{{'id': 'clouds-stars', 'source': 'clouds', 'target': 'stars', 'relationship': None}}, {{'id': 'clouds-dust-gas', 'source': 'clouds', 'target': 'dust-gas', 'relationship': None}}, {{'id': 'gravity-pressure', 'source': 'gravity', 'target': 'pressure', 'relationship': None}}, {{'id': 'gravity-temperature', 'source': 'gravity', 'target': 'temperature', 'relationship': None}}, {{'id': 'pressure-core', 'source': 'pressure', 'target': 'core', 'relationship': None}}, {{'id': 'temperature-core', 'source': 'temperature', 'target': 'core', 'relationship': None}}, {{'id': 'core-nuclear fusion', 'source': 'core', 'target': 'nuclear fusion', 'relationship': None}}, {{'id': 'nuclear fusion-new star', 'source': 'nuclear fusion', 'target': 'new star', 'relationship': None}}, {{'id': 'mass-brown dwarf star', 'source': 'mass', 'target': 'brown dwarf star', 'relationship': None}}]}}}}
Output: {{"found_node": "core", "score": 1.00}}
Note (NOT part of output): "core" is a direct match to an existing node "core"

EXAMPLE 4
Input: {{'query': 'ai', 'graph': {{'edges': [{{'id': 'firewalls-unauthorized data', 'source': 'firewalls', 'target': 'unauthorized data', 'relationship': None}}, {{'id': 'unauthorized data-private computer networks', 'source': 'unauthorized data', 'target': 'private computer networks', 'relationship': None}}, {{'id': 'artificial intelligence-incoming traffic', 'source': 'artificial intelligence', 'target': 'incoming traffic', 'relationship': None}}, {{'id': 'systems-hidden digital threats', 'source': 'systems', 'target': 'hidden digital threats', 'relationship': None}}, {{'id': 'cyberattack-security protocols', 'source': 'cyberattack', 'target': 'security protocols', 'relationship': None}}, {{'id': 'security protocols-infected files', 'source': 'security protocols', 'target': 'infected files', 'relationship': None}}, {{'id': 'regular updates-systems', 'source': 'regular updates', 'target': 'systems', 'relationship': None}}, {{'id': 'systems-new viruses', 'source': 'systems', 'target': 'new viruses', 'relationship': None}}]}}}}
Output: {{"found_node": "artificial intelligence", "score": 0.7}}
Note (NOT part of output): answer is the source node "artificial intelligence" because "AI" is a common abbreviation for "artificial intelligence".

Your Input:
{wrapped_json}
"""

# HELPER FUNCTIONS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def minify_json(json_obj: dict) -> str:
    try:
        return json.dumps(json_obj, separators=(',', ':'))
    except Exception:
        return "" # in case the model returned JSON malformed

def extract_json_object(text):
    depth = 0
    start = None

    for i, char in enumerate(text):
        if char == "{":
            if start is None:
                start = i
            depth += 1

        elif char == "}":
            depth -= 1

            if depth == 0 and start is not None:
                raw = text[start:i + 1]

                try:
                    return json.loads(raw), text[i + 1:]
                except json.JSONDecodeError:
                    pass
    return None, text

## OLLAMA PROMPTERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def create_payload(prompt: str, stream: bool):
    return { "model": ACTIVE_MODEL, "prompt": prompt, "stream": stream, "options": { "temperature": 0 } }

def run_ollama_prompt(prompt: str, is_json=True) -> dict:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt, stream=False))
    r.raise_for_status()
    raw = (
        r.json()
        .get("response", "")
        .strip()
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    return json.loads(raw) if is_json else raw

def open_ollama_stream(prompt: str) -> requests.Response:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt, stream=True), stream=True)
    r.raise_for_status()
    return r

def iter_graph_objects(prompt):
    response = open_ollama_stream(prompt)
    buffer = ""

    for line in response.iter_lines():
        if not line: continue

        chunk = json.loads(line)
        if "response" not in chunk: continue

        buffer += chunk["response"]

        while True:
            obj, remaining = extract_json_object(buffer)
            if obj is None: break
            yield obj
            buffer = remaining

# GRAPH GENERATION PIPELINE ~~~~~~~~~~~~~~~~~~~~~

def ai_generate_graph(text: str):
    node_prompt = f"""
    You are preparing a knowledge graph from a provided Source Text. You are required to extract the nodes of the graph, and provide a label.

    Your output must ONLY be the following json:
    {{"id":str, "label": str}}

    Produce your output in the same order in which the nodes appear from the text.

    EXAMPLE 1
    Source Text: "Stars form inside massive clouds of dust and gas called nebulas. Gravity pulls this material closely together, causing pressure and temperature to rise in the core. When the core gets hot enough, nuclear fusion triggers, allowing a bright new star to ignite. Without enough mass, the process fails, and a weak brown dwarf forms instead."
    Output: {{"id": "stars", "label": "stars"}},{{"id": "clouds", "label": "clouds"}},{{"id": "dust-gas", "label": "dust and gas"}},{{"id": "gravity", "label": "gravity"}},{{"id": "pressure", "label": "pressure"}},{{"id": "temperature", "label": "temperature"}},{{"id": "core", "label": "core"}},{{"id": "nuclear fusion", "label": "nuclear fusion"}},{{"id": "new star", "label": "new star"}},{{"id": "mass", "label": "mass"}},{{"id": "brown dwarf star", "label": "brown dwarf star"}}

    EXAMPLE 2
    Source Text: "Brains process new information by forming temporary neural connections during the day. Sleep stabilizes these fragile links, allowing short-term memories to move into permanent storage. When sleep is disrupted, this critical consolidation process fails, making it difficult to recall facts. Without enough rest, people struggle to retain new knowledge and focus."
    Output: {{"id": "brains", "label": "brains"}},{{"id": "new information", "label": "new information"}},{{"id": "temporary neural connections", "label": "temporary neural connections"}},{{"id": "sleep", "label": "sleep"}},{{"id": "short-term memories", "label": "short-term memories"}},{{"id": "permanent storage", "label": "permanent storage"}},{{"id": "consolidation process", "label": "consolidation process"}},{{"id": "facts", "label": "facts"}},{{"id": "rest", "label": "rest"}},{{"id": "people", "label": "people"}},{{"id": "new knowledge", "label": "new knowledge"}},{{"id": "focus", "label": "focus"}}

    EXAMPLE 3
    Source Text: "Firewalls block unauthorized data from entering private computer networks. Artificial intelligence monitors this incoming traffic, allowing systems to catch hidden digital threats instantly. When a cyberattack occurs, security protocols isolate the infected files to stop the spread. Without regular updates, systems become vulnerable and struggle to defend against new viruses."
    Output: {{"id": "firewalls", "label": "firewalls"}},{{"id": "unauthorized data", "label": "unauthorized data"}},{{"id": "private computer networks", "label": "private computer networks"}},{{"id": "artificial intelligence", "label": "artificial intelligence"}},{{"id": "incoming traffic", "label": "incoming traffic"}},{{"id": "systems", "label": "systems"}},{{"id": "hidden digital threats", "label": "hidden digital threats"}},{{"id": "cyberattack", "label": "cyberattack"}},{{"id": "security protocols", "label": "security protocols"}},{{"id": "infected files", "label": "infected files"}},{{"id": "regular updates", "label": "regular updates"}},{{"id": "new viruses", "label": "new viruses"}}

    EXAMPLE 4
    Source Text: "Wolves hunt in highly organized packs to bring down large prey. Alpha leaders coordinate the chase, allowing the group to surround targets without being spotted. When a target is isolated, the younger wolves move in to complete the hunt. Without a clear social hierarchy, the pack becomes chaotic and struggles to secure food."
    Output: {{"id": "wolves", "label": "wolves"}},{{"id": "organized packs", "label": "organized packs"}},{{"id": "large prey", "label": "large prey"}},{{"id": "alpha leaders", "label": "alpha leaders"}},{{"id": "chase", "label": "chase"}},{{"id": "group", "label": "group"}},{{"id": "targets", "label": "targets"}},{{"id": "younger wolves", "label": "younger wolves"}},{{"id": "hunt", "label": "hunt"}},{{"id": "social hierarchy", "label": "social hierarchy"}},{{"id": "pack", "label": "pack"}},{{"id": "food", "label": "food"}}

    Your Source Text from which to extract Nodes:
    {text}
    """
    nodes = []
    for n in iter_graph_objects(node_prompt):
        nodes.append(n)
        yield {"type": "node", "data": n}

    edge_prompt = f"""
    You are preparing a knowledge graph from a provided Source Text and a given list of Nodes. You are required to extract the edges of the graph, providing a source node, target, node, and their relationship ("label").

    Your output must ONLY be the following json:
    {{"id":str, "source":str, "target": str, "label": str}}

    RULES
    1. The Source Text is your Ground Truth Reference materials; the Node List are the concepts from the Source Text between which relationships should exist.
    2. Do NOT invent or force relationships that are not explicitly presented by the Source Text.
    3. Do NOT invent new Nodes: The Node List is IMMUTABLE.
    4. If a Node from the Node List doesn't have an explicit verb which relates it with another Node List item, leave it; Do NOT force a connection when one doesn't exist.
    5. The edge "id" field is simply the "source" and "target" conjoined with a '-' hyphen character.
    6. The edge "source" and "target" fields must be derived verbatim from the Nodes List.
    7. The edge "relation" must be derived from the Source Text ONLY; if a long phrase is used in the Text as the relationship (label), shorten it to within 1-3 words (by dropping terms like "the", "its", pronouns, etc)

    Produce your output in the order in which nodes appear in the Nodes List, seeking for their contextual references in the Source Text.

    Suggested Workflow:
    1. Retrieve node list item i.
    2. Look in the Source Text for verbs connecting node[i] with other nodes from the Node List.
    3. From the Source Text: if node[i] has a verb or connection to another concept which is EXCLUDED from the Node List, LEAVE IT and move to the next connecting item in the Source Text.
    4. From the Source Text: if node[i] has a verb or connection to another concept which is INCLUDED from the Node List, OUTPUT that edge connection, and move to the next connecting item in the Source Text.
    5. Continue process for each item in the Node List.

    EXAMPLE 1
    Source Text: "Stars form inside massive clouds of dust and gas called nebulas. Gravity pulls this material closely together, causing pressure and temperature to rise in the core. When the core gets hot enough, nuclear fusion triggers, allowing a bright new star to ignite. Without enough mass, the process fails, and a weak brown dwarf forms instead."
    Node List: [{{"id": "stars", "label": "stars"}},{{"id": "clouds", "label": "clouds"}},{{"id": "dust-gas", "label": "dust and gas"}},{{"id": "gravity", "label": "gravity"}},{{"id": "pressure", "label": "pressure"}},{{"id": "temperature", "label": "temperature"}},{{"id": "core", "label": "core"}},{{"id": "nuclear fusion", "label": "nuclear fusion"}},{{"id": "new star", "label": "new star"}},{{"id": "mass", "label": "mass"}},{{"id": "brown dwarf star", "label": "brown dwarf star"}}]
    Output: {{"id":"clouds-stars", "source":"clouds", "target": "stars", "label": "form"}}, {{"id":"clouds-dust-gas", "source":"clouds", "target": "dust-gas", "label": "are nebulas of"}}, {{"id":"gravity-pressure", "source":"gravity", "target": "pressure", "label": "pulls material"}}, {{"id":"gravity-temperature", "source":"gravity", "target": "temperature", "label": "pulls material"}}, {{"id":"pressure-core", "source":"pressure", "target": "core", "label": "rise"}}, {{"id":"temperature-core", "source":"temperature", "target": "core", "label": "rise"}}, {{"id":"core-nuclear fusion", "source":"core", "target": "nuclear fusion", "label": "hot enough"}}, {{"id":"nuclear fusion-new star", "source":"nuclear fusion", "target": "new star", "label": "ignite"}}, {{"id":"mass-brown dwarf star", "source":"mass", "target": "brown dwarf star", "label": "without enough process fails"}}

    EXAMPLE 2
    Source Text: "Brains process new information by forming temporary neural connections during the day. Sleep stabilizes these fragile links, allowing short-term memories to move into permanent storage. When sleep is disrupted, this critical consolidation process fails, making it difficult to recall facts. Without enough rest, people struggle to retain new knowledge and focus."
    Node List: [{{"id": "brains", "label": "brains"}},{{"id": "new information", "label": "new information"}},{{"id": "temporary neural connections", "label": "temporary neural connections"}},{{"id": "sleep", "label": "sleep"}},{{"id": "short-term memories", "label": "short-term memories"}},{{"id": "permanent storage", "label": "permanent storage"}},{{"id": "consolidation process", "label": "consolidation process"}},{{"id": "facts", "label": "facts"}},{{"id": "rest", "label": "rest"}},{{"id": "people", "label": "people"}},{{"id": "new knowledge", "label": "new knowledge"}},{{"id": "focus", "label": "focus"}}]
    Output: {{"id":"brains-new information", "source":"brains", "target": "new information", "label": "process"}}, {{"id":"brains-temporary neural connections", "source":"brains", "target": "temporary neural connections", "label": "forming"}}, {{"id":"sleep-temporary neural connections", "source":"sleep", "target": "temporary neural connections", "label": "stabilizes"}}, {{"id":"sleep-short-term memories", "source":"sleep", "target": "short-term memories", "label": "stabilizes"}}, {{"id":"short-term memories-permanent storage", "source":"short-term memories", "target": "permanent storage", "label": "move into"}}, {{"id":"consolidation process-facts", "source":"consolidation process", "target": "facts", "label": "recall"}}, {{"id":"rest-new knowledge", "source":"rest", "target": "new knowledge", "label": "without enough struggle to retain"}}, {{"id":"rest-focus", "source":"rest", "target": "focus", "label": "without enough struggle to"}}

    EXAMPLE 3
    Source Text: "Firewalls block unauthorized data from entering private computer networks. Artificial intelligence monitors this incoming traffic, allowing systems to catch hidden digital threats instantly. When a cyberattack occurs, security protocols isolate the infected files to stop the spread. Without regular updates, systems become vulnerable and struggle to defend against new viruses."
    Node List: [{{"id": "firewalls", "label": "firewalls"}},{{"id": "unauthorized data", "label": "unauthorized data"}},{{"id": "private computer networks", "label": "private computer networks"}},{{"id": "artificial intelligence", "label": "artificial intelligence"}},{{"id": "incoming traffic", "label": "incoming traffic"}},{{"id": "systems", "label": "systems"}},{{"id": "hidden digital threats", "label": "hidden digital threats"}},{{"id": "cyberattack", "label": "cyberattack"}},{{"id": "security protocols", "label": "security protocols"}},{{"id": "infected files", "label": "infected files"}},{{"id": "regular updates", "label": "regular updates"}},{{"id": "new viruses", "label": "new viruses"}}]
    Output: {{"id":"firewalls-unauthorized data", "source":"firewalls", "target": "unauthorized data", "label": "block"}}, {{"id":"unauthorized data-private computer networks", "source":"unauthorized data", "target": "private computer networks", "label": "entering"}}, {{"id":"artificial intelligence-incoming traffic", "source":"artificial intelligence", "target": "incoming traffic", "label": "monitors"}}, {{"id":"systems-hidden digital threats", "source":"systems", "target": "hidden digital threats", "label": "catch"}}, {{"id":"cyberattack-security protocols", "source":"cyberattack", "target": "security protocols", "label": "triggers"}}, {{"id":"security protocols-infected files", "source":"security protocols", "target": "infected files", "label": "isolate"}}, {{"id":"regular updates-systems", "source":"regular updates", "target": "systems", "label": "without become vulnerable"}}, {{"id":"systems-new viruses", "source":"systems", "target": "new viruses", "label": "struggle to defend against"}}

    EXAMPLE 4
    Source Text: "Wolves hunt in highly organized packs to bring down large prey. Alpha leaders coordinate the chase, allowing the group to surround targets without being spotted. When a target is isolated, the younger wolves move in to complete the hunt. Without a clear social hierarchy, the pack becomes chaotic and struggles to secure food."
    Node List: [{{"id": "wolves", "label": "wolves"}},{{"id": "organized packs", "label": "organized packs"}},{{"id": "large prey", "label": "large prey"}},{{"id": "alpha leaders", "label": "alpha leaders"}},{{"id": "chase", "label": "chase"}},{{"id": "group", "label": "group"}},{{"id": "targets", "label": "targets"}},{{"id": "younger wolves", "label": "younger wolves"}},{{"id": "hunt", "label": "hunt"}},{{"id": "social hierarchy", "label": "social hierarchy"}},{{"id": "pack", "label": "pack"}},{{"id": "food", "label": "food"}}]
    Output: {{"id":"wolves-organized packs", "source":"wolves", "target": "organized packs", "label": "hunt in"}}, {{"id":"organized packs-large prey", "source":"organized packs", "target": "large prey", "label": "bring down"}}, {{"id":"alpha leaders-chase", "source":"alpha leaders", "target": "chase", "label": "coordinate"}}, {{"id":"group-targets", "source":"group", "target": "targets", "label": "surround"}}, {{"id":"younger wolves-hunt", "source":"younger wolves", "target": "hunt", "label": "move in to complete"}}, {{"id":"social hierarchy-pack", "source":"social hierarchy", "target": "pack", "label": "without becomes chaotic"}}, {{"id":"pack-food", "source":"pack", "target": "food", "label": "struggles to secure"}}

    Your Source Text:
    {text}

    Your Node List:
    {json.dumps(nodes)}
    """
    edges_count = 0
    for e in iter_graph_objects(edge_prompt):
        edges_count += 1
        yield {"type": "edge", "data": e}

    yield {"type": "done", "stats": {"nodes": len(nodes), "edges": edges_count}}

    return


### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## AI Generate Summary Content ~~~~~

def ai_generate_summary(raw_data: str, graph_json: dict, user_summary: str) -> SummaryResponse:

    response: SummaryResponse = { "aiSummary": "", "userSummaryReview": "", "userScore": 0 }

    combined_summary_sources = "\n<<<"
    combined_summary_sources += "\n1. Raw Notes:\n" + raw_data

    if graph_json != {}: combined_summary_sources += "\n2. Optional Graph Data:\n" + minify_json(graph_json)

    combined_summary_sources += "\n>>>"

    developed_summary_prompt = (summary_generation_templates["provide_summary"] + combined_summary_sources)

    ai_summary_json = run_ollama_prompt(developed_summary_prompt)
    response["aiSummary"] = ai_summary_json.get("aiSummary", "")

    if user_summary.strip() == "": return response # return early

    # continue to prepare the user review and score
    combined_review_sources = "\n<<<"
    combined_review_sources += "\n1. Raw Notes:\n" + raw_data
    combined_review_sources += "\n2. User Summary:\n" + user_summary
    combined_review_sources += "\n>>>"

    developed_review_prompt = (summary_generation_templates["provide_user_summary"] + combined_review_sources)

    ai_user_review_json = run_ollama_prompt(developed_review_prompt)
    response["userScore"] = ai_user_review_json.get("userScore", 0)
    response["userSummaryReview"] = ai_user_review_json.get("userSummaryReview", "")

    return response

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## AI Searching JSON Graph ~~~~~~~~~

def ai_search_graph(search_input: str, json_graph: dict) -> SearchGraphResult:
    edges = []
    for e in json_graph["edges"]:
        edges.append({"id": e["id"], "source": e["source"], "target": e["target"], "relationship": e["label"]})

    wrapped_json = {"query" :search_input, "graph": edges}

    json_str = minify_json(wrapped_json)
    search_result = run_ollama_prompt(graph_searching_template(json_str))
    for node in json_graph["nodes"]:
        if node["label"].lower() == search_result["found_node"].lower():
            return {
                "node_id": node["id"],
                "label": node["label"],
                "score": search_result["score"]
            }

    return { "node_id": -1, "label": "", "score": -1.0 }

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

