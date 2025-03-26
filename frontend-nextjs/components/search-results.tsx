import React from 'react';
import { SearchResult } from '@/lib/api-service';
import ReactMarkdown from 'react-markdown';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {results.map((result, index) => (
        <div 
          key={index} 
          className="border border-gray-700 rounded-xl p-4 transition-all duration-200 hover:border-gray-500"
        >
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">
                {result.metadata.title}
              </h3>
              <span className="text-sm px-2 py-1 bg-blue-900/50 rounded-full text-blue-300">
                {(result.similarity_score * 100).toFixed(1)}% match
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 text-sm mb-3">
              <a 
                href={result.metadata.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline hover:text-blue-300 transition-colors"
              >
                <span className="inline-flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View Documentation
                </span>
              </a>
            </div>
            
            <div className="inline-flex items-center text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-md">
              <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Version: {result.metadata.version_or_commonresource}</span>
            </div>
          </div>
          
          <div className="prose prose-sm prose-invert max-w-none border-t border-gray-700 pt-3 mt-2">
            <ReactMarkdown>
              {result.document}
            </ReactMarkdown>
          </div>
        </div>
      ))}
    </div>
  );
} 