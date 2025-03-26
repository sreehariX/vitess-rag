"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/sidebar';
import { MessageList } from '@/components/message-list';
import { SummaryResults } from '@/components/summary-results';
import { PanelLeftOpen, PanelLeftClose, MessageSquarePlus, Search, Menu, X } from 'lucide-react';
import { Chat, Message, generateSyntheticResponse, generateChatTitle } from '@/lib/chat-store';
import { SearchResult } from '@/lib/api-service';
import { useSearchStore } from '@/lib/store';

import { chatStorageService } from '@/lib/chat-storage-service';
import { SupportButton, SocialButtons } from '@/components/support-button';

export default function Home() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [input, setInput] = useState('');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isFirstMessage, setIsFirstMessage] = useState(true);
  const messagesStartRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Add a ref to track current request
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Check if the screen is mobile size
  const [isMobile, setIsMobile] = useState(false);

  // Available versions
  const availableVersions = [
    "v22.0 (Development)",
    "v21.0 (Stable)",
    "v20.0 (Stable)",
    "v19.0 (Archived)",
    "v18.0 (Archived)",
    "v17.0 (Archived)",
    "v16.0 (Archived)",
    "v15.0 (Archived)",
    "v14.0 (Archived)",
    "v13.0 (Archived)",
    "v12.0 (Archived)",
    "v11.0 (Archived)"
  ];

  // Effect to handle responsive behavior
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    };

    // Initial check
    checkIfMobile();

    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Add event listener for custom sidebar close event
    const handleCloseSidebar = () => {
      setIsMobileSidebarOpen(false);
    };
    
    window.addEventListener('closeMobileSidebar', handleCloseSidebar);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkIfMobile);
      window.removeEventListener('closeMobileSidebar', handleCloseSidebar);
    };
  }, []);

  const { 
    query, 
    results, 
    summary, 
    isLoading, 
    isSummarizing, 
    setQuery, 
    search, 
    clearResults,
    queryType,
    setQueryType,
    version,
    setVersion,
    n_results,
    setNResults,
    enhancedQuery
  } = useSearchStore();

  // Initialize IndexedDB when the component mounts
  useEffect(() => {
    const initializeDB = async () => {
      try {
        console.log('Initializing IndexedDB...');
        await chatStorageService.initializeDB();
        console.log('IndexedDB initialized successfully');
        
        // Clean up chats older than 30 days
        try {
          await chatStorageService.cleanupOldChats();
          console.log('Old chats cleanup completed');
        } catch (cleanupError) {
          console.error('Error cleaning up old chats:', cleanupError);
        }
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
      }
    };
    
    initializeDB();
  }, []);

  // Load chats from storage on component mount
  useEffect(() => {
    const loadChats = async () => {
      try {
        console.log('Loading chats from storage...');
        const storedChats = await chatStorageService.getAllChats();
        
        if (storedChats && storedChats.length > 0) {
          console.log(`Loaded ${storedChats.length} chats from storage`);
          
          // Initialize each chat with an empty results array
          const chatsWithEmptyResults = storedChats.map(chat => ({
            ...chat,
            results: [] // Initialize with empty results array
          }));
          
          setChats(chatsWithEmptyResults);
          
          // Set the most recent chat as active
          const sortedChats = [...chatsWithEmptyResults].sort((a, b) => {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
          
          if (sortedChats.length > 0) {
            console.log(`Setting most recent chat as active: ${sortedChats[0].id}`);
            setActiveChat(sortedChats[0].id);
          }
        } else {
          console.log('No chats found in storage');
        }
      } catch (error) {
        console.error('Error loading chats from storage:', error);
      }
    };
    
    loadChats();
  }, []);

  // Save chat to storage when chats change
  useEffect(() => {
    const saveChats = async () => {
      if (chats.length > 0) {
        for (const chat of chats) {
          try {
            // Skip saving if the chat doesn't have an ID or is incomplete
            if (!chat.id || !chat.messages || chat.messages.length === 0) {
              console.warn('Skipping save for incomplete chat:', chat);
              continue;
            }
            
           
          } catch (error) {
            console.error('Error saving chat:', error);
          }
        }
      }
    };
    
    saveChats();
  }, [chats]);

  // Scroll to top of messages when active chat changes
  useEffect(() => {
    if (messagesStartRef.current) {
      messagesStartRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChat]);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Check if API key is configured
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY) {
      console.warn('Google Generative AI API key is not configured. Summary feature will not work.');
    } else {
      console.log('Google Generative AI API key is configured.');
    }
  }, []);

  // Add a loading state for response generation
  const [isGenerating, setIsGenerating] = useState(false);
  // Add a lock to prevent multiple simultaneous requests
  const [isRequestLocked, setIsRequestLocked] = useState(false);

  const currentChat = chats.find(chat => chat.id === activeChat);

  // Add a function to explicitly save the current chat
  const saveCurrentChat = async (chatId: string) => {
    if (!chatId) return;
    
    const chatToSave = chats.find(chat => chat.id === chatId);
    if (chatToSave) {
      try {
        // Create a copy of the chat to avoid reference issues
        const chatCopy = {
          ...chatToSave,
          messages: [...chatToSave.messages]
        };
        
        await chatStorageService.saveChat(chatCopy);
        console.log(`Explicitly saved chat: ${chatId} with ${chatCopy.messages.length} messages`);
      } catch (error) {
        console.error(`Error explicitly saving chat ${chatId}:`, error);
      }
    }
  };

  // Add a function to thoroughly clean up between chat switches
  const forceCleanupCurrentChat = () => {
    console.log('Performing thorough cleanup between chats');
    
    // Reset all search-related state
    clearResults();
    useSearchStore.getState().clearResults();
    
    // Reset UI states
    setIsGenerating(false);
    setIsRequestLocked(false);
    
    // Abort any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Clear input field
    setInput('');
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
        // Lock request to prevent multiple submissions
        if (isRequestLocked) return;
        setIsRequestLocked(true);
        
        // Create a new abort controller for this request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        // Reset any existing state first to prevent stale data
        clearResults();
        useSearchStore.getState().clearResults();
        setIsGenerating(true);
        
        // Create user message
        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input,
            timestamp: new Date()
        };

        // Find current chat or create new one
        let currentChat = activeChat ? chats.find(chat => chat.id === activeChat) : null;
        
        if (!currentChat) {
            currentChat = {
                id: crypto.randomUUID(),
                title: input.substring(0, 50) + "...",
                createdAt: new Date(),
                messages: [],
                results: []
            };
            console.log('Created new chat:', currentChat.id);
        }

        // Store the input and clear it immediately for better UX
        const queryInput = input;
        setInput('');

        // Create a fresh copy of messages to avoid state issues
        const updatedMessages = [...currentChat.messages, userMessage];
        const updatedChat = {
            ...currentChat,
            messages: updatedMessages,
            results: [], // Reset results to prevent old data appearing
            summary: '', // Reset summary
            enhancedQuery: '' // Reset enhanced query
        };

        // Update chats state with user message - ensure we're creating new references
        const updatedChats = activeChat
            ? chats.map(chat => chat.id === activeChat ? updatedChat : {...chat})
            : [updatedChat, ...chats];

        setChats(updatedChats);
        setActiveChat(updatedChat.id);

        // Explicitly save the chat with just the user message
        await chatStorageService.saveChat({...updatedChat});

        // Trigger search and wait for results - use a timeout to ensure UI updates first
        setTimeout(async () => {
            try {
                setQuery(queryInput);
                await search();
                
                // Get the LATEST results after search is complete
                const currentResults = useSearchStore.getState().results;
                const currentSummary = useSearchStore.getState().summary;
        
                // Create assistant message with the actual results
                const assistantMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: currentSummary || (currentResults.length > 0 ? generateFallbackFromResults(currentResults) : 'No results found.'),
                    timestamp: new Date()
                };
        
                // Update messages with assistant response - create fresh copies to avoid state issues
                const finalMessages = [...updatedMessages, assistantMessage];
                
                const finalChat = {
                    ...updatedChat,
                    messages: finalMessages,
                    results: [...currentResults] // Create a fresh copy
                };
        
                // Update chats state with assistant message
                setChats(prev => {
                    const finalChats = prev.map(chat => 
                        chat.id === updatedChat.id ? finalChat : chat
                    );
                    return finalChats;
                });
                
                // Save chat with complete messages
                console.log('Saving chat with all messages:', {
                    chatId: finalChat.id,
                    messageCount: finalChat.messages.length,
                    lastMessage: finalChat.messages[finalChat.messages.length - 1].content.substring(0, 50) + '...'
                });
        
                await chatStorageService.saveChat({...finalChat});
                
                // End loading states
                setIsGenerating(false);
                setIsRequestLocked(false);

                if (isFirstMessage) {
                    setIsFirstMessage(false);
                }
            } catch (searchError) {
                console.error('Error during search:', searchError);
                
                // If search fails, add an error message
                const errorMessage: Message = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: 'Sorry, there was an error processing your query. Please try again.',
                    timestamp: new Date()
                };
                
                const finalErrorMessages = [...updatedMessages, errorMessage];
                
                const errorChat = {
                    ...updatedChat,
                    messages: finalErrorMessages
                };
                
                // Update chats state with error message
                setChats(prev => {
                    const errorChats = prev.map(chat => 
                        chat.id === updatedChat.id ? errorChat : chat
                    );
                    return errorChats;
                });
                
                await chatStorageService.saveChat({...errorChat});
                
                // End loading states
                setIsGenerating(false);
                setIsRequestLocked(false);
            }
        }, 0);
    } catch (error) {
        console.error('Error in handleSend:', error);
        setIsGenerating(false);
        setIsRequestLocked(false);
    }
};

  // Helper function to generate a fallback response directly from results
  function generateFallbackFromResults(results: SearchResult[]): string {
    if (!results || results.length === 0) {
      return 'Sorry, no documentation matches your query. Please try with different keywords.';
    }
    
    let fallback = `# Vitess Documentation Search Results\n\n`;
    
    // Add notification about results
    fallback += `> Found ${results.length} matching documents in the Vitess documentation.\n\n`;
    
    // Create a references section for all URLs
    let references = `## References\n\n`;
    
    results.forEach((result, index) => {
      const score = (result.similarity_score * 100).toFixed(1);
      fallback += `## ${index + 1}. ${result.metadata.title} (${score}% match) [[${index + 1}]](#reference-${index + 1})\n\n`;
      
      fallback += `- **Version**: ${result.metadata.version_or_commonresource}\n`;
      fallback += `- **Source**: [View Documentation [${index + 1}]](${result.metadata.url})\n\n`;
      
      // Add document content directly
      fallback += `### Content\n\n`;
      fallback += `${result.document}\n\n`;
      
      fallback += `---\n\n`;
      
      // Add to references section
      references += `<div id="reference-${index + 1}" class="reference-item">\n`;
      references += `[${index + 1}] <a href="${result.metadata.url}" target="_blank" rel="noopener noreferrer">${result.metadata.url}</a>\n`;
      references += `</div>\n\n`;
    });
    
    // Append references section at the end
    fallback += `\n${references}`;
    
    return fallback;
  }

  // Use the cleanup in both handleNewChat and handleSelectChat
  const handleNewChat = () => {
    // Prevent creating new chat during an active request
    if (isRequestLocked) return;
    
    // Perform thorough cleanup
    forceCleanupCurrentChat();
    
    setActiveChat(null);
    setIsFirstMessage(true);
  };

  const handleSelectChat = async (id: string) => {
    try {
        console.log(`Selecting chat: ${id}`);
        
        // Perform thorough cleanup first
        forceCleanupCurrentChat();
        
        // Load the chat from storage
        const loadedChat = await chatStorageService.getChat(id);
        
        if (loadedChat) {
            console.log(`Loaded chat ${id} with ${loadedChat.messages.length} messages`);
            
            // Ensure the zustand store is completely reset
            useSearchStore.getState().clearResults();
            
            // Important: create deep copies of the chat data to avoid reference issues
            const cleanLoadedChat = JSON.parse(JSON.stringify(loadedChat));
            cleanLoadedChat.results = cleanLoadedChat.results || [];
            
            // Update the chat in the chats array, ensuring we're not sharing references
            setChats(prev => {
                // Create a fresh copy of the entire chats array
                const updatedChats = prev.map(chat => 
                    chat.id === id ? cleanLoadedChat : {...chat, messages: [...chat.messages]}
                );
                return updatedChats;
            });
            
            // Set as active chat - do this AFTER state is fully reset
            setTimeout(() => {
                setActiveChat(id);
            }, 0);
            
            // Clear input
            setInput('');
        } else {
            console.error(`Could not load chat ${id}`);
        }
    } catch (error) {
        console.error(`Error selecting chat ${id}:`, error);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    // Prevent deleting chat during an active request
    if (isRequestLocked) return;
    
    try {
      await chatStorageService.deleteChat(chatId);
      setChats(prev => prev.filter(chat => chat.id !== chatId));
      if (activeChat === chatId) {
        setActiveChat(null);
        setIsFirstMessage(true);
        
        // Clear the search results with a small delay to prevent UI flicker
        setTimeout(() => {
          clearResults();
        }, 50);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
    }
  };

  useEffect(() => {
    return () => {
      clearResults();
    };
  }, []);

  // Save active chat to storage when it changes
  useEffect(() => {
    if (!activeChat) return;
    
    // Find the current active chat
    const currentChat = chats.find(chat => chat.id === activeChat);
    if (!currentChat) {
      console.log(`Active chat ${activeChat} not found in chats array`);
      return;
    }
    
    console.log(`Active chat changed: ${activeChat}, messages: ${currentChat.messages.length}`);
    
    
  }, [activeChat, chats]);

  return (
    <div className="flex h-screen relative" style={{ backgroundColor: 'var(--background)' }}>
      {/* Mobile sidebar overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - desktop version uses isSidebarOpen, mobile version uses isMobileSidebarOpen */}
      <div className={`${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:relative z-30 transition-transform duration-300 ease-in-out h-full`}>
        <Sidebar 
          isOpen={isMobile ? true : isSidebarOpen}
          chats={chats}
          activeChat={activeChat}
          onNewChat={handleNewChat}
          onSelectChat={(id) => {
            handleSelectChat(id);
            if (isMobile) setIsMobileSidebarOpen(false);
          }}
          onDeleteChat={handleDeleteChat}
        />
      </div>
      
      <div className={`flex-1 flex flex-col w-full ${!isSidebarOpen ? 'md:max-w-5xl md:mx-auto' : ''}`}>
        <div className="h-14 flex items-center px-4 justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="text-white hover:bg-[var(--button-ghost-hover)] rounded-full md:hidden"
            >
              <Menu />
            </Button>
            
            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="text-white hover:bg-[var(--button-ghost-hover)] rounded-full hidden md:flex"
            >
              {isSidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            
            {!isSidebarOpen && !isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                className="text-white hover:bg-[var(--button-ghost-hover)] rounded-full hidden md:flex"
              >
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            )}
          </div>
          
          {currentChat && (
            <h2 className="ml-4 font-semibold truncate text-white flex-1 text-center md:text-left">
              {currentChat.title}
            </h2>
          )}
          
          <div className="flex items-center gap-2">
            {/* Social media buttons - desktop only */}
            <div className="hidden md:flex">
              <SocialButtons />
            </div>
            
            {/* Support button */}
            <SupportButton />
            
            {/* Mobile new chat button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewChat}
              className="text-white hover:bg-[var(--button-ghost-hover)] rounded-full md:hidden"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto" 
          style={{ backgroundColor: 'var(--background)' }}
        >
          <div ref={messagesStartRef} className="pt-4" />
          <MessageList 
            messages={currentChat?.messages || []} 
            isGenerating={isGenerating}
          />
          
          {/* Only show SummaryResults when actively generating a response */}
          {activeChat && isGenerating && (
            <div className="max-w-3xl mx-auto px-4 pb-6">
              <SummaryResults 
                currentChat={currentChat}
              />
            </div>
          )}
        </div>

        <div className={`p-3 md:p-6 ${isFirstMessage ? 'flex items-center justify-center h-32' : ''}`}>
          <div className="max-w-3xl w-full mx-auto relative">
            {enhancedQuery && (
              <div className="text-xs text-gray-300 mb-2 ml-2">
                <span className="font-semibold">Enhanced query:</span> {enhancedQuery}
              </div>
            )}
            <div className="relative rounded-2xl bg-[rgba(50,50,50,0.6)] border border-[rgba(255,255,255,0.1)] focus-within:border-[rgba(255,255,255,0.3)] focus-within:shadow-glow transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search Vitess documentation..."
                className="w-full py-4 px-5 text-white bg-transparent rounded-2xl resize-none"
                style={{
                  minHeight: isMobile ? '80px' : '70px',
                  maxHeight: '150px',
                  outline: 'none',
                  lineHeight: '1.5',
                  paddingBottom: isMobile ? '40px' : '50px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              
              {/* Mobile controls */}
              <div className="md:hidden absolute bottom-3 left-3 right-14 flex flex-row items-center space-x-2">
                <div className="flex items-center">
                  <label htmlFor="queryType-mobile" className="text-[10px] font-medium text-gray-300 mr-1 mobile-label">Type:</label>
                  <select 
                    id="queryType-mobile"
                    value={queryType}
                    onChange={(e) => setQueryType(e.target.value as 'enhanced' | 'raw')}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-[10px] rounded-md px-1 py-1 border border-[rgba(255,255,255,0.1)] w-[80px] mobile-select"
                  >
                    <option value="enhanced">Enhanced</option>
                    <option value="raw">Raw</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <label htmlFor="version-mobile" className="text-[10px] font-medium text-gray-300 mr-1 mobile-label">Ver:</label>
                  <select 
                    id="version-mobile"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-[10px] rounded-md px-1 py-1 border border-[rgba(255,255,255,0.1)] w-[80px] mobile-select"
                  >
                    {availableVersions.map((ver) => (
                      <option key={ver} value={ver}>{ver}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center">
                  <label htmlFor="n_results-mobile" className="text-[10px] font-medium text-gray-300 mr-1 mobile-label">Results:</label>
                  <select 
                    id="n_results-mobile"
                    value={n_results}
                    onChange={(e) => setNResults(Number(e.target.value))}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-[10px] rounded-md px-1 py-1 border border-[rgba(255,255,255,0.1)] w-[50px] mobile-select"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                  </select>
                </div>
              </div>
              
              {/* Desktop controls */}
              <div className="absolute bottom-3 left-5 hidden md:flex md:flex-row md:items-center md:space-x-4">
                <div className="flex items-center space-x-2">
                  <label htmlFor="queryType" className="text-sm font-medium text-gray-300">Query Type:</label>
                  <select 
                    id="queryType"
                    value={queryType}
                    onChange={(e) => setQueryType(e.target.value as 'enhanced' | 'raw')}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-sm rounded-md px-3 py-1.5 border border-[rgba(255,255,255,0.1)]"
                  >
                    <option value="enhanced">Enhanced Query</option>
                    <option value="raw">Raw Query</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="version" className="text-sm font-medium text-gray-300">Version:</label>
                  <select 
                    id="version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-sm rounded-md px-3 py-1.5 border border-[rgba(255,255,255,0.1)]"
                  >
                    {availableVersions.map((ver) => (
                      <option key={ver} value={ver}>{ver}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label htmlFor="n_results" className="text-sm font-medium text-gray-300">Results:</label>
                  <select 
                    id="n_results"
                    value={n_results}
                    onChange={(e) => setNResults(Number(e.target.value))}
                    className="bg-[rgba(60,60,60,0.6)] text-white text-sm rounded-md px-3 py-1.5 border border-[rgba(255,255,255,0.1)]"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="15">15</option>
                    <option value="20">20</option>
                  </select>
                </div>
              </div>
              
              <Button
                className="absolute right-3 md:right-4 bottom-3 h-10 w-10 md:h-11 md:w-11 p-0 rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.25)] transition-colors shadow-glow"
                onClick={handleSend}
                disabled={!input.trim()}
              >
                <Search className="h-5 w-5 text-white" />
              </Button>
            </div>
            <div className="text-xs text-gray-400 mt-2 ml-2">
              Press Enter to search, Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}