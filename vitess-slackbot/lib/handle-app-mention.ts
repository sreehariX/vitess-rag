import { AppMentionEvent } from "@slack/web-api";
import { client, getThread } from "./slack-utils";
import { generateResponse } from "./generate-response";

const updateStatusUtil = async (
  initialStatus: string,
  event: AppMentionEvent,
) => {
  const initialMessage = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: initialStatus,
  });

  if (!initialMessage || !initialMessage.ts)
    throw new Error("Failed to post initial message");

  const updateMessage = async (status: string) => {
    await client.chat.update({
      channel: event.channel,
      ts: initialMessage.ts as string,
      text: status,
    });
  };
  return updateMessage;
};

export async function handleNewAppMention(
  event: AppMentionEvent,
  botUserId: string,
) {
  console.log("Handling app mention");
  if (event.bot_id || event.bot_id === botUserId || event.bot_profile) {
    console.log("Skipping app mention");
    return;
  }

  const { thread_ts, channel } = event;
  const updateMessage = await updateStatusUtil("is thinking...", event);

  try {
    console.log("Processing app mention request...");
    
    if (thread_ts) {
      console.log("Fetching thread messages...");
      const messages = await getThread(channel, thread_ts, botUserId);
      
      console.log(`Generating response for ${messages.length} messages...`);
      const result = await generateResponse(messages, updateMessage);
      console.log("Response generated successfully");
      
      updateMessage(result);
    } else {
      console.log("Processing single message...");
      const result = await generateResponse(
        [{ role: "user", content: event.text }],
        updateMessage
      );
      console.log("Response generated successfully");
      
      updateMessage(result);
    }
    
    console.log("App mention handled successfully");
  } catch (error) {
    console.error("Error in handleNewAppMention:", error);
    
    try {
      // Provide a fallback response when errors occur
      updateMessage("Sorry, I encountered an error while processing your request. Please try again later.");
    } catch (updateError) {
      console.error("Failed to update with error message:", updateError);
      
      // Last resort: try to post a new message
      try {
        await client.chat.postMessage({
          channel: event.channel,
          thread_ts: event.thread_ts ?? event.ts,
          text: "Sorry, I encountered an error while processing your request. Please try again later.",
        });
      } catch (postError) {
        console.error("Failed to post error message:", postError);
      }
    }
  }
}
