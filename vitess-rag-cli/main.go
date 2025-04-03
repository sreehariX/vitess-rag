package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"
)

type RequestBody struct {
	Query            string `json:"query"`
	Version          string `json:"version"`
	NResults         int    `json:"n_results"`
	IncludeResources bool   `json:"include_resources"`
}

type ResponseData struct {
	Results []struct {
		Document string `json:"document"`
		Metadata struct {
			ApproxTokenCount string `json:"approx_token_count"`
			CharCount        string `json:"char_count"`
			ChunkIndex       string `json:"chunk_index"`
			IdParent         string `json:"id_parent"`
			Title            string `json:"title"`
			TotalChunks      string `json:"total_chunks"`
			URL              string `json:"url"`
			Version          string `json:"version_or_commonresource"`
		} `json:"metadata"`
		SimilarityScore float64 `json:"similarity_score"`
	} `json:"results"`
	FilterUsed    map[string]interface{} `json:"filter_used,omitempty"`
	Summary       string                 `json:"summary,omitempty"`
	EnhancedQuery string                 `json:"enhanced_query,omitempty"`
}

// getFullVersionString converts short version strings like "v21.0" to their full form with labels
// e.g., "v21.0 (Stable)" based on the version type
func getFullVersionString(version string) string {
	// If it already has a label in parentheses, return as is
	if strings.Contains(version, "(") && strings.Contains(version, ")") {
		return version
	}

	// Map of version prefixes to their full forms
	versionMap := map[string]string{
		"v22.0": "v22.0 (Development)",
		"v21.0": "v21.0 (Stable)",
		"v20.0": "v20.0 (Stable)",
		"v19.0": "v19.0 (Archived)",
		"v18.0": "v18.0 (Archived)",
		"v17.0": "v17.0 (Archived)",
		"v16.0": "v16.0 (Archived)",
		"v15.0": "v15.0 (Archived)",
		"v14.0": "v14.0 (Archived)",
		"v13.0": "v13.0 (Archived)",
		"v12.0": "v12.0 (Archived)",
		"v11.0": "v11.0 (Archived)",
	}

	// If the version is in our map, return the full form
	if fullVersion, ok := versionMap[version]; ok {
		return fullVersion
	}

	// If not found, return the original version
	return version
}

// parsePositionalArgs handles positional arguments after a query flag
// It supports multiple formats:
// 1. -q "query" version
// 2. -q "query" version numResults
// 3. -q "query" version numResults includeResources
func parsePositionalArgs(args []string, version *string, nResults *int, includeResources *bool) {
	// If no args provided, return early
	if len(args) == 0 {
		return
	}

	// First positional arg is version
	*version = getFullVersionString(args[0])

	// Second positional arg is n_results if it exists and is a valid integer
	if len(args) >= 2 {
		if n, err := strconv.Atoi(args[1]); err == nil {
			*nResults = n
		}
	}

	// Third positional arg is include_resources if it exists
	if len(args) >= 3 {
		includeStr := strings.ToLower(args[2])
		if includeStr == "false" {
			*includeResources = false
		} else if includeStr == "true" {
			*includeResources = true
		}
	}
}

var rootCmd = &cobra.Command{
	Use:   "vitess-rag",
	Short: "CLI for Vitess RAG API interaction",
	Long:  `A command-line interface for interacting with the Vitess RAG FastAPI endpoint with AI-powered search.`,
	// Don't try to validate unknown args since we're manually parsing positional args
	DisableFlagParsing: false,
	Args:               cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		// If query flag is directly set on root command, use enhanced search with summary-only by default
		query, _ := cmd.Flags().GetString("query")
		if query != "" {
			// Get other flags
			version, _ := cmd.Flags().GetString("version")
			nResults, _ := cmd.Flags().GetInt("nresults")
			includeResources, _ := cmd.Flags().GetBool("include-resources")

			// Only pass non-flag arguments to parsePositionalArgs
			var positionalArgs []string
			for _, arg := range args {
				if !strings.HasPrefix(arg, "-") {
					positionalArgs = append(positionalArgs, arg)
				}
			}

			// Process any positional arguments
			if len(positionalArgs) > 0 {
				parsePositionalArgs(positionalArgs, &version, &nResults, &includeResources)
			}

			apiURL, _ := cmd.Flags().GetString("url")
			url := apiURL + "/enhance-query-cli"

			requestBody := RequestBody{
				Query:            query,
				Version:          version,
				NResults:         nResults,
				IncludeResources: includeResources,
			}

			jsonData, err := json.Marshal(requestBody)
			if err != nil {
				fmt.Printf("Error marshaling JSON: %v\n", err)
				return
			}

			resp, err := http.Post(
				url,
				"application/json",
				bytes.NewBuffer(jsonData),
			)
			if err != nil {
				fmt.Printf("Request failed: %v\n", err)
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				fmt.Printf("Error: HTTP Status %d\n", resp.StatusCode)
				var errResp map[string]interface{}
				if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
					jsonStr, _ := json.MarshalIndent(errResp, "", "  ")
					fmt.Println(string(jsonStr))
				}
				return
			}

			var responseData ResponseData
			if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
				fmt.Printf("Error decoding response: %v\n", err)
				return
			}

			jsonOutput, _ := cmd.Flags().GetBool("json")
			if jsonOutput {
				// Output raw JSON
				prettyJSON, err := json.MarshalIndent(responseData, "", "  ")
				if err != nil {
					fmt.Printf("Error formatting JSON: %v\n", err)
					return
				}
				fmt.Println(string(prettyJSON))
				return
			}

			// Display AI summary only by default for root command
			if responseData.Summary != "" {
				fmt.Println("\n=====summarized enhanced query response=====")
				fmt.Println(responseData.Summary)
				fmt.Println("================================\n")
			}

			// Only show the enhanced query if full flag is set
			full, _ := cmd.Flags().GetBool("full")
			if full && responseData.EnhancedQuery != "" {
				fmt.Printf("\nOriginal query: \"%s\"\n", query)
				fmt.Printf("Enhanced query: \"%s\"\n", responseData.EnhancedQuery)

				// Display search results
				fmt.Printf("\nFound %d search results\n", len(responseData.Results))
				fmt.Println("===================================")

				for i, result := range responseData.Results {
					fmt.Printf("\nResult %d (Score: %.4f):\n", i+1, result.SimilarityScore)
					fmt.Println("-----------------------------------")
					fmt.Printf("Title: %s\n", result.Metadata.Title)
					fmt.Printf("URL: %s\n", result.Metadata.URL)
					fmt.Printf("Version: %s\n", result.Metadata.Version)
					fmt.Println("\nContent:")
					fmt.Printf("%s\n", result.Document)
				}
			}
			return
		}
		// If no query is provided, show help
		cmd.Help()
	},
}

var queryCmd = &cobra.Command{
	Use:   "query",
	Short: "Send query to FastAPI endpoint",
	Long: `Send a query to the standard FastAPI endpoint.
This performs a vector search on the Vitess documentation without any AI enhancement.`,
	Args: cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		query, _ := cmd.Flags().GetString("query")
		version, _ := cmd.Flags().GetString("version")
		nResults, _ := cmd.Flags().GetInt("nresults")
		includeResources, _ := cmd.Flags().GetBool("include-resources")

		// Only pass non-flag arguments to parsePositionalArgs
		var positionalArgs []string
		for _, arg := range args {
			if !strings.HasPrefix(arg, "-") {
				positionalArgs = append(positionalArgs, arg)
			}
		}

		// Process any positional arguments
		if len(positionalArgs) > 0 {
			parsePositionalArgs(positionalArgs, &version, &nResults, &includeResources)
		}

		apiURL, _ := cmd.Flags().GetString("url")
		url := apiURL + "/query"

		requestBody := RequestBody{
			Query:            query,
			Version:          version,
			NResults:         nResults,
			IncludeResources: includeResources,
		}

		jsonData, err := json.Marshal(requestBody)
		if err != nil {
			fmt.Printf("Error marshaling JSON: %v\n", err)
			return
		}

		resp, err := http.Post(
			url,
			"application/json",
			bytes.NewBuffer(jsonData),
		)
		if err != nil {
			fmt.Printf("Request failed: %v\n", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Error: HTTP Status %d\n", resp.StatusCode)
			// Print response body for more details
			var errResp map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
				jsonStr, _ := json.MarshalIndent(errResp, "", "  ")
				fmt.Println(string(jsonStr))
			}
			return
		}

		var responseData ResponseData
		if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
			fmt.Printf("Error decoding response: %v\n", err)
			return
		}

		jsonOutput, _ := cmd.Flags().GetBool("json")
		if jsonOutput {
			// Output raw JSON
			prettyJSON, err := json.MarshalIndent(responseData, "", "  ")
			if err != nil {
				fmt.Printf("Error formatting JSON: %v\n", err)
				return
			}
			fmt.Println(string(prettyJSON))
			return
		}

		// Display results in readable format
		fmt.Printf("\nFound %d results for query: \"%s\"\n", len(responseData.Results), query)
		fmt.Println("===================================")

		for i, result := range responseData.Results {
			fmt.Printf("\nResult %d (Score: %.4f):\n", i+1, result.SimilarityScore)
			fmt.Println("-----------------------------------")
			fmt.Printf("Title: %s\n", result.Metadata.Title)
			fmt.Printf("URL: %s\n", result.Metadata.URL)
			fmt.Printf("Version: %s\n", result.Metadata.Version)
			fmt.Println("\nContent:")
			fmt.Printf("%s\n", result.Document)
		}
	},
}

var enhancedQueryCmd = &cobra.Command{
	Use:   "enhanced",
	Short: "Send AI-enhanced query to search Vitess docs",
	Long: `Send a query that is first enhanced by AI before searching.
This command uses the Gemini model to improve your search query for better results,
then returns both search results and an AI-generated summary that answers your question.

By default, only the AI summary is shown. Use --full to see search results.`,
	Args: cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		query, _ := cmd.Flags().GetString("query")
		version, _ := cmd.Flags().GetString("version")
		nResults, _ := cmd.Flags().GetInt("nresults")
		includeResources, _ := cmd.Flags().GetBool("include-resources")

		// Only pass non-flag arguments to parsePositionalArgs
		var positionalArgs []string
		for _, arg := range args {
			if !strings.HasPrefix(arg, "-") {
				positionalArgs = append(positionalArgs, arg)
			}
		}

		// Process any positional arguments
		if len(positionalArgs) > 0 {
			parsePositionalArgs(positionalArgs, &version, &nResults, &includeResources)
		}

		apiURL, _ := cmd.Flags().GetString("url")
		url := apiURL + "/enhance-query-cli"

		requestBody := RequestBody{
			Query:            query,
			Version:          version,
			NResults:         nResults,
			IncludeResources: includeResources,
		}

		jsonData, err := json.Marshal(requestBody)
		if err != nil {
			fmt.Printf("Error marshaling JSON: %v\n", err)
			return
		}

		resp, err := http.Post(
			url,
			"application/json",
			bytes.NewBuffer(jsonData),
		)
		if err != nil {
			fmt.Printf("Request failed: %v\n", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Error: HTTP Status %d\n", resp.StatusCode)
			var errResp map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
				jsonStr, _ := json.MarshalIndent(errResp, "", "  ")
				fmt.Println(string(jsonStr))
			}
			return
		}

		var responseData ResponseData
		if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
			fmt.Printf("Error decoding response: %v\n", err)
			return
		}

		jsonOutput, _ := cmd.Flags().GetBool("json")
		if jsonOutput {
			// Output raw JSON
			prettyJSON, err := json.MarshalIndent(responseData, "", "  ")
			if err != nil {
				fmt.Printf("Error formatting JSON: %v\n", err)
				return
			}
			fmt.Println(string(prettyJSON))
			return
		}

		// Display AI summary first
		if responseData.Summary != "" {
			fmt.Println("\n=====summarized enhanced query response=====")
			fmt.Println(responseData.Summary)
			fmt.Println("================================\n")
		}

		// Check if we should show full results
		full, _ := cmd.Flags().GetBool("full")
		if full {
			// Show the enhanced query used
			if responseData.EnhancedQuery != "" {
				fmt.Printf("\nOriginal query: \"%s\"\n", query)
				fmt.Printf("Enhanced query: \"%s\"\n", responseData.EnhancedQuery)
			}

			// Display search results
			fmt.Printf("\nFound %d search results\n", len(responseData.Results))
			fmt.Println("===================================")

			for i, result := range responseData.Results {
				fmt.Printf("\nResult %d (Score: %.4f):\n", i+1, result.SimilarityScore)
				fmt.Println("-----------------------------------")
				fmt.Printf("Title: %s\n", result.Metadata.Title)
				fmt.Printf("URL: %s\n", result.Metadata.URL)
				fmt.Printf("Version: %s\n", result.Metadata.Version)
				fmt.Println("\nContent:")
				fmt.Printf("%s\n", result.Document)
			}
		}
	},
}

var rawQueryCmd = &cobra.Command{
	Use:   "raw",
	Short: "Send raw query and get AI-summarized results",
	Long: `Send a raw query to search Vitess docs and get AI-summarized results.
This command skips the query enhancement step but still uses AI to summarize the results.

By default, only the AI summary is shown. Use --full to see search results.`,
	Args: cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		query, _ := cmd.Flags().GetString("query")
		version, _ := cmd.Flags().GetString("version")
		nResults, _ := cmd.Flags().GetInt("nresults")
		includeResources, _ := cmd.Flags().GetBool("include-resources")

		// Only pass non-flag arguments to parsePositionalArgs
		var positionalArgs []string
		for _, arg := range args {
			if !strings.HasPrefix(arg, "-") {
				positionalArgs = append(positionalArgs, arg)
			}
		}

		// Process any positional arguments
		if len(positionalArgs) > 0 {
			parsePositionalArgs(positionalArgs, &version, &nResults, &includeResources)
		}

		apiURL, _ := cmd.Flags().GetString("url")
		url := apiURL + "/rawquery-cli"

		requestBody := RequestBody{
			Query:            query,
			Version:          version,
			NResults:         nResults,
			IncludeResources: includeResources,
		}

		jsonData, err := json.Marshal(requestBody)
		if err != nil {
			fmt.Printf("Error marshaling JSON: %v\n", err)
			return
		}

		resp, err := http.Post(
			url,
			"application/json",
			bytes.NewBuffer(jsonData),
		)
		if err != nil {
			fmt.Printf("Request failed: %v\n", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Error: HTTP Status %d\n", resp.StatusCode)
			var errResp map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
				jsonStr, _ := json.MarshalIndent(errResp, "", "  ")
				fmt.Println(string(jsonStr))
			}
			return
		}

		var responseData ResponseData
		if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
			fmt.Printf("Error decoding response: %v\n", err)
			return
		}

		jsonOutput, _ := cmd.Flags().GetBool("json")
		if jsonOutput {
			// Output raw JSON
			prettyJSON, err := json.MarshalIndent(responseData, "", "  ")
			if err != nil {
				fmt.Printf("Error formatting JSON: %v\n", err)
				return
			}
			fmt.Println(string(prettyJSON))
			return
		}

		// Display AI summary first
		if responseData.Summary != "" {
			fmt.Println("\n=====summarized raw query response=====")
			fmt.Println(responseData.Summary)
			fmt.Println("================================\n")
		}

		// Check if we should show full results
		full, _ := cmd.Flags().GetBool("full")
		if full {
			// Display search results
			fmt.Printf("\nFound %d search results for query: \"%s\"\n", len(responseData.Results), query)
			fmt.Println("===================================")

			for i, result := range responseData.Results {
				fmt.Printf("\nResult %d (Score: %.4f):\n", i+1, result.SimilarityScore)
				fmt.Println("-----------------------------------")
				fmt.Printf("Title: %s\n", result.Metadata.Title)
				fmt.Printf("URL: %s\n", result.Metadata.URL)
				fmt.Printf("Version: %s\n", result.Metadata.Version)
				fmt.Println("\nContent:")
				fmt.Printf("%s\n", result.Document)
			}
		}
	},
}

var testCmd = &cobra.Command{
	Use:   "test",
	Short: "Test the Gemini model directly",
	Long: `Send a prompt directly to the Gemini model for testing.
This command bypasses the RAG system and sends your prompt directly to Gemini.`,
	Run: func(cmd *cobra.Command, args []string) {
		prompt, _ := cmd.Flags().GetString("prompt")
		apiURL, _ := cmd.Flags().GetString("url")
		url := apiURL + "/testgeminiflash"

		requestBody := struct {
			Prompt string `json:"prompt"`
		}{
			Prompt: prompt,
		}

		jsonData, err := json.Marshal(requestBody)
		if err != nil {
			fmt.Printf("Error marshaling JSON: %v\n", err)
			return
		}

		resp, err := http.Post(
			url,
			"application/json",
			bytes.NewBuffer(jsonData),
		)
		if err != nil {
			fmt.Printf("Request failed: %v\n", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			fmt.Printf("Error: HTTP Status %d\n", resp.StatusCode)
			var errResp map[string]interface{}
			if err := json.NewDecoder(resp.Body).Decode(&errResp); err == nil {
				jsonStr, _ := json.MarshalIndent(errResp, "", "  ")
				fmt.Println(string(jsonStr))
			}
			return
		}

		var responseData struct {
			Response string `json:"response"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&responseData); err != nil {
			fmt.Printf("Error decoding response: %v\n", err)
			return
		}

		fmt.Println("\n===== GEMINI MODEL RESPONSE =====")
		fmt.Println(responseData.Response)
		fmt.Println("=================================\n")
	},
}

func printVersionsCommand() {
	fmt.Println("\nAvailable Vitess Documentation Versions:")
	fmt.Println("-------------------------------------")
	fmt.Println("v22.0 (Development)   - Latest development version")
	fmt.Println("v21.0 (Stable)        - Latest stable release")
	fmt.Println("v20.0 (Stable)        - Stable release")
	fmt.Println("v19.0 (Archived)      - Archived version")
	fmt.Println("v18.0 (Archived)      - Archived version")
	fmt.Println("v17.0 (Archived)      - Archived version")
	fmt.Println("v16.0 (Archived)      - Archived version")
	fmt.Println("v15.0 (Archived)      - Archived version")
	fmt.Println("v14.0 (Archived)      - Archived version")
	fmt.Println("v13.0 (Archived)      - Archived version")
	fmt.Println("v12.0 (Archived)      - Archived version")
	fmt.Println("v11.0 (Archived)      - Archived version")
}

var versionsCmd = &cobra.Command{
	Use:   "versions",
	Short: "List available Vitess documentation versions",
	Run: func(cmd *cobra.Command, args []string) {
		printVersionsCommand()
	},
}

func init() {
	// Setup root command flags (for direct query use)
	rootCmd.Flags().StringP("query", "q", "", "Search query")
	rootCmd.Flags().StringP("version", "v", "v22.0 (Development)", "Documentation version")
	rootCmd.Flags().IntP("nresults", "n", 10, "Number of results")
	rootCmd.Flags().Bool("include-resources", true, "Include common resources")
	rootCmd.Flags().StringP("url", "u", "https://vitess-backend-api-fk655.ondigitalocean.app", "FastAPI base URL (without endpoint path)")
	rootCmd.Flags().BoolP("json", "j", false, "Output raw JSON response")
	rootCmd.Flags().BoolP("full", "f", false, "Show full results including search results (by default, only shows AI summary)")

	// Common flags for query commands
	addQueryFlags := func(cmd *cobra.Command) {
		cmd.Flags().StringP("query", "q", "", "Search query")
		cmd.Flags().StringP("version", "v", "v22.0 (Development)", "Documentation version")
		cmd.Flags().IntP("nresults", "n", 10, "Number of results")
		cmd.Flags().Bool("include-resources", true, "Include common resources")
		cmd.Flags().StringP("url", "u", "https://vitess-backend-api-fk655.ondigitalocean.app", "FastAPI base URL (without endpoint path)")
		cmd.Flags().BoolP("json", "j", false, "Output raw JSON response")
		cmd.MarkFlagRequired("query")
	}

	// Setup basic query command
	addQueryFlags(queryCmd)
	rootCmd.AddCommand(queryCmd)

	// Setup enhanced query command
	addQueryFlags(enhancedQueryCmd)
	enhancedQueryCmd.Flags().BoolP("full", "f", false, "Show full results including search results (by default, only shows AI summary)")
	rootCmd.AddCommand(enhancedQueryCmd)

	// Setup raw query command
	addQueryFlags(rawQueryCmd)
	rawQueryCmd.Flags().BoolP("full", "f", false, "Show full results including search results (by default, only shows AI summary)")
	rootCmd.AddCommand(rawQueryCmd)

	// Setup test command
	testCmd.Flags().StringP("prompt", "p", "", "Prompt to send to Gemini model")
	testCmd.Flags().StringP("url", "u", "https://vitess-backend-api-fk655.ondigitalocean.app", "FastAPI base URL (without endpoint path)")
	testCmd.MarkFlagRequired("prompt")
	rootCmd.AddCommand(testCmd)

	// Setup versions command
	rootCmd.AddCommand(versionsCmd)
}

func main() {
	// Custom help template to make the help more readable
	rootCmd.SetHelpTemplate(`
{{.Long}}

VITESS RAG CLI - COMMAND REFERENCE

Main Commands:
  1. Enhanced Query (AI-improved search):
     ./vitess-rag -q "your query"                      AI-enhanced search with summary only
     ./vitess-rag -q "your query" v21.0                Specify just the version (other params default)
     ./vitess-rag -q "your query" v21.0 15             Specify version and result count
     ./vitess-rag -q "your query" v21.0 15 false       Specify all parameters
     ./vitess-rag -q "your query" -f                   Show full results with search results

  2. Raw Query (direct search):
     ./vitess-rag raw -q "your query"                  Raw search with summary only
     ./vitess-rag raw -q "your query" v21.0            Specify just the version (other params default)
     ./vitess-rag raw -q "your query" v21.0 15         Specify version and result count
     ./vitess-rag raw -q "your query" v21.0 15 false   Specify all parameters
     ./vitess-rag raw -q "your query" -f               Show full results with search results

  3. Standard Query (no AI enhancement):
     ./vitess-rag query -q "your query"                Standard vector search
     ./vitess-rag query -q "your query" v21.0          Specify just the version
     ./vitess-rag query -q "your query" v21.0 15       Specify version and result count
     ./vitess-rag query -q "your query" v21.0 15 false Specify all parameters

Default Values:
  - Version: v22.0 (Development)
  - Number of results: 10
  - Include common resources: true

Command Structure:
  The positional arguments MUST come after the -q/--query flag and its value.
  Correct:   ./vitess-rag -q "your query" v21.0 15 false
  Incorrect: ./vitess-rag v21.0 -q "your query" 15 false

  Notes:
  - Short version formats (e.g., "v21.0") are automatically expanded to their full form (e.g., "v21.0 (Stable)")
  - All available versions can be viewed with the "versions" command

Additional Commands:
  enhanced       AI-enhanced search (same as root command with -q flag)
  query          Standard vector search without AI enhancement
  raw            Raw query with AI summary but no query enhancement
  test           Test the Gemini model directly with your own prompt
  versions       List available Vitess documentation versions
  help           Help about any command

Available Flags:
  -q, --query              Search query (required)
  -v, --version            Documentation version (default "v22.0 (Development)")
  -n, --nresults           Number of results (default 10)
      --include-resources  Include common resources (default true)
  -u, --url                FastAPI base URL (default "https://vitess-backend-api-fk655.ondigitalocean.app")
  -j, --json               Output raw JSON response
  -f, --full               Show full results including search results

For detailed information on a specific command, use:
  vitess-rag help [command]
`)

	// Execute the root command
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
