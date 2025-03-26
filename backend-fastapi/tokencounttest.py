# import os
# import google.generativeai as genai


# genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# # Your prompt text
# prompt = "Note that the 4-characters-per-token is just a rough approximation. Modern tokenizers like those used in Gemini models are context-aware and handle different languages, special characters, and common words differently, so the actual token count can vary significantly from this simple estimate."

# # Count tokens using the gemini-2.0-flash model
# model = genai.GenerativeModel('gemini-2.0-flash')
# token_count_result = model.count_tokens(prompt)
# actual_tokens = token_count_result.total_tokens

# # Calculate tokens using the approximation (4 characters = 1 token)
# char_count = len(prompt)
# estimated_tokens = (char_count + 3) // 4  # Using integer division with ceiling effect

# # Print the results and comparison
# print(f"Prompt text: '{prompt}'")
# print(f"Character count: {char_count}")
# print(f"Estimated tokens (4 chars = 1 token): {estimated_tokens}")
# print(f"Actual tokens from API: {actual_tokens}")
# print(f"Difference: {actual_tokens - estimated_tokens} tokens")
# print(f"Approximation accuracy: {(estimated_tokens/actual_tokens)*100:.2f}% of actual")


import os
import google.generativeai as genai


genai.configure(api_key=os.environ["GEMINI_API_KEY"])

# Your prompt text
prompt = "Note that the 4-characters-per-token is just a rough approximation. Modern tokenizers like those used in Gemini models are context-aware and handle different languages, special characters, and common words differently, so the actual token count can vary significantly from this simple estimate."

# Function to split text into approximately 10-token chunks
def split_into_token_chunks(text, chunk_size=10):
    model = genai.GenerativeModel('gemini-2.0-flash')
    chunks = []
    current_chunk = ""
    
    # Process the text word by word
    words = text.split()
    for word in words:
        # Try adding the next word
        test_chunk = current_chunk + " " + word if current_chunk else word
        # Count tokens in the test chunk
        token_count = model.count_tokens(test_chunk).total_tokens
        
        if token_count <= chunk_size:
            # If still under our limit, add the word
            current_chunk = test_chunk
        else:
            # If we would exceed the limit, store current chunk and start a new one
            chunks.append((current_chunk, model.count_tokens(current_chunk).total_tokens))
            current_chunk = word
    
    # Add the last chunk if it's not empty
    if current_chunk:
        chunks.append((current_chunk, model.count_tokens(current_chunk).total_tokens))
    
    return chunks

# Split the prompt into chunks of approximately 10 tokens
chunks = split_into_token_chunks(prompt)

# Print each chunk with its token count
print(f"Original prompt: '{prompt}'")
print(f"Total tokens in full prompt: {genai.GenerativeModel('gemini-2.0-flash').count_tokens(prompt).total_tokens}")
print("\nChunks (approximately 10 tokens each):")
for i, (chunk, token_count) in enumerate(chunks, 1):
    char_count = len(chunk)
    print(f"Chunk {i} ({token_count} tokens, {char_count} chars): '{chunk}'")

# Print the original code's token estimation as well
char_count = len(prompt)
estimated_tokens = (char_count + 3) // 4
actual_tokens = genai.GenerativeModel('gemini-2.0-flash').count_tokens(prompt).total_tokens
print(f"\nCharacter count: {char_count}")
print(f"Estimated tokens (4 chars = 1 token): {estimated_tokens}")
print(f"Actual tokens from API: {actual_tokens}")
print(f"Difference: {actual_tokens - estimated_tokens} tokens")
print(f"Approximation accuracy: {(estimated_tokens/actual_tokens)*100:.2f}% of actual")

# Function to split text into chunks based on character estimation
def split_into_char_estimated_chunks(text, chars_per_token=4, tokens_per_chunk=10):
    # Calculate characters per chunk (approximately)
    chars_per_chunk = chars_per_token * tokens_per_chunk
    
    chunks = []
    words = text.split()
    current_chunk = ""
    current_char_count = 0
    
    for word in words:
        # If adding this word would exceed our character limit
        if current_char_count + len(word) + (1 if current_chunk else 0) > chars_per_chunk and current_chunk:
            # Store current chunk and start a new one
            estimated_tokens = (len(current_chunk) + 3) // 4
            chunks.append((current_chunk, estimated_tokens))
            current_chunk = word
            current_char_count = len(word)
        else:
            # Add space if not the first word in chunk
            if current_chunk:
                current_chunk += " " + word
                current_char_count += 1 + len(word)  # +1 for the space
            else:
                current_chunk = word
                current_char_count = len(word)
    
    # Add the last chunk if it's not empty
    if current_chunk:
        estimated_tokens = (len(current_chunk) + 3) // 4
        chunks.append((current_chunk, estimated_tokens))
    
    return chunks

# Split the prompt into chunks based on character estimation (roughly 10 tokens)
char_estimated_chunks = split_into_char_estimated_chunks(prompt)

# Print these chunks
print("\nCharacter-estimated chunks (approximately 10 tokens each):")
for i, (chunk, estimated_tokens) in enumerate(char_estimated_chunks, 1):
    # Calculate actual tokens for comparison
    actual_tokens = genai.GenerativeModel('gemini-2.0-flash').count_tokens(chunk).total_tokens
    char_count = len(chunk)
    print(f"Chunk {i} (est: {estimated_tokens} tokens, actual: {actual_tokens} tokens, {char_count} chars): '{chunk}'")

print(f"Approximation accuracy: {(estimated_tokens/actual_tokens)*100:.2f}% of actual")