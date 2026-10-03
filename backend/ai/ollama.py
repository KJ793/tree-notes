from typing import cast, Iterator, Optional

import requests, json
from .models import SummaryResponse, ConceptGraphResponse, SearchGraphResult
from ..schemas import SemanticSearchRequest
from .config import OLLAMA_URL, ACTIVE_MODEL

from .models import NodeEvent, EdgeEvent, DoneEvent, GraphEvent
from collections import Counter

### Simple Prompts for use in Frontend Testing
(
    # Roses grow best in sunny gardens. Bees are attracted to their bright colors and sweet fragrance. When bees visit roses, they help pollinate the flowers, allowing new blooms to form. Without enough sunlight or pollination, roses struggle to grow strong and healthy.

    # Cacti store water in their thick stems to survive in hot deserts. Their spines protect them from animals and help reduce water loss. When rainfall occurs, cacti absorb moisture quickly, allowing them to grow new stems. Without enough sunlight, cacti become weak and struggle to thrive.

    # Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.

    # Volcanoes erupt when pressure builds beneath the Earth’s crust, forcing molten rock and gases upward. Lava flows from the crater, destroying vegetation, reshaping the landscape, and creating new rock formations as it cools. Ash clouds rise high into the atmosphere, reducing air quality, blocking sunlight, and sometimes altering local temperatures for days or weeks. Volcanic eruptions also release gases such as sulfur dioxide, which can combine with moisture to form acidic aerosols that affect nearby ecosystems. As the eruption subsides, minerals within the lava and ash enrich the soil, making the surrounding area highly fertile. This nutrient‑rich ground supports rapid plant regrowth, and many pioneer species quickly colonize the fresh terrain. Over time, repeated eruptions build layered volcanic cones, and the cooled lava flows can redirect rivers, create new valleys, or form natural barriers. Some eruptions even generate pyroclastic flows—fast‑moving currents of hot gas and debris—that further shape the environment before eventually contributing to long‑term soil formation.

    # Spiders are air‑breathing arthropods with eight legs, fangs capable of delivering venom, and spinnerets that produce silk. They form the largest arachnid order and occur worldwide except Antarctica, occupying nearly all terrestrial habitats. Over fifty thousand species are recognized, though their family‑level classification has been repeatedly revised for more than a century. Their bodies consist of two fused segments joined by a narrow pedicel, and debates persist over whether traditional terms like “cephalothorax” and “abdomen” accurately describe these structures. Spiders lack antennae and, except for the most primitive lineages, possess a highly centralized nervous system. They extend their limbs hydraulically rather than with extensor muscles. Spinnerets on the abdomen release multiple types of silk, enabling diverse web architectures ranging from orb webs to tangled cobwebs. Spider ancestors with silk‑producing structures appeared in the Devonian, while true spiders date to the Carboniferous. Modern groups such as Mygalomorphae and Araneomorphae emerged in the Triassic. Nearly all species are predators, consuming insects, other spiders, and occasionally small vertebrates. Their collective ecological impact is enormous, with global predation estimated in the hundreds of millions of tons annually. Spiders capture prey using varied strategies including sticky webs, bolas, mimicry, and active pursuit. Many rely on vibration sensing, while visually oriented hunters—especially those in the genus Portia—display notable problem‑solving abilities. Because their digestive system cannot process solids, spiders liquefy prey externally before ingestion. Males perform complex courtship behaviors to avoid being mistaken for prey by larger females. Females produce silk egg sacs containing numerous offspring and may provide extended care. A minority of species live communally, forming large shared webs and sometimes cooperating in hunting. Lifespans vary widely: most spiders live only a few years, but some mygalomorphs exceed two decades. Spider venom has medical and agricultural research value, and spider silk remains a model for high‑performance biomaterials.

    # Spiders (order Araneae) are air-breathing arthropods that have eight limbs, chelicerae with fangs generally able to inject venom, and spinnerets that extrude silk. They are the largest order of arachnids and rank seventh in total species diversity among all orders of organisms. Spiders are found worldwide on every continent except Antarctica, and have become established in nearly every land habitat. As of January 2026, 53,680 spider species in 139 families have been recorded by taxonomists. However, there has been debate among scientists about how families should be classified, with over 20 different classifications proposed since 1900. Anatomically, spiders (as with all arachnids) differ from other arthropods in that the usual body segments are fused into two tagmata, the cephalothorax or prosoma, and the opisthosoma, or abdomen, and joined by a small, cylindrical pedicel. However, as there is currently neither paleontological nor embryological evidence that spiders ever had a separate thorax-like division, there exists an argument against the validity of the term cephalothorax, which means fused cephalon (head) and the thorax. Similarly, arguments can be formed against the use of the term "abdomen", as the opisthosoma of all spiders contains a heart and respiratory organs, organs atypical of an abdomen. Unlike insects, spiders do not have antennae. In all except the most primitive group, the Mesothelae, spiders have the most centralized nervous systems of all arthropods, as all their ganglia are fused into one mass in the cephalothorax. Unlike most arthropods, spiders have no extensor muscles in their limbs and instead extend them by hydraulic pressure. Their abdomens bear appendages, modified into spinnerets that extrude silk from up to six types of glands. Spider webs vary widely in size, shape and the amount of sticky thread used. It now appears that the spiral orb web may be one of the earliest forms, and spiders that produce tangled cobwebs are more abundant and diverse than orb-weaver spiders. Spider-like arachnids with silk-producing spigots (Uraraneida) appeared in the Devonian period, about 386 million years ago, but these animals apparently lacked spinnerets. True spiders have been found in Carboniferous rocks from 318 to 299 million years ago and are very similar to the most primitive surviving suborder, the Mesothelae. The main groups of modern spiders, Mygalomorphae and Araneomorphae, first appeared in the Triassic period, more than 200 million years ago. The species Bagheera kiplingi was described as herbivorous in 2008, but all other known species are predators, mostly preying on insects and other spiders, although a few large species also take birds and lizards. An estimated 25 million tons of spiders kill 400–800 million tons of prey every year. Spiders use numerous strategies to capture prey: trapping it in sticky webs, lassoing it with sticky bolas, mimicking the prey to avoid detection, or running it down. Most detect prey mainly by sensing vibrations, but the active hunters have acute vision and hunters of the genus Portia show signs of intelligence in their choice of tactics and ability to develop new ones.
)

import logging
logging.basicConfig(level=logging.INFO,format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

### Prompt Templates ~~~~~~~~~~~~~~~

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

def s1(text) -> str:
    return f"""
We are preparing a Source Text for knowledge graph generation. Rewrite the Source Text as "semantic units". Break the Source Text apart into separate semantic units, verbatim, without modification of any word.

DEFINITION
A semantic unit is one short statement of what the text says: who does what, what soemthing is or becomes, what happens, under what condition, for what purpose, etc.

RULES
1. Output units in the order of the Source Text. Ignore any markdown symbols such as "#".
2. NEVER drop a clause. Every verb in the Source Text must appear in a unit. Purpose clauses (e.g. "to hunt fish") and consequence clauses ("allowing X to ...") stay inside their unit.
3. Keep each clause's subject, verb, and nouns Exactly as written in the Source Text. NEVER add a verb the Text does not use especially "have", "has", "is", "are", "do", etc.
4. Keep every condition (e.g. when, if, without, until, after, at, during, etc) with the unit it governs.
5. Keep words that change the meaning (e.g. not, cannot, can, may, sometimes, most, all, only, enough, etc).
6. Leave coordinated verbs, subjects, objects, and conditions (e.g. "and", "or", "but") together in one unit.
7. Do NOT add facts, reasons, or linking words (e.g. "because", "so", "makes", "causes", etc).
8. Lowercase, except propert nouns. No full stops.

EXAMPLE 1
Source Text: "Deer grow thick coats in winter. Their antlers protect them from wolves and help them find mates."
Output: {{"semantic_units": ["deer grow thick coats in winter", "their antlers protect them from wolves and help them find mates"]}}

EXAMPLE 2
Source Text: "When the river floods, frogs lay eggs in shallow pools, allowing their tadpoles to hatch. At night, herons leave their nests to hunt fish."
Output: {{"semantic_units": ["when the river floods, frogs lay eggs in shallow pools, allowing their tadpoles to hatch", "at night, herons leave their nests to hunt fish"]}}

EXAMPLE 3
Source Text: "Fish cannot breathe air, but they can in the water. Without oxygen, water becomes unhealthy and many of them die."
Output: {{"semantic_units": ["fish cannot breathe air, but they can in the water", "without oxygen, water becomes unhealthy and many of them die"]}}

EXAMPLE 4
Source Text: "Kites fly in open fields, and children chase them across the grass. When wind drops, they fall to the ground. Their tails trail behind."
Output: {{"semantic_units": ["kites fly in open fields", "children chase them across the grass", "when wind drops, they fall to the ground", "their tails trail behind"]}}

Output JSON only
{{"semantic_units": [str, ...]}}
No commentary, markdown, or explanations.

SOURCE TEXT
{text}
"""

def s2(text, sem_units_json) -> str:
    return f"""
We are trying to identify pronouns and repair semantic units by resolving pronouns. You ONLY use the Source Text as the ground truth reference material. The Semantic Units are what you are needing to repair. If the Semantic Unit has no pronoun which needs to be resolved, leave it unchanged; Do NOT leave any pronoun unresolved. No pronoun may remain in a clause: replace every pronoun, including ones the unit dropped but the Source Text has, with the noun to which it refers.

EXAMPLE 1
Source Text: "When the river floods, frogs lay eggs in shallow pools, allowing their eggs to hatch. At night, herons leave their nests to hunt fish."
Semantic Units: ["when the river floods, frogs lay eggs in shallow pools, allowing their eggs to hatch", "at night, herons leave their nests to hunt fish"]
Output: [{{"unit":"when the river floods, frogs lay eggs in shallow pools, allowing their eggs to hatch","clause":"when the river floods, frogs lay eggs in shallow pools, allowing frogs' eggs to hatch"}},{{"unit":"at night, herons leave their nests to hunt fish","clause":"at night, herons leave herons' nests to hunt fish"}}]

EXAMPLE 2
Source Text: "During the winter, deer grow thick coats. While alive, Their antlers protect them from wolves and help them find mates."
Semantic Units: ["during the winter, deer grow thick coats", "while alive, their antlers protect them from wolves and help them find mates"]
Output: [{{"unit":"during the winter, deer grow thick coats","clause":"during the winter, deer grow thick coats"}},{{"unit":"while alive, their antlers protect them from wolves and help them find mates","clause":"while alive, deer's antlers protect deer from wolves and help deer find mates"}}]

EXAMPLE 3
Source Text: "Bats sleep in caves. Their wings fold tightly. At dusk, they hunt insects. The caves stay cool."
Semantic Units: ["bats sleep in caves", "wings fold tightly", "at dusk, they hunt insects", "the caves stay cool"]
Output: [{{"unit":"bats sleep in caves","clause":"bats sleep in caves"}},{{"unit":"wings fold tightly","clause":"bats' wings fold tightly"}},{{"unit":"at dusk, they hunt insects","clause":"at dusk, bats hunt insects"}},{{"unit":"the caves stay cool","clause":"the caves stay cool"}}]

EXAMPLE 4
Source Text: "Squirrels bury their nuts in soil to hide them from thieves."
Semantic Units: ["squirrels bury their nuts in soil to hide them from thieves"]
{{"unit":"squirrels bury their nuts in soil to hide them from thieves","clause":"squirrels bury squirrels' nuts in soil to hide nuts from thieves"}}

EXAMPLE 5
Source Text: "Ducks swim on ponds. Without food or shelter, the ducklings grow weak."
Semantic Units: ["ducks swim on ponds", "without food or shelter, the ducklings grow weak"]
Output: [{{"unit":"ducks swim on ponds","clause":"ducks swim on ponds"}},{{"unit":"without food or shelter, the ducklings grow weak","clause":"without food or shelter, the ducklings grow weak"}}]

ONLY output in the format of the example json. The JSON is a list of json objects. This is its structure:
[{{"unit":str,"clause":str}},...]

SOURCE TEXT
{text}

SEMANTIC UNITS
{sem_units_json}
"""

def s3(clauses_json) -> str:
    return f"""
Split each clause into the simple clauses it contains, and report its opening phrase.

"opening": the condition or time phrase at the very start of the clause, before the subject, copied exactly as written. Leave it empty if the clause starts with its subject. The opening is added back to every entry later, so never put it inside "resolutions".

"resolutions": one entry per simple clause. Each entry starts with the full subject of the clause, including any owner ("owls' talons", not "owls"). A second verb phrase joined by "and", a purpose phrase ("to hunt fish") and an "allowing X to Y" phrase each become their own entry. "struggle to", "help" and modals such as "can" stay with their verb; a modal shared by two verb phrases is repeated on both. Resolutions do NOT contain the allowing or purpose terms ("to", "so", etc); Drop these terms.

Examples:
"allowing X to Y" becomes "X Y" - the word "to" is removed;
"allowing birds to escape" becomes "birds escape";
"allowing new stems to grow" becomes "new stems grow"
"allowing plants to grow" becomes "plants grow"
"allowing new blooms to form" becomes "new blooms form"

Lists joined by "and" or "or" ("light or space", "tall and thin") are never split here, in the opening or in an entry. Quantifiers and prepositions such as "enough" and "without" are NEVER removed.

"relation": "purpose" for a purpose phrase, "allowing" for an "allowing X to Y" phrase, "" for everything else, including verb phrases joined by "and".

Every word you output must appear in the Clause; however purpose and allowing markers such as "to", "so", "for", and "allowing" are removed and must never appear in a resolution. A clause with nothing to split gets a single entry: the clause without its opening.

EXAMPLE 1
Clauses: ["without rain, the moss can dry out and struggle to spread"]
Output: [{{"clause":"without rain, the moss can dry out and struggle to spread","opening":"without rain","resolutions":[{{"text":"the moss can dry out","relation":""}},{{"text":"the moss can struggle to spread","relation":""}}]}}]

EXAMPLE 2
Clauses: ["when the sun rises, lizards bask on rocks, allowing lizards to gain energy"]
Output: [{{"clause":"when the sun rises, lizards bask on rocks, allowing lizards to gain energy","opening":"when the sun rises","resolutions":[{{"text":"lizards bask on rocks","relation":""}},{{"text":"lizards gain energy","relation":"allowing"}}]}}]

EXAMPLE 3
Clauses: ["at night, herons leave herons' nests to hunt fish"]
Output: [{{"clause":"at night, herons leave herons' nests to hunt fish","opening":"at night","resolutions":[{{"text":"herons leave herons' nests","relation":""}},{{"text":"herons hunt fish","relation":"purpose"}}]}}]

EXAMPLE 4
Clauses: ["squirrels bury squirrels' nuts in soil to hide nuts from thieves"]
Output: [{{"clause":"squirrels bury squirrels' nuts in soil to hide nuts from thieves","opening":"","resolutions":[{{"text":"squirrels bury squirrels' nuts in soil","relation":""}},{{"text":"squirrels hide nuts from thieves","relation":"purpose"}}]}}]

EXAMPLE 5
Clauses: ["owls' talons grip branches and help catch mice"]
Output: [{{"clause":"owls' talons grip branches and help catch mice","opening":"","resolutions":[{{"text":"owls' talons grip branches","relation":""}},{{"text":"owls' talons help catch mice","relation":""}}]}}]

EXAMPLE 6
Clauses: ["without enough light or space, the herbs grow tall and thin","otters' fur can stay warm"]
Output: [{{"clause":"without enough light or space, the herbs grow tall and thin","opening":"without enough light or space","resolutions":[{{"text":"the herbs grow tall and thin","relation":""}}]}},{{"clause":"otters' fur can stay warm","opening":"","resolutions":[{{"text":"otters' fur can stay warm","relation":""}}]}}]

EXAMPLE 7
Clause: ["without food, cats get hungry and can starve"]
Output: [{{"clause":"without food, cats get hungry and can starve","opening":"without food","resolutions":[{{"text":"cats get hungry","relation":""}},{{"text":"cats can starve","relation":""}}]}}]

EXAMPLE 8
Clauses: ["bears hibernate, allowing bears to survive winters"]
Output: [{{"clause":"bears hibernate, allowing bears to survive the winter","opening":"","resolutions":[{{"text":"bears hibernate","relation":""}},{{"text":"bears survive winters","relation":"allowing"}}]}}]

ONLY output in the format of the example json. The JSON is a list of json objects. This is its structure:
[{{"clause":str,"opening":str,"resolutions":[{{"text":str,"relation":str("" | "purpose" | "allowing")}},...]}},...]

CLAUSES
{clauses_json}
"""

def s4(propositions_json) -> str:
    return f"""
Repeat shared words so that every item in a coordinated list carries its own quantifier and preposition. Do not split the sentence and do not change any other word. Descriptive adjectives are never repeated. If there is nothing to repeat, return the clause unchanged.

EXAMPLE 1
Clauses: ["without enough food or water, the voles grow weak","most ducks and geese leave in autumn","otters eat crabs and clams","bees visit red flowers and shrubs"]
Output: [{{"clause":"without enough food or water, the voles grow weak","distributions":"without enough food or without enough water, the voles grow weak"}},{{"clause":"most ducks and geese leave in autumn","distributions":"most ducks and most geese leave in autumn"}},{{"clause":"otters eat crabs and clams","distributions":"otters eat crabs and clams"}},{{"clause":"bees visit red flowers and shrubs","distributions":"bees visit red flowers and shrubs"}}]

EXAMPLE 2
Clauses: ["plenty of warmth and food help babies grow","any land or sea animal could be alive","many but not all arachnids spin webs", "some furniture and all chairs have legs"]
Output: [{{"clause":"plenty of warmth and food help babies grow","distributions":"plenty of warmth and plenty of food help babies grow"}},{{"clause":"any land or sea animal could be alive","distributions":"any land or any sea animal could be alive"}},{{"clause":"many but not all arachnids spin webs","distributions":"many but not all arachnids spin webs"}},{{"clause":"some furniture and all chairs have legs","distributions":"some furniture and all chairs have legs"}}]

ONLY output the JSON list
[{{"clause":str,"distributions":str}},...]

CLAUSES
{propositions_json}
"""

def s5(distributions_json) -> str:
    return f"""
Expand every list ONLY joined by "or" into one clause per combination. Repeat shared words ("enough", "the") in each. Keep all other words. A clause with no list is returned unchanged. If a clause has no "or" words, return it as is.

EXAMPLE 1
Clauses: ["without enough food or water, the voles grow weak and thin"]
Output: [{{"clause":"without enough food or water, the voles grow weak and thin","expansions":["without enough food, the voles grow weak and thin","without enough water, the voles grow weak and thin"]}}]

EXAMPLE 2
Clauses: ["during the winter, deer grow thick coats","while alive, deer's antlers protect deer from wolves and help deer find mates"]
Output: [{{"clause":"during the winter, deer grow thick coats","expansions":["during the winter, deer grow thick coats"]}},{{"clause":"while alive, deer's antlers protect deer from wolves and help deer find mates","expansions":["while alive, deer's antlers protect deer from wolves and help deer find mates"]}}]

EXAMPLE 3
Clauses: ["bats sleep in caves","bats' wings fold tightly","at dusk, bats leave the cave and hunt insects"]
Output: [{{"clause":"bats sleep in caves","expansions":["bats sleep in caves"]}},{{"clause":"bats' wings fold tightly","expansions":["bats' wings fold tightly"]}},{{"clause":"at dusk, bats leave the cave and hunt insects","expansions":["at dusk, bats leave the cave and hunt insects"]}}]

EXAMPLE 4
Clauses: ["ducks swim on ponds","without food or shelter, the ducklings grow weak"]
Output: [{{"clause":"ducks swim on ponds","expansions":["ducks swim on ponds"]}},{{"clause":"without food or shelter, the ducklings grow weak","expansions":["without food, the ducklings grow weak","without shelter, the ducklings grow weak"]}}]

EXAMPLE 5
Clauses: ["with plenty of sun and rain, the seedlings grow big and strong"]
Output: [{{"clause":"with plenty of sun and rain, the seedlings grow big and strong","expansions":["with plenty of sun and rain, the seedlings grow big and strong"]}}]

EXAMPLE 6
Clauses: ["without enough rain or without enough shade, the lawn turns brown and dry and the lawn's grass starts to die"]
Output: [{{"clause":"without enough rain or without enough shade, the lawn turns brown and dry and the lawn's grass starts to die","expansions":["without enough rain, the lawn turns brown and dry and the lawn's grass starts to die","without enough shade, the lawn turns brown and dry and the lawn's grass starts to die"]}}]

ONLY output in the format of the example json. The JSON is a list of json objects. This is its structure:
[{{"clause":str,"expansions":[str,...]}},...]

CLAUSES
{distributions_json}
"""

def s6(expansions_or_json) -> str:
    return f"""
Expand every list joined by "and" into one clause per combination. Repeat shared words ("enough", "the") in each. Keep all other words. A clause with no list is returned unchanged. If a clause has no "and" words, return it as is.

EXAMPLE 1
Clauses: ["without enough food, the voles grow weak and thin","without enough water, the voles grow weak and thin"]
Output: [{{"clause":"without enough food, the voles grow weak and thin","expansions":["without enough food, the voles grow weak","without enough food, the voles grow thin"]}},{{"clause":"without enough water, the voles grow weak and thin","expansions":["without enough water, the voles grow weak","without enough water, the voles grow thin"]}}]

EXAMPLE 2
Clauses: ["during the winter, deer grow thick coats","while alive, deer's antlers protect deer from wolves and help deer find mates"]
Output: [{{"clause":"during the winter, deer grow thick coats","expansions":["during the winter, deer grow thick coats"]}},{{"clause":"while alive, deer's antlers protect deer from wolves and help deer find mates","expansions":["while alive, deer's antlers protect deer from wolves","while alive, deer's antlers help deer find mates"]}}]

EXAMPLE 3
Clauses: ["bats sleep in caves","bats' wings fold tightly","at dusk, bats leave the cave and hunt insects"]
Output: [{{"clause":"bats sleep in caves","expansions":["bats sleep in caves"]}},{{"clause":"bats' wings fold tightly","expansions":["bats' wings fold tightly"]}},{{"clause":"at dusk, bats leave the cave and hunt insects","expansions":["at dusk, bats leave the cave","at dusk, bats hunt insects"]}}]

EXAMPLE 4
Clauses: ["with plenty of sun and rain, the seedlings grow big and strong"]
Output: [{{"clause":"with plenty of sun and rain, the seedlings grow big and strong","expansions":["with plenty of sun, the seedlings grow big","with plenty of sun, the seedlings grow strong","with plenty of rain, the seedlings grow big","with plenty of rain, the seedlings grow strong"]}}]

EXAMPLE 5
Clauses: ["without enough rain, the lawn turns brown and dry and the lawn's grass starts to die","without enough shade, the lawn turns brown and dry and the lawn's grass starts to die"]
Output: [{{"clause":"without enough rain, the lawn turns brown and dry and the lawn's grass starts to die","expansions":["without enough rain, the lawn turns brown","without enough rain, the lawn turns dry","without enough rain, the lawn's grass starts to die"]}},{{"clause":"without enough shade, the lawn turns brown and dry and the lawn's grass starts to die","expansions":["without enough shade, the lawn turns brown","without enough shade, the lawn turns dry","without enough shade, the lawn's grass starts to die"]}}]

EXAMPLE 6
Clauses: ["under heavy stress, managers fail to remain calm and collected", "with a broken wing, birds fail to fly high and free"]
Output: [{{"clause":"under heavy stress, managers fail to remain calm and collected","expansions":["under heavy stress, managers fail to remain calm","under heavy stress, managers fail to remain collected"]}},{{"clause":"with a broken wing, birds fail to fly high and free","expansions":["with a broken wing, birds fail to fly high","with a broken wing, birds fail to fly free"]}}]

ONLY output in the format of the example json. The JSON is a list of json objects. This is its structure:
[{{"clause":str,"expansions":[str,...]}},...]

CLAUSES
{expansions_or_json}
"""

(
    # def s7(expansions_and_json) -> str:
    #     return f"""
    # Each proposition is one simple statement. Fill the slots with words copied exactly from the proposition, and leave a slot empty if it does not apply.
    # subject: what does the verb, without its owner. subject_owner: whose it is, if possessed ("owls' talons" gives subject "talons", owner "owls").
    # relation: the verb, with "struggle to", "help" or any particle it needs ("are attracted to"), but without the modal.
    # object: what the verb acts on, or the state it leads to.
    # condition, time, place, manner: the matching phrase. modality: "can", "may" and similar; for "cannot" use modality "can" and negated "true".
    # other: any remaining phrase ("with stones", "from crabs"). Do not force a phrase into a slot it does not fit.
    #
    # EXAMPLE 1
    # Propositions: ["without enough rain, the lawn turns brown","at night, owls' talons grip branches quickly","snow can fall on the hills","otters crack shells with stones","fish cannot breathe air","without shade, the frogs struggle to reach the pond"]
    # Output: [{{"proposition":"without enough rain, the lawn turns brown","subject":"lawn","subject_owner":"","relation":"turns","object":"brown","object_owner":"","condition":"without enough rain","time":"","place":"","manner":"","modality":"","negated":"false","other":""}},{{"proposition":"at night, owls' talons grip branches quickly","subject":"talons","subject_owner":"owls","relation":"grip","object":"branches","object_owner":"","condition":"","time":"at night","place":"","manner":"quickly","modality":"","negated":"false","other":""}},{{"proposition":"snow can fall on the hills","subject":"snow","subject_owner":"","relation":"fall","object":"","object_owner":"","condition":"","time":"","place":"on the hills","manner":"","modality":"can","negated":"false","other":""}},{{"proposition":"otters crack shells with stones","subject":"otters","subject_owner":"","relation":"crack","object":"shells","object_owner":"","condition":"","time":"","place":"","manner":"","modality":"","negated":"false","other":"with stones"}},{{"proposition":"fish cannot breathe air","subject":"fish","subject_owner":"","relation":"breathe","object":"air","object_owner":"","condition":"","time":"","place":"","manner":"","modality":"can","negated":"true","other":""}},{{"proposition":"without shade, the frogs struggle to reach the pond","subject":"frogs","subject_owner":"","relation":"struggle to reach","object":"the pond","object_owner":"","condition":"without shade","time":"","place":"","manner":"","modality":"","negated":"false","other":""}}]
    #
    # EXAMPLE 2
    # Propositions: ["ferns grow best in damp soil","owls guard owls' chicks in hollow trees"]
    # {{"proposition":"ferns grow best in damp soil","subject":"ferns","subject_owner":"","relation":"grow","object":"","object_owner":"","condition":"","time":"","place":"in damp soil","manner":"best","modality":"","negated":"false","other":""}},{{"proposition":"owls guard owls' chicks in hollow trees","subject":"owls","subject_owner":"","relation":"guard","object":"chicks","object_owner":"owls","condition":"","time":"","place":"in hollow trees","manner":"","modality":"","negated":"false","other":""}}
    #
    # ONLY output the JSON list
    # [{{"proposition":str,"subject":str,"subject_owner":str,"relation":str,"object":str,"object_owner":str,"condition":str,"time":str,"place":str,"manner":str,"modality":str,"negated":str("true"|"false"),"other":str}},...]
    #
    # PROPOSITIONS
    # {expansions_and_json}
    # """
)

def s7(expansions_and_json) -> str:
    return f"""
You are a proposition extractor. Your input is a single simple statement.

Extract:

- subject: the noun that owns the verb
- relation: the verb performed by the subject
- object: the noun onto which the verb is performed by the subject
- condition (if present): temporal, spatial, or other conditional elements.

Rules:
1. Keep natural wording.
2. Do not infer missing information.
3. Do not create graph edges.
4. Do not create node ids.
5. Do not create ownership fields.
6. Do not create semantic links.
7. If there is no condition, return "".
8. You must produce your JSON response in the same order as the simple statements are provided.

Output ONLY valid JSON of the following Schema:
{{"subject": str,"relation": str,"object": str,"condition": str}}

EXAMPLE 1
Statement: "under heavy stress, managers fail to remain calm"
{{"subject": "managers", "relation": "fail to", "object": "remain calm", "condition": "under heavy stress"}}

EXAMPLE 2
Statement: "with plenty of sun, the seedlings grow big"
{{"subject": "seedlings","relation": "grow","object": "big","condition": "with plenty of sun"}}

EXAMPLE 3
Statement: "at dusk, bats hunt insects"
{{"subject": "bats","relation": "hunt","object": "insects","condition": "at dusk"}}

EXAMPLE 4
Statement: "bats sleep in caves"
{{"subject": "bats","relation": "sleep","object": "caves","condition": ""}}

EXAMPLE 5
Statement: "the lawn's grass starts to die"
{{"subject": "lawn's grass","relation": "starts","object": "die","condition": ""}}
"""

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## HELPER FUNCTIONS ~~~~~~~~~~~~~~~~

def create_payload(prompt: str, stream: bool):
    return { "model": ACTIVE_MODEL, "prompt": prompt, "stream": stream, "options": { "temperature": 0 } }

def run_ollama_prompt(prompt: str) -> dict:
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

    return json.loads(raw)

def open_ollama_stream(prompt: str) -> requests.Response:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt, stream=True), stream=True)
    r.raise_for_status()
    return r

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

def debug(label: str, json_text: str) -> None:
    print(label + ": ", json_text, flush=True)

def texts_of(rows: list[dict]) -> list[str]:
    # [{"src": "0.0", "text": "abc"}, ...] --> ["abc", ...]
    texts = []
    for row in rows:
        texts.append(row["text"])
    return texts

def check_alignment(stage, sent, echoed) -> None:
    # sent = strings we gave model; echoed = strings model says it processed ("clause" field)
    # should be same count, same order, unchanged. if wrong, log exactly where it failed
    if len(sent) != len(echoed):
        logger.error(f"{stage}: sent {len(sent)} but got {len(echoed)} back"); raise ValueError(f"{stage}: item count mismatch")
    for i in range(len(sent)):
        if sent[i] != echoed[i]:
            logger.error(f"{stage} mismatch at position {i}\n\tSent:\t{sent[i]}\n\tEchoed: {echoed[i]}"); raise ValueError(f"{stage}: echo mismatch at position {i}")

def expand_rows(stage, rows, groups) -> list[dict]:
    # rows   = what we sent:      [{"src": "2.1", "text": "..."}, ...]
    # groups = what came back:    [{"clause": "...", "expansions": ["...", "..."]}, ...]
    # Returns a longer list of rows. Every new row keeps its parent's "src".
    check_alignment(stage, texts_of(rows), [g["clause"] for g in groups])
    new_rows = []
    for row, group in zip(rows, groups):
        for expansion in group["expansions"]:
            new_rows.append({"src": row["src"], "text": expansion})
    return new_rows

def generate_graph(text: str) -> Iterator[GraphEvent]:
    import time
    meta = {} # pid -> {"clause_id", "link", "link_parent"} one entry per proposition
    rows = [] # working list: [{"src": pid, "text": ...}, ...]
    clauses = [] # propositional statements

    debug("Source Text", text)

    #   EXTRACT SEMANTIC UNITS FROM THE TEXT
    print("PROMPT: Semantic Units", flush=True)
    sem_units_list = None
    for s in iter_graph_objects(s1(text)):
        sem_units_list = s["semantic_units"]
    sem_units_json = json.dumps(sem_units_list)
    debug("Semantic Units", sem_units_json)


    #   RESOLVE PRONOUNS IN THE SEMANTIC UNITS
    print("PROMPT: Clauses", flush=True)
    for s in iter_graph_objects(s2(text, sem_units_json)):
        clauses.append(s["clause"])
    clauses_json = json.dumps(clauses)
    debug("Clauses", clauses_json)


    #   PREPARE CLAUSES AS PROPOSITIONS (introduces reification tags)
    print("PROMPT: Propositions", flush=True)
    s3_groups = list(iter_graph_objects(s3(clauses_json)))
    check_alignment("S3 Clauses", clauses, [g["clause"] for g in s3_groups])

    for clause_number, group in enumerate(s3_groups):
        opening = group["opening"]
        latest_main = None # id of the most recent untagged entry in clause

        for entry_number, entry in enumerate(group["resolutions"]):
            pid = f"{clause_number}.{entry_number}"
            tag = entry["relation"] # either "", "purpose" or "allowing"

            if entry_number == 0 and tag: # first entry can never be child
                logger.warning(f"S3 first entry of clause {clause_number} tagged {tag}; treating as main"); tag = ""

            if tag == "":
                latest_main = pid
                parent = None
            else:
                parent = latest_main

            meta[pid] = {"clause_id": clause_number, "link": tag, "link_parent": parent}

            if opening:
                full_text = opening + ", " + entry["text"]
            else:
                full_text = entry["text"]
            rows.append({"src": pid, "text": full_text})

    propositions_json = json.dumps(texts_of(rows))
    debug("Propositions", propositions_json)


    #   DISTRIBUTE SHARED TERMS ACROSS SUBJECTS AND OBJECTS
    print("PROMPT: Distributions", flush=True)
    distributions = list(iter_graph_objects(s4(propositions_json)))
    check_alignment("S4 Distribution", texts_of(rows), [d["clause"] for d in distributions])
    for row, dist in zip(rows, distributions):
        row["text"] = dist["distributions"] # replace in place but "src" remains
    distributions_json = json.dumps(texts_of(rows))
    debug("Distributed", distributions_json)


    #   EXPANSION PROPOSITIONS ON "OR"
    print("PROMPT: Expansions on OR", flush=True)
    rows_or = expand_rows("S5 OR", rows, list(iter_graph_objects(s5(distributions_json))))
    expansions_or_json = json.dumps(texts_of(rows_or))
    debug("Expansions on OR", expansions_or_json)


    #   EXPANSION PROPOSITIONS ON "AND"
    print("PROMPT: Expansions on AND", flush=True)
    rows_and = expand_rows("S6 AND", rows_or, list(iter_graph_objects(s6(expansions_or_json))))
    expansions_and_json = json.dumps(texts_of(rows_and))
    debug("Expansions on AND", expansions_and_json)


    #   NODES FROM EXPANDED PROPOSITIONS
    print("PROMPT: Atomics", flush=True)
    atomics = list(iter_graph_objects(s7(expansions_and_json)))
    debug("Atomics", json.dumps(atomics))
    # check_alignment("S4 Atomics", texts_of(rows_and), [a["proposition"] for a in atomics])
    # atomics_json = json.dumps(atomics)
    # debug("Atomics", atomics_json)


    #   EDGES FROM EXPANDED PROPOSITIONS


    #   SEMANTICS FROM EXPANDED PROPOSITIONS



    #   FINAL ATOMICS + SOURCE + RELATION TAG DATA
    # final = []
    # for atomic, row in zip(atomics, rows_and):
    #     record = dict(atomic)               # copy of s7 slots
    #     record["src"] = row["src"]          # src proposition
    #     record.update(meta[row["src"]])     # adds clause_id, link, link_parent
    #     final.append(record)
    # debug("Final", json.dumps(final))

        # query_list = None
    # print("Queries:")
    # for q in query_list:
    #     print(q)

    # One edge case to decide on:
    # Source Text: "Turtles bury their eggs in warm sand to hide them from birds. Their shells protect them from crabs. At night, crabs leave their holes to hunt hatchlings. They hide under rocks to survive on the beach. When the tide comes in, the nests can flood, allowing water to reach the eggs. Without shade, hatchlings overheat and struggle to reach the sea."
    # Issue: "They hide under rocks to survive on the beach" is ambiguous in the source, since "they" could be the crabs or the hatchlings. Stage 2 silently picked hatchlings. That's defensible, but it means the graph will state a fact the text doesn't clearly state. For a platform built around explicit relationships, you might prefer leaving ambiguous pronouns unresolved and letting them become a question for the learner.

    # we had u+2019 (ight single quotation mark, commonly referred to as a typographic or "smart" apostrophe) appear in the volcano `expansions_and_json`: we need to ensure if is only using U+0027, or something else. maybe it doesn't matter onces it goes through the frontend layers??

    (
        # f"""
        # We are validating atomic propositions for a knowledge graph. Each proposition was extracted from one semantic unit. Your task is to classify every proposition according to whether it is logically supported by its semantic unit.
        #
        # --------------------------------------------------
        # LOGICAL CLASSIFICATION
        # --------------------------------------------------
        # Compare each proposition to its semantic unit. Classify each proposition as exactly ONE of: "entailed", "contingent", "contradiction", or "malformed".
        #
        # ENTAILED
        # - The semantic unit being true guarantees that the proposition is true.
        # - The proposition is directly stated or logically unavoidable.
        #
        # Examples:
        # Semantic Unit: "shells protect turtles from crabs"
        # Proposition: "shells protect turtles from crabs"
        # Classification: "entailed"
        #
        # CONTINGENT
        # - The proposition could be true, but the semantic unit does not guarantee it.
        # - The proposition is inferred from a purpose, intention, consequence, implication, outcome, or unstated assumption.
        # - If the semantic unit can be true while the proposition is false, classify it as contingent.
        #
        # Examples:
        # Semantic Unit: "cacti store water in thick stems to survive in hot deserts"
        # Proposition: "cacti survive in hot deserts"
        # Classification: "contingent"
        #
        # Reason:
        # The unit states a purpose.
        # It does not independently assert survival.
        #
        # Another Example:
        # Semantic Unit: "hatchlings hide under rocks to survive on the beach"
        # Proposition: "hatchlings survive on the beach"
        # Classification: "contingent"
        #
        # CONTRADICTION
        # - The proposition cannot be true if the semantic unit is true.
        # - The proposition introduces an opposite condition, time, action, state, or relationship.
        #
        # Example:
        # Semantic Unit: "at night, owls hunt"
        # Proposition: "during the day, owls hunt"
        # Classification: "contradiction"
        #
        # MALFORMED
        # - The proposition is not a valid proposition.
        # - It is incomplete, garbled, missing a subject, missing a verb, or contains broken grammar.
        # - The proposition cannot be evaluated for entailment because it does not express a coherent fact.
        #
        # Example:
        # Semantic Unit: "spiders weave webs to catch flies"
        # Proposition: "spiders webs catch flies"
        # Classification: "malformed"
        #
        # --------------------------------------------------
        # ATOMICITY REFERENCE
        # --------------------------------------------------
        # An atomic proposition expresses exactly one fact.
        # A fact may contain: one subject, one predicate, one object or state, or any conditions that belong to that predicate.
        # Atomicity helps determine whether a proposition is malformed or whether multiple propositions should exist, but your primary task is logical classification.
        #
        # --------------------------------------------------
        # CONDITIONS
        # --------------------------------------------------
        # Conditions remain attached to every proposition they govern. A proposition missing a required condition may become contingent or contradiction depending on meaning.
        # Examples: "when rainfall occurs, cacti absorb moisture and grow stems" contains "when rainfall occurs, cacti absorb moisture" and "when rainfall occurs, cacti grow stems"
        #
        # --------------------------------------------------
        # PRONOUNS
        # --------------------------------------------------
        # Pronouns should refer unambiguously to nouns in the semantic unit. A proposition that becomes ambiguous due to unresolved pronouns may be classified as malformed.
        #
        # --------------------------------------------------
        # OUTPUT
        # --------------------------------------------------
        # Return JSON only.
        # {{"type": "audit","proposals": [{{"semantic_unit": str, "propositions": [str, ...], "classifications": [str, ...]}}]}}
        # The propositions MUST remain in their original order. Each classification must be exactly one of: "entailed", "contingent", "contradiction", or "malformed".
        # The number of classifications must equal the number of propositions.
        # Do NOT return any commentary, markdown, or explanations
        #
        # --------------------------------------------------
        # SEMANTIC UNITS
        # --------------------------------------------------
        # {sem_units_json}
        #
        # --------------------------------------------------
        # PROPOSITIONS TO CHECK
        # --------------------------------------------------
        # {prop1_units_json}
        # """

        # f"""
        # The Prepositional Object Trap.
        #
        # Here are the specific flaws that will corrupt your Knowledge Graph, and how to patch your prompt to fix them.
        #
        # Graph-Breaker 1: Prepositional Phrases Masking as Objects
        # Output: relation: 'flows', object: 'from the crater'
        #
        # Output: relation: 'rise', object: 'high into the atmosphere'
        #
        # The Bug: In a graph, an object must be a noun entity receiving an action. "From the crater" and "into the atmosphere" are spatial/directional contexts, not entities.
        #
        # The Fix: These belong in a spatial qualifier, leaving the object as None.
        #
        # subject: 'lava', relation: 'flows', object: None, qualifiers: {{'spatial': 'from the crater'}}
        #
        # Graph-Breaker 2: Multi-Action Smushing
        # Output: relation: 'combine', object: 'with moisture to form acidic aerosols'
        #
        # The Bug: The model jammed a preposition (with moisture) and an infinitive result clause (to form acidic aerosols) into a single object node. In a graph, a node named "with moisture to form acidic aerosols" is completely useless for querying.
        #
        # The Fix: This needs to be decomposed into two distinct triples, or utilize a result/purpose qualifier.
        #
        # Triple 1: subject: 'gases', relation: 'combine with', object: 'moisture'
        #
        # Triple 2: subject: 'gases', relation: 'form', object: 'acidic aerosols'
        #
        # Graph-Breaker 3: Lingering Pronouns in Qualifiers
        # Output: relation: 'creates', qualifiers: {{'manner': 'as it cools'}}
        #
        # The Bug: The coreference resolution rule we applied earlier worked on the main proposition, but the model forgot to apply it to the qualifiers. "it" refers to lava.
        #
        # The Fix: Qualifiers must also have their pronouns resolved ('manner': 'as lava cools').
        #
        # Graph-Breaker 4: The Factitive Verb Trap
        # Output: relation: 'makes', object: 'the surrounding area highly fertile'
        #
        # The Bug: "Makes" is a factitive verb here—it assigns a state to an object. Sticking the state (highly fertile) into the object node pollutes it.
        #
        # The Fix: Rephrase into a clean state-change relation:
        #
        # relation: 'fertilizes', object: 'the surrounding area' OR
        #
        # relation: 'makes fertile', object: 'the surrounding area'
        #
        # The Next Iteration of Your System Prompt
        # To harden the model against these linguistic traps, you need to add strict syntax definitions for what constitutes an "Object" and a "Relation".
        #
        # ```Prompt
        # CRITICAL LINGUISTIC RULES FOR TRIPLES:
        #
        # 1. STRICT OBJECT DEFINITION:
        # - The 'object' MUST be a clean Noun Phrase (an entity or concept).
        # - NEVER start an object with a preposition ("from", "into", "with", "to").
        # - If the phrase indicates WHERE, move it to the 'spatial' qualifier (e.g., "flows [from the crater]" -> object: null, spatial: "from the crater").
        # - If the relation requires the preposition (e.g., "combine with", "contribute to"), attach the preposition to the 'relation', not the object (e.g., relation: "contribute to", object: "soil formation").
        #
        # 2. SPLIT CASCADING ACTIONS:
        # - Do not lump multiple actions into the object field.
        # - BAD: object: "with moisture to form aerosols"
        # - GOOD: Break into two separate propositions/JSON objects: one for "combines with moisture", one for "forms aerosols".
        #
        # 3. RESOLVE PRONOUNS EVERYWHERE:
        # - Pronoun replacement applies to the 'qualifiers' field just as strictly as the 'proposition' field. (e.g., "as it cools" MUST become "as lava cools").
        # ```
        # """
    )

def ai_generate_graph(text: str) -> Iterator[GraphEvent]:

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
    edges = {"edges":[]}
    for e in json_graph["edges"]:
        edges["edges"].append({"id":e["id"],"source":e["source"],"target":e["target"],"relationship":e["label"]})

    wrapped_json = {"query" :search_input, "graph": edges}

    json_str = minify_json(wrapped_json)
    search_result = run_ollama_prompt(graph_searching_template(json_str))

    for node in json_graph["nodes"]:
        if node["label"] == search_result["found_node"]:
            return {
                "node_id": node["id"],
                "label": node["label"],
                "score": search_result["score"]
            }

    return { "node_id": -1, "label": "", "score": -1.0 }

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

