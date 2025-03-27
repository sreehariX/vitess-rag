# Vitess RAG CLI

A command-line interface for interacting with the Vitess RAG FastAPI endpoint with AI-powered search and summarization.

> **Note:** All CLI-related files should be kept strictly within the `\vitess-rag\vitess-rag-cli` directory.

## Main Commands

There are two primary ways to use the Vitess RAG CLI:

### 1. Enhanced Query (AI-improved search)

```bash
# Basic usage with AI-enhanced query and summary only
./vitess-rag -q "what is vitess"

# Simplified syntax with positional arguments:
./vitess-rag -q "query" v21.0                  # Specify just version (defaults for other params)
./vitess-rag -q "query" v21.0 15               # Specify version and number of results 
./vitess-rag -q "query" v21.0 15 false         # Specify all parameters

# Show full results including search results
./vitess-rag -q "what is vitess" -f

# Traditional syntax with named flags
./vitess-rag -q "what is vitess" -v "v21.0 (Stable)" -n 15 --include-resources=false
```

### 2. Raw Query (direct search)

```bash
# Basic usage with raw query and summary only
./vitess-rag raw -q "how to add a new shard"

# Simplified syntax with positional arguments:
./vitess-rag raw -q "query" v21.0              # Specify just version (defaults for other params)
./vitess-rag raw -q "query" v21.0 15           # Specify version and number of results
./vitess-rag raw -q "query" v21.0 15 false     # Specify all parameters

# Show full results including search results
./vitess-rag raw -q "how to add a new shard" -f

# Traditional syntax with named flags
./vitess-rag raw -q "how to add a new shard" -v "v21.0 (Stable)" -n 15 --include-resources=false
```

## Simplified Syntax

For convenience, you can provide values as positional arguments after the `-q` flag in this order:
1. Version (e.g., "v21.0")
2. Number of results (e.g., 15)
3. Include resources (true/false)

You can specify only the first parameter (version), the first two (version and number of results), or all three.

**Note:** Short version formats (e.g., "v21.0") are automatically expanded to their full form (e.g., "v21.0 (Stable)") when the request is sent.

Examples:
```bash
# Just specify version (use defaults for other params)
./vitess-rag -q "query" v21.0

# Specify version and number of results
./vitess-rag -q "query" v21.0 15

# Specify all parameters
./vitess-rag -q "query" v21.0 15 false
```

## Default Values

All commands use these defaults unless specified otherwise:
- Version: v22.0 (Development)
- Number of results: 10
- Include common resources: true

## Installation

### Prerequisites

- Go 1.16 or higher
- Vitess RAG FastAPI backend running (default: http://localhost:8000)

### Building from Source

```bash
# Navigate to the CLI directory
cd vitess-rag-cli

# Install dependencies
go get -u

# Build the binary
go build -o vitess-rag.exe
```

## Additional Commands

### Standard Vector Search (No AI)

Use this command for standard vector search without AI enhancement or summary:

```bash
# Standard vector search
./vitess-rag query -q "vitctld commands"

# With positional args
./vitess-rag query -q "vitctld commands" v21.0 5 false
```

### Test Gemini Model Directly

This command bypasses the RAG system and sends your prompt directly to Gemini:

```bash
# Test Gemini model directly
./vitess-rag test -p "Explain how Vitess differs from other database proxies in a few sentences"
```

### View Available Versions

```bash
# List all available Vitess versions
./vitess-rag versions
```

Available versions:
```
v22.0 (Development)   - Latest development version
v21.0 (Stable)        - Latest stable release
v20.0 (Stable)        - Stable release
v19.0 (Archived)      - Archived version
v18.0 (Archived)      - Archived version
v17.0 (Archived)      - Archived version
v16.0 (Archived)      - Archived version
v15.0 (Archived)      - Archived version
v14.0 (Archived)      - Archived version
v13.0 (Archived)      - Archived version
v12.0 (Archived)      - Archived version
v11.0 (Archived)      - Archived version
```

### Advanced Options

```bash
# Get JSON output for any command
./vitess-rag -q "what is vitess" -j

# Use a different API endpoint
./vitess-rag -q "what is vitess" -u "http://api.example.com"
```

### Getting Help

```bash
# Get general help
./vitess-rag help

# Get help for a specific command
./vitess-rag help enhanced
```

## Available Flags

For the main commands (`./vitess-rag -q` and `./vitess-rag raw -q`):

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--query` | `-q` | Search query | (required) |
| `--version` | `-v` | Documentation version | "v22.0 (Development)" |
| `--nresults` | `-n` | Number of results | 10 |
| `--include-resources` | none | Include common resources | true |
| `--url` | `-u` | FastAPI base URL | "http://localhost:8000" |
| `--json` | `-j` | Output raw JSON response | false |
| `--full` | `-f` | Show full results including search results | false |

For the `test` command:

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--prompt` | `-p` | Prompt to send to Gemini | (required) |
| `--url` | `-u` | FastAPI base URL | "http://localhost:8000" |

## Example Output

```
===== AI-GENERATED ANSWER =====
# Vitess Sharding

Vitess uses horizontal sharding to scale databases. To shard a keyspace in Vitess, you need to:

1. Plan your sharding strategy and choose a primary vindex (sharding key)
2. Create the target shards using `vtctlclient CreateShard`
3. Run the `Reshard` workflow to copy data from source to target shards
4. Switch reads and writes to the new shards using `SwitchReads` and `SwitchWrites`
5. Cleanup the original shard once migration is complete

The process preserves availability and ensures data consistency during migration.

## References

[1] https://vitess.io/docs/22.0/user-guides/configuration-basic/sharding/
[2] https://vitess.io/docs/22.0/reference/vreplication/reshard/
================================
```

## Directory Structure

```
vitess-rag/
└── vitess-rag-cli/       # All CLI-related files must be in this directory
    ├── main.go           # CLI source code
    ├── go.mod            # Go module definition
    ├── go.sum            # Go module checksums
    ├── vitess-rag.exe    # Compiled executable (Windows)
    ├── vitess-rag.bat    # Batch helper script (Windows)
    └── README.md         # This documentation
```

## Development

To add new commands or features, check the Cobra documentation at https://github.com/spf13/cobra. 