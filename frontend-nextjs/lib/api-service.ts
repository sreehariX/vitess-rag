// API service for handling backend requests

export interface SearchResult {
  document: string;
  metadata: {
    title: string;
    url: string;
    version_or_commonresource: string;
    id_parent: string;
    char_count?: string;
    chunk_index?: string;
    total_chunks?: string;
  };
  similarity_score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  filter_used: any;
}

export async function searchDocumentation(
  query: string, 
  version: string = "v22.0 (Development)", 
  n_results: number = 10,
  include_resources: boolean = true
): Promise<SearchResponse> {
  try {
    const response = await fetch('https://vitess-backend-api-fk655.ondigitalocean.app/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query, 
        version, 
        n_results, 
        include_resources 
      }),
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error searching Vitess documentation:', error);
    return { results: [], filter_used: null };
  }
}
