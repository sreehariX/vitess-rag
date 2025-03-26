import { NextRequest } from 'next/server';
import { enhanceQuery } from '@/lib/ai-service';

// This is required to make the API route work with static exports
export const dynamic = 'force-dynamic';
export const runtime = 'edge'; // Use edge runtime for better performance

export async function POST(req: NextRequest) {
  // Check for API key in environment variables first
  let apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured. Please set your API key in the environment variables." }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const body = await req.json();
    const { query } = body;
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    let enhancedQuery;
    try {
      enhancedQuery = await enhanceQuery(query);
    } catch (aiError) {
      console.error("AI enhancement failed, using original query:", aiError);
      enhancedQuery = query; // Use original query as fallback
    }
    
    return new Response(
      JSON.stringify({ enhancedQuery }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error("Error in enhance-query route:", error);
    // Return empty query when anything fails
    return new Response(
      JSON.stringify({ enhancedQuery: "" }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 