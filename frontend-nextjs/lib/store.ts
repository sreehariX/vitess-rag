import { create } from 'zustand';
import { SearchResult, searchDocumentation } from './api-service';
import { summarizeResults, enhanceQuery } from './ai-service';

interface SearchState {
  query: string;
  enhancedQuery: string;
  queryType: 'enhanced' | 'raw';
  version: string;
  n_results: number;
  results: SearchResult[];
  summary: string;
  isLoading: boolean;
  isSummarizing: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  setQueryType: (type: 'enhanced' | 'raw') => void;
  setVersion: (version: string) => void;
  setNResults: (n: number) => void;
  search: () => Promise<void>;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  enhancedQuery: '',
  queryType: 'enhanced',
  version: 'v22.0 (Development)',
  n_results: 10,
  results: [],
  summary: '',
  isLoading: false,
  isSummarizing: false,
  error: null,
  setQuery: (query) => set({ query }),
  setQueryType: (type) => set({ queryType: type }),
  setVersion: (version) => set({ version }),
  setNResults: (n) => set({ n_results: n }),
  search: async () => {
    const { query, queryType, version, n_results } = get();
    if (!query.trim()) return;
    
    set({ isLoading: true, error: null, summary: '' });
    
    try {
      // Enhance the query if queryType is 'enhanced'
      let searchQuery = query;
      let enhancedQueryText = '';
      
      if (queryType === 'enhanced') {
        try {
          const enhanceResponse = await fetch('/api/enhance-query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });
          
          if (!enhanceResponse.ok) {
            console.warn('Failed to enhance query, using original query instead');
            enhancedQueryText = query;
            searchQuery = query;
          } else {
            const enhanceData = await enhanceResponse.json();
            enhancedQueryText = enhanceData.enhancedQuery || query; // Use original query as fallback
            searchQuery = enhancedQueryText;
          }
          set({ enhancedQuery: enhancedQueryText });
        } catch (enhanceError) {
          console.warn('Error enhancing query, using original query instead:', enhanceError);
          enhancedQueryText = query;
          searchQuery = query;
          set({ enhancedQuery: enhancedQueryText });
        }
      } else {
        set({ enhancedQuery: '' });
      }
      
      // Always include resources
      const include_resources = true;
      
      // Use enhanced query for vector search, but keep original query for reference
      const response = await searchDocumentation(searchQuery, version, n_results, include_resources);
      set({ results: response.results, isLoading: false });
      
      // Generate summary with streaming
      if (response.results.length > 0) {
        set({ isSummarizing: true });
        try {
          const res = await fetch('/api/summarize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              results: response.results,
              originalQuery: query // Send original query, not enhanced query 
            }),
          });

          if (!res.ok) {
            throw new Error('Failed to generate summary');
          }

          // Ensure we're handling the response as a stream
          if (!res.body) {
            throw new Error('Response body is null');
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let summary = '';

          set({ summary: '' }); // Reset summary before streaming

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            summary += chunk;
            
            // Update summary in real-time with each chunk
            set({ summary });
          }

          set({ isSummarizing: false });
        } catch (summaryError: any) {
          console.error("Summary generation error:", summaryError);
          
          // Create a simple fallback summary with the notification and results
          let fallbackSummary = `# Vitess Documentation Search Results\n\n`;
          
          // Add notification about API key usage
          fallbackSummary += `> **Note:** The summary generation is currently unavailable. Showing raw results from the documentation.\n\n`;
          
          fallbackSummary += `**Your query:** ${query}\n\n`;
          
          response.results.forEach((result, index) => {
            const score = (result.similarity_score * 100).toFixed(1);
            fallbackSummary += `## ${index + 1}. ${result.metadata.title} (${score}% match)\n\n`;
            
            fallbackSummary += `- **Version**: ${result.metadata.version_or_commonresource}\n`;
            fallbackSummary += `- **Source**: [${index + 1}](${result.metadata.url})\n\n`;
            
            // Add document content directly
            fallbackSummary += `### Content\n\n`;
            fallbackSummary += `${result.document}\n\n`;
            
            fallbackSummary += `---\n\n`;
          });
          
          // Add references section
          fallbackSummary += `## References\n\n`;
          response.results.forEach((result, index) => {
            fallbackSummary += `[${index + 1}] [${result.metadata.title}](${result.metadata.url})\n\n`;
          });
          
          set({ 
            isSummarizing: false,
            summary: fallbackSummary
          });
        }
      }
    } catch (error: any) {
      console.error("Search error:", error);
      set({ 
        error: error.message || 'Failed to search documentation', 
        isLoading: false,
        isSummarizing: false 
      });
    }
  },
  clearResults: () => set({ results: [], summary: '', query: '', enhancedQuery: '' }),
})); 