import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { SearchResult } from './api-service';

// Create a Google provider instance with server-side API key
const createAIProvider = () => {
  // Use the server-side environment variable without NEXT_PUBLIC_ prefix
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Generative AI API key is missing');
  }

  return createGoogleGenerativeAI({
    apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  });
};

export async function enhanceQuery(userQuery: string): Promise<string> {
  if (!userQuery || userQuery.trim() === '') {
    return userQuery;
  }

  try {
    const googleAI = createAIProvider();
    const model = googleAI('gemini-2.0-flash');

    const prompt = `
    You are a search query enhancer for Vitess documentation search system.
    Your task is to improve the user's search query to make it more effective for semantic search in a vector database of Vitess documentation.
    
    Original query: "${userQuery}"
    
    Enhance this query by:
    1. Expanding the user query to make it more accurate in vector database search
    2. Expanding abbreviations
    3. Including synonyms for technical terms
    4. Improving specificity while maintaining the original intent
    
    Return ONLY the enhanced query text with no explanations or additional text.
    `;

    const result = await generateText({
      model,
      prompt,
    });

    return result.text.trim();
  } catch (error) {
    console.error("Error enhancing query:", error);
    // Return the original query as fallback
    return userQuery;
  }
}

export async function summarizeResults(results: SearchResult[], originalQuery: string = ""): Promise<Response> {
  if (!results || results.length === 0) {
    return new Response("No results found.");
  }

  try {
    // Format the results into a structured text
    const formattedResults = results.map((result, index) => {
      return `
Document ${index + 1}: ${result.metadata.title}
Content: ${result.document}
URL: ${result.metadata.url}
Version: ${result.metadata.version_or_commonresource}
Similarity Score: ${(result.similarity_score * 100).toFixed(1)}%
`;
    }).join("\n");

    const promptText = `
You are a technical documentation assistant for Vitess. Your task is to answer the user's question using the provided documentation snippets.

User question: "${originalQuery}"

Follow these guidelines when creating your response:
1. Answer the question clearly and concisely based on the documentation provided
2. Maintain technical accuracy and use Vitess terminology correctly
3. Format your response with proper markdown for readability
5. For code examples or CLI commands, use proper markdown code blocks with appropriate syntax highlighting
6. At the end of your response, include a "References" section with all the links in markdown format

Here are the documentation snippets:
${formattedResults}
`;

    try {
      const googleAI = createAIProvider();
      const model = googleAI('gemini-2.0-flash');

      const result = await streamText({
        model,
        prompt: promptText,
        onError: (error) => {
          console.error("Error in streamText:", error);
        }
      });

      if (!result || !result.toTextStreamResponse) {
        throw new Error("Failed to generate text stream response");
      }

      // Return a streaming response directly
      return result.toTextStreamResponse();
    } catch (streamError) {
      console.error("Error in streamText:", streamError);
      // When there's an error with the AI service, use the fallback
      const fallbackSummary = generateFallbackSummary(results);
      return new Response(fallbackSummary, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  } catch (error) {
    console.error("Error generating summary:", error);
    // Use fallback for any error in the summarization process
    const fallbackSummary = generateFallbackSummary(results);
    return new Response(fallbackSummary, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Helper function to create a nice fallback summary
function generateFallbackSummary(results: SearchResult[]): string {
  let summary = `# Vitess Documentation Search Results\n\n`;
  
  // Add notification about API key usage
  summary += `> **Note:** The summary generation is currently unavailable. Showing raw results from the documentation.\n\n`;
  
  results.forEach((result, index) => {
    const score = (result.similarity_score * 100).toFixed(1);
    summary += `## ${index + 1}. ${result.metadata.title} (${score}% match)\n\n`;
    
    // Add key information
    summary += `- **Version**: ${result.metadata.version_or_commonresource}\n`;
    summary += `- **Source**: [${index + 1}](${result.metadata.url})\n\n`;
    
    // Add document content directly
    summary += `### Content\n\n`;
    summary += `${result.document}\n\n`;
    
    summary += `---\n\n`;
  });
  
  // Add references section at the end
  summary += `## References\n\n`;
  results.forEach((result, index) => {
    summary += `[${index + 1}] [${result.metadata.title}](${result.metadata.url})\n\n`;
  });
  
  return summary;
}

// Helper function to extract sections from a document
interface DocumentSection {
  title?: string;
  content: string;
}

function extractSectionsFromDocument(document: string): DocumentSection[] {
  const sections: DocumentSection[] = [];
  
  // Common section headers in documentation
  const sectionHeaderRegexes = [
    /(?:^|\n)#+\s*(.*?)(?:\n|$)/,                     // Markdown headers
    /(?:^|\n)(.*?)\[edit.*?\](?:\n|$)/,               // Wiki-style headers with [edit]
    /(?:^|\n)(Description|Features|Configuration|Usage|Examples|Troubleshooting):/i, // Common docs section labels
    /(?:^|\n)(Overview|Architecture|Getting Started|Configuration|Installation|Best Practices)(?:\[.*?\])?:/i // More docs sections
  ];
  
  // Split by empty lines first to get paragraphs
  const paragraphs = document.split(/\n\s*\n/);
  
  let currentSection: DocumentSection | null = null;
  
  paragraphs.forEach(paragraph => {
    paragraph = paragraph.trim();
    if (!paragraph) return;
    
    // Check if this paragraph is a header
    let isHeader = false;
    let headerTitle = '';
    
    for (const regex of sectionHeaderRegexes) {
      const match = paragraph.match(regex);
      if (match && match[1]) {
        isHeader = true;
        headerTitle = match[1].trim();
        break;
      }
    }
    
    if (isHeader) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        title: headerTitle,
        content: ''
      };
    } else if (currentSection) {
      // Add to current section content
      currentSection.content += paragraph + '\n\n';
    } else {
      // No section yet, create one without a title
      currentSection = {
        content: paragraph + '\n\n'
      };
    }
  });
  
  // Add the last section
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
} 