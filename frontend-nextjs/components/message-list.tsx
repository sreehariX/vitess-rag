"use client";

import { Message } from '@/lib/chat-store';
import { useEffect, useState, useCallback } from 'react';
import { remark } from 'remark';
import html from 'remark-html';
import { Copy, Check } from 'lucide-react';

interface MessageListProps {
  messages: Message[];
  isGenerating?: boolean;
}

export function MessageList({ messages, isGenerating }: MessageListProps) {
  const [processedMessages, setProcessedMessages] = useState<(Message & { contentHtml?: string })[]>([]);
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [messageKey, setMessageKey] = useState(0);

  // Handle copy button click
  const handleCopy = useCallback((text: string, blockId: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedBlockId(blockId);
      setTimeout(() => {
        setCopiedBlockId(null);
      }, 2000);
    });
  }, []);

  // Force a full refresh when the message array reference changes
  useEffect(() => {
    // Increment the key to force a full re-render
    setMessageKey(prev => prev + 1);
    
    // Reset state when messages change
    setProcessedMessages([]);
    setCopiedBlockId(null);
  }, [messages]);

  useEffect(() => {
    const processMarkdown = async () => {
      // Ensure messages are processed in the correct order
      const processed = await Promise.all(
        messages.map(async (message) => {
          if (message.role === 'user') {
            return { ...message };
          }
          
          // Process markdown for assistant messages
          const processedContent = await remark()
            .use(html)
            .process(message.content);
          
          let contentHtml = processedContent.toString();
          
          // Add target="_blank" to all links
          contentHtml = contentHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
          
          // Enhance citation links with custom styling
          // Look for patterns like [n] or [[n]] that are not already part of a markdown link
          contentHtml = contentHtml.replace(
            /\[(\d+)\](?!\()/g, 
            '<span class="citation">[<a href="#reference-$1" class="citation-link">$1</a>]</span>'
          );
          
          // Also handle [[n]] format for citations
          contentHtml = contentHtml.replace(
            /\[\[(\d+)\]\]/g, 
            '<span class="citation">[<a href="#reference-$1" class="citation-link">$1</a>]</span>'
          );
          
          // Style the reference section 
          contentHtml = contentHtml.replace(
            /<div id="reference-(\d+)" class="reference-item">/g,
            '<div id="reference-$1" class="reference-item reference-section">'
          );
          
          // Add copy button to code blocks
          contentHtml = contentHtml.replace(
            /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
            (match, codeContent) => {
              const blockId = `code-block-${Math.random().toString(36).substr(2, 9)}`;
              return `
                <div class="code-block-wrapper relative group" data-block-id="${blockId}">
                  <pre><code>${codeContent}</code></pre>
                  <button class="code-copy-button">
                    <span class="sr-only">Copy code</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="copy-icon"><rect width="14" height="14" x="8" y="2" rx="2" ry="2"/><path d="M4 18V6a2 2 0 0 1 2-2h2"/></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="check-icon hidden"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                </div>
              `;
            }
          );
          
          // Add CSS for citations and code block copy button
          contentHtml = `
            <style>
              .citation {
                display: inline-block;
                vertical-align: super;
                font-size: 0.75em;
                line-height: 0;
                margin: 0 2px;
              }
              .citation-link {
                color: #58a6ff;
                text-decoration: none;
              }
              .citation-link:hover {
                text-decoration: underline;
              }
              .reference-section a {
                color: #58a6ff;
                text-decoration: none;
              }
              .reference-section a:hover {
                text-decoration: underline;
              }
              .code-block-wrapper {
                position: relative;
                margin-bottom: 1rem;
              }
              .code-copy-button {
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                padding: 0.25rem;
                background-color: rgba(255, 255, 255, 0.1);
                color: rgba(255, 255, 255, 0.8);
                border: none;
                border-radius: 0.25rem;
                cursor: pointer;
                opacity: 0;
                transition: opacity 0.2s, background-color 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 2rem;
                height: 2rem;
              }
              .code-block-wrapper:hover .code-copy-button {
                opacity: 1;
              }
              .code-copy-button:hover {
                background-color: rgba(255, 255, 255, 0.2);
              }
              .code-copy-button svg {
                width: 1rem;
                height: 1rem;
              }
              .code-copy-button.copied {
                background-color: rgba(45, 212, 191, 0.3);
              }
              .code-copy-button.copied .copy-icon {
                display: none;
              }
              .code-copy-button.copied .check-icon {
                display: block;
                color: rgba(45, 212, 191, 1);
              }
              .code-copy-button:not(.copied) .check-icon {
                display: none;
              }
            </style>
          ` + contentHtml;
          
          return {
            ...message,
            contentHtml
          };
        })
      );
      
      // Sort messages by timestamp to ensure correct order
      const sortedMessages = [...processed].sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      setProcessedMessages(sortedMessages);
    };
    
    processMarkdown();
  }, [messages]);

  // Function to handle link clicks
  const handleLinkClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle copy button clicks
    if (target.closest('.code-copy-button')) {
      e.preventDefault();
      e.stopPropagation();
      
      const wrapper = target.closest('.code-block-wrapper');
      if (!wrapper) return;
      
      const blockId = wrapper.getAttribute('data-block-id');
      const codeElement = wrapper.querySelector('code');
      
      if (blockId && codeElement) {
        const button = wrapper.querySelector('.code-copy-button');
        button?.classList.add('copied');
        
        setTimeout(() => {
          button?.classList.remove('copied');
        }, 2000);
        
        handleCopy(codeElement.textContent || '', blockId);
      }
      
      return;
    }
    
    if (target.tagName === 'A') {
      // If it's a citation link, smooth scroll to the reference
      if (target.classList.contains('citation-link')) {
        e.preventDefault();
        const refId = target.getAttribute('href');
        if (refId) {
          const refElement = document.querySelector(refId);
          if (refElement) {
            refElement.scrollIntoView({ behavior: 'smooth' });
          }
        }
        return;
      }
      
      // Otherwise open external links in a new tab
      e.preventDefault();
      const href = (target as HTMLAnchorElement).href;
      window.open(href, '_blank', 'noopener,noreferrer');
    }
  };

  // Add event listeners for copy buttons after component renders
  useEffect(() => {
    const addCopyButtonEventListeners = () => {
      document.querySelectorAll('.code-copy-button').forEach((button) => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const wrapper = (button as Element).closest('.code-block-wrapper');
          if (!wrapper) return;
          
          const blockId = wrapper.getAttribute('data-block-id');
          const codeElement = wrapper.querySelector('code');
          
          if (blockId && codeElement) {
            button.classList.add('copied');
            
            setTimeout(() => {
              button.classList.remove('copied');
            }, 2000);
            
            handleCopy(codeElement.textContent || '', blockId);
          }
        });
      });
    };
    
    // Add event listeners after a short delay to ensure DOM is ready
    setTimeout(addCopyButtonEventListeners, 100);
    
    // Cleanup function
    return () => {
      document.querySelectorAll('.code-copy-button').forEach((button) => {
        button.removeEventListener('click', () => {});
      });
    };
  }, [processedMessages, handleCopy]);

  return (
    <div className="w-full px-2 sm:px-4 md:max-w-3xl md:mx-auto" onClick={handleLinkClick} key={messageKey}>
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center">
        <h1 className="text-xl md:text-2xl font-bold px-2" style={{ color: 'hsl(var(--color-silver))' }}>
          Search Vitess Documentation with semantic search
        </h1>
        <p className="text-sm md:text-base mt-1" style={{ color: 'hsl(var(--color-silver))' }}>
          across all versions with intelligent RAG retrieval
        </p>
      </div>
      ) : (
        <>
          {processedMessages.map((message) => (
            <div
              key={`${message.id}-${messageKey}`}
              className={`mb-4 md:mb-6 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
            >
              <div 
                className={`inline-block px-3 py-2 md:px-4 md:py-2 max-w-[95%] md:max-w-[90%] ${
                  message.role === 'user' 
                    ? 'rounded-2xl rounded-br-sm bg-[var(--gradient-bg)]' 
                    : 'rounded-2xl rounded-bl-sm'
                }`}
                style={{
                  color: 'white'
                }}
              >
                {message.role === 'user' ? (
                  <div className="text-sm md:text-base">{message.content}</div>
                ) : (
                  <div 
                    className="prose prose-invert prose-headings:text-white prose-p:text-white prose-li:text-white prose-strong:text-white max-w-none text-sm md:text-base"
                    dangerouslySetInnerHTML={{ __html: message.contentHtml || '' }}
                  />
                )}
              </div>
            </div>
          ))}
          {isGenerating && (
            <div className="flex items-center text-xs text-gray-400 animate-pulse px-2">
              Searching documentation...
            </div>
          )}
        </>
      )}
    </div>
  );
}