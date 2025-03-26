from google import genai
from google.genai.types import EmbedContentConfig
from google.genai import types



client = genai.Client(
    api_key='AIzaSyCfFGE5imXs5OlrngVWT_5xDUf0njThMM4',
    
)

response = client.models.embed_content(
    model="models/text-embedding-004",
    contents=[
        "How do I get a driver's license/learner's permit?",
        "How do I renew my driver's license?",
        "How do I change my address on my driver's license?",
    ],
    config=EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",  # Optional
        output_dimensionality=768,  # Optional
        title="Driver's License",  # Optional
    ),
)
print(response)
# Example response:
# embeddings=[ContentEmbedding(values=[-0.06302902102470398, 0.00928034819662571, 0.014716853387653828, -0.028747491538524628, ... ],
# statistics=ContentEmbeddingStatistics(truncated=False, token_count=13.0))]
# metadata=EmbedContentMetadata(billable_character_count=112)