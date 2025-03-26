import { NextRequest } from 'next/server';
import { summarizeResults } from '@/lib/ai-service';
import { SearchResult } from '@/lib/api-service';

// This is required to make the API route work with static exports
export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Use edge runtime for better streaming support

export async function POST(req: NextRequest) {
  // Check for API key in environment variables first
  let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured. Please set your API key in the settings." }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.json();
    const { results, originalQuery } = body;
    
    if (!results || !Array.isArray(results)) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Pass the original query to summarizeResults
    return await summarizeResults(results as SearchResult[], originalQuery || "");
  } catch (error) {
    console.error("Error in summarize route:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate summary" }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 