package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

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
	FilterUsed map[string]interface{} `json:"filter_used,omitempty"`
}

var rootCmd = &cobra.Command{
	Use:   "vitess-rag",
	Short: "CLI for Vitess RAG API interaction",
	Long:  `A command-line interface for interacting with the Vitess RAG FastAPI endpoint.`,
}

var queryCmd = &cobra.Command{
	Use:   "query",
	Short: "Send query to FastAPI endpoint",
	Run: func(cmd *cobra.Command, args []string) {
		query, _ := cmd.Flags().GetString("query")
		version, _ := cmd.Flags().GetString("version")
		nResults, _ := cmd.Flags().GetInt("nresults")
		url, _ := cmd.Flags().GetString("url")

		requestBody := RequestBody{
			Query:            query,
			Version:          version,
			NResults:         nResults,
			IncludeResources: true,
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

func init() {
	queryCmd.Flags().StringP("query", "q", "", "Search query")
	queryCmd.Flags().StringP("version", "v", "v22.0 (Development)", "Documentation version")
	queryCmd.Flags().IntP("nresults", "n", 2, "Number of results")
	queryCmd.Flags().StringP("url", "u", "http://localhost:8000/query", "FastAPI endpoint URL")
	queryCmd.Flags().BoolP("json", "j", false, "Output raw JSON response")

	queryCmd.MarkFlagRequired("query")

	rootCmd.AddCommand(queryCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
