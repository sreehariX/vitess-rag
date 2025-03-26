# Vitess RAG CLI

A command-line interface for interacting with the Vitess RAG FastAPI endpoint.

> **Note:** All CLI-related files should be kept strictly within the `\vitess-rag\vitess-rag-cli` directory.

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

## Usage

> **Important:** Always run the CLI from within the `vitess-rag-cli` directory

### Basic Query

```bash
# Basic query with default settings (from vitess-rag-cli directory)
./vitess-rag.exe query -q "what is vitess"

# Using the batch file
vitess-rag query -q "what is vitess"

# Specify the number of results
vitess-rag query -q "what is vitess" -n 5

# Specify a different version
vitess-rag query -q "what is vitess" -v "v21.0 (Stable)"
```

### Advanced Options

```bash
# Get JSON output
vitess-rag query -q "what is vitess" -j

# Use a different API endpoint
vitess-rag query -q "what is vitess" -u "http://api.example.com/query"
```

### Available Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--query` | `-q` | Search query | (required) |
| `--version` | `-v` | Documentation version | "v22.0 (Development)" |
| `--nresults` | `-n` | Number of results | 2 |
| `--url` | `-u` | FastAPI endpoint URL | "http://localhost:8000/query" |
| `--json` | `-j` | Output raw JSON response | false |

## Example Output

```
Found 2 results for query: "what is vitess"
===================================

Result 1 (Score: 0.7990):
-----------------------------------
Title: Overview
URL: https://vitess.io/docs/22.0/overview/
Version: v22.0 (Development)

Content:
Edit this page Documentation v22.0 (Development) Overview Overview High-level information about Vitess Pages in this section What Is Vitess Architecture Supported Databases Scalability Philosophy Cloud Native History The Vitess overview documentation provides general information about Vitess that's less immediately practical than what you'll find in Get Started section and the User Guides.

Result 2 (Score: 0.7666):
-----------------------------------
Title: Architecture
URL: https://vitess.io/docs/22.0/overview/architecture/
Version: v22.0 (Development)

Content:
Edit this page Documentation v22.0 (Development) Overview Architecture Architecture << What Is Vitess Supported Databases >> The Vitess platform consists of a number of server processes, command-line utilities, and web-based utilities, backed by a consistent metadata store...
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