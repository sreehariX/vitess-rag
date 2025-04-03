import { CoreMessage } from "ai";

export const generateResponse = async (
  messages: CoreMessage[],
  updateStatus?: (status: string) => void,
) => {
  let text = "";
  
  if (updateStatus) updateStatus("Generating response...");
  
  try {
    // Extract the last user message
    const lastUserMessage = messages.filter(msg => msg.role === "user").pop();
    
    if (!lastUserMessage || !lastUserMessage.content) {
      return "I couldn't understand your question. Please try again.";
    }
    
    const userQuery = lastUserMessage.content.toString();
    
    // Call the Vitess API
    const response = await fetch('https://vitess-backend-api-fk655.ondigitalocean.app/enhance-query-cli', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: userQuery,
        version: "v22.0 (Development)",
        n_results: 10,
        include_resources: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Use the summary from the API response
    text = data.summary || "Sorry, I couldn't find any information about that.";
  } catch (error) {
    console.error("Error generating response:", error);
    text = "Sorry, I encountered an error while generating a response. Please try again later.";
  }

  // Convert markdown to Slack mrkdwn format
  return text.replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>").replace(/\*\*/g, "*");
};
