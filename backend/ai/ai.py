from typing import cast

import requests, json, re
from fastapi import APIRouter
from .models import GenerateGraph, GenerateSummary, SummaryResponse, ConceptGraphResponse

router = APIRouter(prefix="/ai", tags=["ai"])

ollama_url = "http://treenotes_ollama:11434/api/generate"

### Simple Prompts for use in Frontend Testing

(
    # Roses grow best in sunny gardens. Bees are attracted to their bright colors and sweet fragrance. When bees visit roses, they help pollinate the flowers, allowing new blooms to form. Without enough sunlight or pollination, roses struggle to grow strong and healthy.
    # Cacti store water in their thick stems to survive in hot deserts. Their spines protect them from animals and help reduce water loss. When rainfall occurs, cacti absorb moisture quickly, allowing them to grow new stems. Without enough sunlight, cacti become weak and struggle to thrive.
    # Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.
)

(
    # Spiders (order Araneae) are air-breathing arthropods that have eight limbs, chelicerae with fangs generally able to inject venom, and spinnerets that extrude silk. They are the largest order of arachnids and rank seventh in total species diversity among all orders of organisms. Spiders are found worldwide on every continent except Antarctica, and have become established in nearly every land habitat. As of January 2026, 53,680 spider species in 139 families have been recorded by taxonomists. However, there has been debate among scientists about how families should be classified, with over 20 different classifications proposed since 1900. Anatomically, spiders (as with all arachnids) differ from other arthropods in that the usual body segments are fused into two tagmata, the cephalothorax or prosoma, and the opisthosoma, or abdomen, and joined by a small, cylindrical pedicel. However, as there is currently neither paleontological nor embryological evidence that spiders ever had a separate thorax-like division, there exists an argument against the validity of the term cephalothorax, which means fused cephalon (head) and the thorax. Similarly, arguments can be formed against the use of the term "abdomen", as the opisthosoma of all spiders contains a heart and respiratory organs, organs atypical of an abdomen. Unlike insects, spiders do not have antennae. In all except the most primitive group, the Mesothelae, spiders have the most centralized nervous systems of all arthropods, as all their ganglia are fused into one mass in the cephalothorax. Unlike most arthropods, spiders have no extensor muscles in their limbs and instead extend them by hydraulic pressure. Their abdomens bear appendages, modified into spinnerets that extrude silk from up to six types of glands. Spider webs vary widely in size, shape and the amount of sticky thread used. It now appears that the spiral orb web may be one of the earliest forms, and spiders that produce tangled cobwebs are more abundant and diverse than orb-weaver spiders. Spider-like arachnids with silk-producing spigots (Uraraneida) appeared in the Devonian period, about 386 million years ago, but these animals apparently lacked spinnerets. True spiders have been found in Carboniferous rocks from 318 to 299 million years ago and are very similar to the most primitive surviving suborder, the Mesothelae. The main groups of modern spiders, Mygalomorphae and Araneomorphae, first appeared in the Triassic period, more than 200 million years ago. The species Bagheera kiplingi was described as herbivorous in 2008, but all other known species are predators, mostly preying on insects and other spiders, although a few large species also take birds and lizards. An estimated 25 million tons of spiders kill 400–800 million tons of prey every year. Spiders use numerous strategies to capture prey: trapping it in sticky webs, lassoing it with sticky bolas, mimicking the prey to avoid detection, or running it down. Most detect prey mainly by sensing vibrations, but the active hunters have acute vision and hunters of the genus Portia show signs of intelligence in their choice of tactics and ability to develop new ones. Spiders' guts are too narrow to take solids, so they liquefy their food by flooding it with digestive enzymes. They also grind food with the bases of their pedipalps, as arachnids do not have the mandibles that crustaceans and insects have.  To avoid being eaten by the females, which are typically much larger, male spiders identify themselves as potential mates by a variety of complex courtship rituals. Males of most species survive a few matings, limited mainly by their short life spans. Females weave silk egg cases, each of which may contain hundreds of eggs. Females of many species care for their young, for example by carrying them around or by sharing food with them. A minority of species are social, building communal webs that may house anywhere from a few to 50,000 individuals. Social behavior ranges from precarious toleration, as in the widow spiders, to cooperative hunting and food-sharing. Although most spiders live for at most two years, tarantulas and other mygalomorph spiders can live for over 20 years. While the venom of a few species is dangerous to humans, scientists are now researching the use of spider venom in medicine and as non-polluting pesticides. Spider silk provides a combination of lightness, strength and elasticity superior to synthetic materials, and spider silk genes have been inserted into mammals and plants to see if these can be used as silk factories. As a result of their wide range of behaviors, spiders have become common symbols in art and mythology, symbolizing various combinations of patience, cruelty and creative powers. An irrational fear of spiders is called arachnophobia.
)

###

def extract_json(data: dict) -> dict:
    raw = data.get("response", "").strip()

    try:
        return json.loads(raw) # direct json parse
    except Exception:
        # extract object from messy output
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise ValueError(f"Model did not return JSON: {raw}")
        return json.loads(match.group(0))


concept_extraction_template = """
You are an AI that extracts concepts and relationships from text.

Return ONLY valid JSON matching this EXACT schema:

```json
{"concepts": [{"concept_id": int,"concept_name": str,"importance": float,"relationships": [{"target_id": int,"relationship": str,"weight": float}]}]}
```

Concept Importance is a type of score and must reflect:
- centrality in the text
- number and strength of relationships
- causal significance
- semantic relevance

Relationship Weight is a type of score and must reflect:
- strength of the relationships as express in the text
- clarity of causation or dependency
- contextual certainty
- narrative importance

Rules:
- concept_id must be sequential integers starting at 1
- concept_name must be derived verbatim from the text and the shortest possible noun phrase in snake_case
- relationships must reference valid concept_ids
- relationships cannot be the same or similar to any concept_name
- relationship phrases must be compressed into concise action verbs in snake_case. Examples:
-- "flows from the crater" -> "flow_from_crater"
-- "affecting air quality" -> "affect_air_quality"
-- "protect from animals with spines" -> "protects_from_animals"
- importance and weight must be floats between 0 and 1
- importance and weight must reflect the strength of the four listed properties, normalised between 0 and 1
- use the full range of 0 to 1 for importance and weight
- high scores (0.7-1) should only be used for very strong, explicit relationships
- moderate scores (0.4-0.6) should be used for typical relationships
- low scores (0.0-0.3) should be used for weak or implied relationships
- do NOT include explanations or commentary
- output ONLY in the JSON format as given

Example of correct concept extraction:
Text: "Bees collect nectar from flowers. Nectar helps bees produce honey. Flowers rely on bees for pollination."
JSON:
{"concepts": [{"concept_id": 1,"concept_name": "bees","importance": 0.8,"relationships": [{"target_id": 2,"relationships": "collect_nectar","weight": 0.6},{"target_id": 3,"relationships": "produce_honey","weight": 0.5},]},{"concept_id": 2,"concept_name": "flowers","importance": 0.7,"relationships": [{"target_id": 1,"relationships": "provide_nectar","weight": 0.6},{"target_id": 3,"relationships": "enable_pollination","weight": 0.7},]},{"concept_id": 3,"concept_name": "nectar","importance": 0.6,"relationships": [{"target_id": 1,"relationships": "used_for_honey","weight": 0.5}]}]}

Your Text to analyse:
"""

def generate_graph(prompt: str) -> str:
    developed_prompt = concept_extraction_template + "\n<<<\n" + prompt + "\n>>>"

    payload = {
        "model": "qwen2.5-coder",
        "prompt": developed_prompt,
        "stream": False
    }

    r = requests.post(ollama_url, json=payload)
    r.raise_for_status()

    data = r.json()

    parsed = json.loads(data.get("response", "").strip().replace("```json", "").replace("```", "").strip())

    return cast(ConceptGraphResponse, parsed)

@router.post("/generate")
def generate(req: GenerateGraph):
	output = generate_graph(req.rawData)
	return {"output": output}


summary_generation_template = """
You are a news journalist whose responsible for providing concise, detailed, and accurate summaries derived from 3 distinct sources of information. You use this information to produce your singular summary on the topic.

1. Raw Data:
The Raw Data information given to you is the true source of information, unfiltered, unedited. It can also be poorly formatted, in dot-point form, or indirect. However, this information source is the ground truth from which you cannot infer or make assumptions outside of what is provided directly.

2. JSON-Formatted Graph:
The JSON-Formatted Graph information source is an attempt to represent the Raw Data information into a graph. This graph is provided to you in JSON form. The author of this JSON has provided you with an "Importance" and "Weight" scores for the nodes (Concepts) and edges (Relationships) of the graph. These scores are used to as a guide to improve phrasing of the summary you produce, providing additional inflection as needed, proportional to their respective scores.

3. Draft Summary:
A journalist colleague has already drafted a summary after observing the same Raw Data and Graph information sources. Ultimately, it is their article and they will be submitting the piece. They are asking you to review their work, and provide insight into any misconceptions, mistakes, typing errors, or omissions from the data. Because of this, you are in a unique position to provide Encouragement Features to your colleague. Your encouragement comes in the form of an integer Score, between 0 and 100, and you are to provide a Colleague Review: a short-form summary of their draft summary, where you are supportive and constructive.

Rules:
- Your summary must not make assumptions or extend the scope given by any of the information items provided
- The draft summary is not a mandatory information source, and you must produce your summary using the provided sources
- Your summary must not use any headings, only paragraph spacing when necessary
- The JSON-Formatted Graph is not a mandatory information source, and you must produce your summary using the provided sources
- Your summary must be concise, and you can use Bold tags <b></b>, to emphasise key concepts or relationships:
 -- If their importance or weight score is greater than 0.8, these terms are eligible to be bolded. Examples:
 --- concept "volcanoes" with an importance of 0.9 -> "<b>volcanoes</b>"
 --- concept "ash clouds" with an importance of 0.7 -> "ash clouds"
 --- relationship "rise_into_sky" with weight 0.6 -> "rise into sky"
 --- relationship "erupt_when_pressure_builds" with weight 0.8 -> "<b>erupt when pressure builds</b>"
 -- You may ONLY provide these emphasis to terms derived verbatim from the text or JSON-Formatted Graph
 -- If you encounter terms used in the text or graph which is snake_case, you MUST convert to standard text

Your Output must be in the following Schema. Return ONLY valid JSON matching this EXACT schema:

```json
{"aiSummary": "<string>","userSummaryReview": "<string>","userScore": <integer>}
```

Do not include any commentary, explanation, markdown fences, or text outside the JSON object. Return ONLY the JSON object.
!IMPORTANT! If there is no Draft Summary provided from your colleague, you provide a userScore of ZERO 0, and an EMPTY string for the userSummaryReview.

Here is one example:
<<<
1. Raw Data:
Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.

2. JSON-Formatted Graph:
{"concepts": [{"concept_id": 1,"concept_name": "volcanoes","importance": 0.9,"relationships": [{"target_id": 2,"relationship": "erupt_when_pressure_builds","weight": 0.8},{"target_id": 3,"relationship": "flow_from_crater","weight": 0.7},{"target_id": 4,"relationship": "rise_into_sky","weight": 0.6}]},{"concept_id": 2,"concept_name": "lava","importance": 0.8,"relationships": [{"target_id": 1,"relationship": "flows_from_crater","weight": 0.7},{"target_id": 5,"relationship": "enrich_soil","weight": 0.6}]},{"concept_id": 3,"concept_name": "ash_clouds","importance": 0.7,"relationships": [{"target_id": 1,"relationship": "rise_into_sky","weight": 0.6},{"target_id": 6,"relationship": "affect_air_quality","weight": 0.5}]},{"concept_id": 4,"concept_name": "air_quality","importance": 0.7,"relationships": [{"target_id": 3,"relationship": "affect_air_quality","weight": 0.5}]},{"concept_id": 5,"concept_name": "minerals","importance": 0.6,"relationships": [{"target_id": 2,"relationship": "enrich_soil","weight": 0.6}]},{"concept_id": 6,"concept_name": "sunlight","importance": 0.7,"relationships": [{"target_id": 3,"relationship": "block_sunlight","weight": 0.5}]}]}

3. Draft Summary:
Under the Earth's crust, pressure builds and forces volcanoes to explode. Volcanoes release lava from their craters and it destroys the surrounding fauna and forces fauna to migrate. The lava also changes the earth, and the explosion and burning pushes ash into the sky. Although the air quality and sunlight are reduced by the ash clouds, when it sediments back to the ground it enriches the soil.

Your Response:
```json
{"aiSummary": "Volcanoes erupt when pressure builds beneath the Earth’s crust, releasing lava that flows from the crater and destroys nearby plants while reshaping the landscape. Ash clouds rise into the sky, reducing air quality and sunlight as they spread. Minerals within the lava enrich the soil after the eruption, allowing new plants to grow. The eruption also forces local fauna to migrate away from the affected area.", "userSummaryReview": "Your draft demonstrates strong observational thinking and introduces a valuable contingent detail: the migration of local fauna. While this is not explicitly stated in the Raw Data, it does not contradict any provided information and reflects a realistic ecological response. Excellent insight.\n\nA few corrections are needed:\n- Volcanoes do not "explode" in the Raw Data; they erupt.\n- The claim that ash enriches the soil is incorrect. The Raw Data specifies that minerals in the lava enrich the soil.\n- The draft omits the important detail that enriched soil allows new plants to grow.\n- Your description of lava "changing the earth" is consistent with the Raw Data's note on reshaping the landscape, but could be phrased more precisely.\n\nOverall, your draft shows strong reasoning and thoughtful additions.","userScore": 84}
```

>>> END OF EXAMPLE >>>

Here is another example:
<<<
1. Raw Data:
Roses grow best in sunny gardens. Bees are attracted to their bright colors and sweet fragrance. When bees visit roses, they help pollinate the flowers, allowing new blooms to form. Without enough sunlight or pollination, roses struggle to grow strong and healthy.

2. JSON-Formatted Graph:
None

3. Draft Summary:
None

Your Response:
```json
{"aiSummary": "Roses in sunny gardens attract bees with their colors and fragrance. Bees pollinate flowers, resulting in new blooms. Roses struggle to grow without sufficient sunlight or pollination.","userSummaryReview": "","userScore": 0}
```
>>> END OF EXAMPLE >>>

Your 3 Sources to evaluate:
"""
(
    # summary_template = """
    # You will generate a concise and accurate summary using three possible sources of information:
    #
    # 1. Raw Data (Mandatory)
    # This is the ground truth. You must not contradict it. If Raw Data is missing, respond with exactly: NO RAW DATA
    #
    # 2. JSON Graph (Optional)
    # This contains concepts with importance and relationships with weight. Use these scores only to adjust emphasis in your summary:
    # Score > 0.8 -> CAPITALS
    # Score 0.51-0.8 -> <b></b> Bold
    # Score 0.26-0.5 -> <i></i> Italics
    # Score <= 0.25 -> no emphasis
    # Convert snake_case to normal text before applying emphasis.
    #
    # 3. Draft Summary (Optional)
    # This may contain:
    # - Correct Details
    # - Misconceptions
    # - Omissions
    # - New contingent information
    #
    # Rules:
    # - If the Draft Summary adds new information that does not contradict Raw Data, you may include it in your summary.
    # - If the Draft Summary contradicts Raw Data, you must correct it.
    # - If the Draft Summary omits something important from Raw Data, restore it.
    #
    # Your Output must produce three sections:
    # 1. Summary: A concise, factual summary based primarily on Raw Data, optionally supported by Graph and Draft Summary.
    # 2. Draft Summary Review: Identify correct insights, misconceptions, contradictions, omissions, and helpful additions. You are to be supportive and constructive.
    # 3. Encouragement Score: An integer between 0-100, reflective of how well the Draft Summary was written with respect to the other data sources.
    #
    # Your Output must be in the following Schema:
    #
    # Return ONLY valid JSON matching this EXACT schema:
    #
    # ```json
    # {
    #   "aiSummary": "<string>",
    #   "userSummaryReview": "<string>",
    #   "userScore": <integer>
    # }
    # ```
    #
    # Do not include any commentary, explanation, markdown fences, or text outside the JSON object. Return ONLY the JSON object.
    #
    # Here is one example:
    #
    # <<<
    #
    # 1. Raw Data:
    # Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.
    #
    # 2. JSON-Formatted Graph:
    # {
    #   "concepts": [
    #     {
    #       "concept_id": 1,
    #       "concept_name": "volcanoes",
    #       "importance": 0.9,
    #       "relationships": [
    #         {
    #           "target_id": 2,
    #           "relationship": "erupt_when_pressure_builds",
    #           "weight": 0.8
    #         },
    #         {
    #           "target_id": 3,
    #           "relationship": "flow_from_crater",
    #           "weight": 0.7
    #         },
    #         {
    #           "target_id": 4,
    #           "relationship": "rise_into_sky",
    #           "weight": 0.6
    #         }
    #       ]
    #     },
    #     {
    #       "concept_id": 2,
    #       "concept_name": "lava",
    #       "importance": 0.8,
    #       "relationships": [
    #         {
    #           "target_id": 1,
    #           "relationship": "flows_from_crater",
    #           "weight": 0.7
    #         },
    #         {
    #           "target_id": 5,
    #           "relationship": "enrich_soil",
    #           "weight": 0.6
    #         }
    #       ]
    #     },
    #     {
    #       "concept_id": 3,
    #       "concept_name": "ash_clouds",
    #       "importance": 0.7,
    #       "relationships": [
    #         {
    #           "target_id": 1,
    #           "relationship": "rise_into_sky",
    #           "weight": 0.6
    #         },
    #         {
    #           "target_id": 6,
    #           "relationship": "affect_air_quality",
    #           "weight": 0.5
    #         }
    #       ]
    #     },
    #     {
    #       "concept_id": 4,
    #       "concept_name": "air_quality",
    #       "importance": 0.7,
    #       "relationships": [
    #         {
    #           "target_id": 3,
    #           "relationship": "affect_air_quality",
    #           "weight": 0.5
    #         }
    #       ]
    #     },
    #     {
    #       "concept_id": 5,
    #       "concept_name": "minerals",
    #       "importance": 0.6,
    #       "relationships": [
    #         {
    #           "target_id": 2,
    #           "relationship": "enrich_soil",
    #           "weight": 0.6
    #         }
    #       ]
    #     },
    #     {
    #       "concept_id": 6,
    #       "concept_name": "sunlight",
    #       "importance": 0.7,
    #       "relationships": [
    #         {
    #           "target_id": 3,
    #           "relationship": "block_sunlight",
    #           "weight": 0.5
    #         }
    #       ]
    #     }
    #   ]
    # }
    #
    # 3. Draft Summary:
    # Under the Earth's crust, pressure builds and forces volcanoes to explode. Volcanoes release lava from their craters and it destroys the surrounding fauna and forces fauna to migrate. The lava also changes the earth, and the explosion and burning pushes ash into the sky. Although the air quality and sunlight are reduced by the ash clouds, when it sediments back to the ground it enriches the soil.
    #
    # ```json
    # {
    #   "aiSummary": "VOLCANOES erupt when pressure builds beneath the Earth’s crust, releasing lava that flows from the crater and destroys nearby plants while reshaping the landscape. Ash clouds rise into the sky, reducing air quality and sunlight as they spread. Minerals within the lava enrich the soil after the eruption, allowing new plants to grow. The eruption also forces local fauna to migrate away from the affected area.",
    #   "userSummaryReview": "Your draft demonstrates strong observational thinking and introduces a valuable contingent detail: the migration of local fauna. While this is not explicitly stated in the Raw Data, it does not contradict any provided information and reflects a realistic ecological response. Excellent insight.\n\nA few corrections are needed:\n- Volcanoes do not "explode" in the Raw Data; they erupt.\n- The claim that ash enriches the soil is incorrect. The Raw Data specifies that minerals in the lava enrich the soil.\n- The draft omits the important detail that enriched soil allows new plants to grow.\n- Your description of lava "changing the earth" is consistent with the Raw Data's note on reshaping the landscape, but could be phrased more precisely.\n\nOverall, your draft shows strong reasoning and thoughtful additions.",
    #   "userScore": 84
    # }
    # ```
    #
    # >>> END OF EXAMPLE >>>
    #
    # Your 3 Sources to evaluate:
    #
    # """
)

def minify_json(json_str: str) -> str:
    try:
        obj = json.loads(json_str)
        return json.dumps(obj, separators=(',', ':'))
    except Exception:
        return json_str # in case the model (Qwen) returned JSON malformed

def generate_summary(raw_data: str, graph_json: str, user_summary: str) -> SummaryResponse:
    compact_graph_json = minify_json(graph_json)
    developed_prompt = (
        summary_generation_template + "\n<<<"
        + "\n1. Raw Data:\n" + raw_data
        + "\n2. JSON-Formatted Graph:\n" + compact_graph_json
        + "\n3. Draft Summary:\n" + user_summary
    )

    payload = {
        "model": "qwen2.5-coder",
        "prompt": developed_prompt,
        "stream": False
    }

    r = requests.post(ollama_url, json=payload)
    r.raise_for_status()

    data = r.json()
    parsed = json.loads(data.get("response", "").strip().replace("```json", "").replace("```", "").strip())

    return cast(SummaryResponse, parsed)

@router.post("/summarise")
def summarise(req: GenerateSummary):
    return generate_summary(req.rawData, req.graphJson, req.userSummary)
