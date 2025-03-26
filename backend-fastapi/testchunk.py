import yaml
import json
import os
from dotenv import load_dotenv
from datetime import datetime

# Load YAML file
def load_vitess_docs(yaml_path="vitess_docs.yaml"):
    with open(yaml_path, 'r', encoding='utf-8') as file:
        data = yaml.safe_load(file)
    return data

def split_content_by_tokens_fast(content, max_tokens=2000, chars_per_token=4):
    """Fast and reliable content chunking by character count."""
    # Normalize newlines to spaces for consistent processing
    normalized_content = content.replace('\n', ' ').replace('\r', ' ')
    # Remove multiple spaces
    normalized_content = ' '.join(normalized_content.split())
    
    max_chars = max_tokens * chars_per_token
    
    # Quick return if content fits in one chunk
    if len(normalized_content) <= max_chars:
        print(f"Content fits in one chunk ({len(normalized_content)} chars, ~{len(normalized_content)/chars_per_token:.0f} tokens)")
        return [normalized_content]
    
    chunks = []
    start = 0
    
    print(f"Content too large ({len(normalized_content)} chars, ~{len(normalized_content)/chars_per_token:.0f} tokens). Splitting...")
    
    while start < len(normalized_content):
        # Determine end position of this chunk
        end = min(start + max_chars, len(normalized_content))
        
        # If we're not at the end of the content, find last space
        if end < len(normalized_content):
            # Look for the last space within the chunk
            last_space = normalized_content.rfind(' ', start, end)
            
            if last_space != -1:  # If we found a space
                print(f"Found space at position {last_space}, cutting chunk here")
                end = last_space  # Cut at the space
            else:
                print(f"No space found in chunk, cutting at max chars ({end})")
        
        # Add the chunk and move to next position
        chunk = normalized_content[start:end]
        chunks.append(chunk)
        print(f"Created chunk #{len(chunks)}: {len(chunk)} chars, ~{len(chunk)/chars_per_token:.0f} tokens")
        
        start = end + 1  # Skip the space
    
    print(f"Created {len(chunks)} chunks in total")
    return chunks

def test_chunking():
    print("\n--- TESTING CHUNKING ALGORITHM ON VITESS DOCS ---\n")
    
    # Generate timestamp for the output file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = f"chunk_test_results_{timestamp}.json"
    
    # Results dictionary
    results = {
        "test_timestamp": timestamp,
        "max_tokens_per_chunk": 2000,
        "chars_per_token_ratio": 4,
        "documents": []
    }
    
    # Load data
    try:
        data = load_vitess_docs()
        print(f"Successfully loaded vitess_docs.yaml")
    except Exception as e:
        print(f"Error loading YAML file: {str(e)}")
        return
    
    # Process first 10 docs
    docs = data.get('vitess', [])[:10]
    print(f"Processing first {len(docs)} documents from vitess_docs.yaml\n")
    
    for i, doc in enumerate(docs):
        title = doc.get('title', 'Untitled')
        content = doc.get('content', '').strip()
        url = doc.get('url', '')
        id_parent = doc.get('id_parent', '')
        
        print(f"\n=== Document {i+1}: {title} ===")
        print(f"URL: {url}")
        
        # Display original content length
        print(f"Original content length: {len(content)} characters")
        
        # Convert newlines to spaces for display
        original_preview = content[:50].replace('\n', ' ')
        print(f"Original preview: {original_preview}...")
        
        doc_result = {
            "id_parent": id_parent,
            "title": title,
            "url": url,
            "content_length": len(content),
            "estimated_tokens": len(content) // 4,
            "chunks": []
        }
        
        # Skip empty content
        if not content:
            print("Empty content, skipping...")
            doc_result["error"] = "Empty content"
            results["documents"].append(doc_result)
            continue
        
        # Split content
        print("\nSplitting content:")
        chunks = split_content_by_tokens_fast(content)
        
        print("\nResults:")
        for j, chunk in enumerate(chunks):
            # Create clean previews for display
            start_preview = chunk[:50]
            end_preview = chunk[-50:] if len(chunk) > 50 else chunk
            
            chunk_info = {
                "chunk_index": j,
                "length_chars": len(chunk),
                "estimated_tokens": len(chunk) // 4,
                "starts_with": start_preview,
                "ends_with": end_preview,
                "content": chunk  # Full chunk content with newlines converted to spaces
            }
            doc_result["chunks"].append(chunk_info)
            
            print(f"Chunk {j+1}: {len(chunk)} chars, ~{len(chunk)//4} tokens")
            print(f"  Starts with: {start_preview}...")
            print(f"  Ends with: ...{end_preview}")
            
        doc_result["total_chunks"] = len(chunks)
        results["documents"].append(doc_result)
        print(f"\nTotal chunks: {len(chunks)}")
        print("-" * 80)
    
    # Save results to JSON file
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults saved to {output_file}")
    except Exception as e:
        print(f"\nError saving results to JSON: {str(e)}")

if __name__ == "__main__":
    test_chunking()