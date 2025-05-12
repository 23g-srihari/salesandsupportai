// src/app/sales-ai/components/SearchBar.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import AnimatedPlaceholder from './AnimatedPlaceholder'; // Assuming this is your custom component
import { SiGoogledrive } from 'react-icons/si';
// FaTrashAlt is no longer used as we switched to an "X" character for delete
import { toast } from 'react-toastify'; // Import toast

export interface UploadedFileForSearch {
    id: string;
    name: string;
    created_at: string;
}

interface SearchBarProps {
  onSearch: (query: string, documentId?: string) => void;
  isLoading: boolean;
  onDriveClick?: () => void;
}

const TRIGGER_PHRASE_FOR_DOC_LIST = "search from document";

export default function SearchBar({ onSearch, isLoading, onDriveClick }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(""); 
  const [showDocSuggestions, setShowDocSuggestions] = useState(false);
  const [documentList, setDocumentList] = useState<UploadedFileForSearch[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ id: string; name: string } | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [actualSearchQuery, setActualSearchQuery] = useState(""); 
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null); // To track doc being deleted

  const inputRef = useRef<HTMLInputElement>(null);

  const fetchDocumentsForSelection = useCallback(async () => {
    if (isLoadingDocs) return;
    setIsLoadingDocs(true);
    try {
      const response = await fetch('/api/sales-ai/list-analyzed-documents'); 
      const data = await response.json();
      if (data.success) {
        setDocumentList(data.documents || []);
      } else {
        // console.error("SearchBar: Failed to fetch documents -", data.error);
        setDocumentList([]);
      }
    } catch (error) {
      // console.error("SearchBar: Error fetching documents -", error);
      setDocumentList([]);
    }
    setIsLoadingDocs(false);
  }, [isLoadingDocs]);

  useEffect(() => {
    const queryLower = inputValue.toLowerCase().trim();
    if (queryLower === TRIGGER_PHRASE_FOR_DOC_LIST.toLowerCase() && !selectedDoc) {
      setShowDocSuggestions(true);
      if (documentList.length === 0 && !isLoadingDocs) {
        fetchDocumentsForSelection();
      }
    } else if (!selectedDoc) { 
        setShowDocSuggestions(false);
    }
    if (!selectedDoc) {
        setActualSearchQuery(inputValue);
    }
  }, [inputValue, selectedDoc, documentList.length, fetchDocumentsForSelection, isLoadingDocs]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentVal = e.target.value;
    setInputValue(currentVal);
    if (selectedDoc) { 
        setActualSearchQuery(currentVal);
    }
  };

  const handleDocumentSelect = (doc: UploadedFileForSearch) => {
    setSelectedDoc({ id: doc.id, name: doc.name });
    setShowDocSuggestions(false);
    setInputValue(""); 
    setActualSearchQuery("");
    inputRef.current?.focus(); 
  };

  const handleClearSelectedDoc = () => {
    setSelectedDoc(null);
    setInputValue(""); 
    setActualSearchQuery("");
    setShowDocSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryToActOn = selectedDoc ? actualSearchQuery.trim() : inputValue.trim();

    if (!queryToActOn && selectedDoc) {
        // console.log("SearchBar: Document selected, but query is empty.");
        return;
    }
    if (inputValue.toLowerCase().trim() === TRIGGER_PHRASE_FOR_DOC_LIST.toLowerCase() && !selectedDoc && !queryToActOn) {
        // console.log("SearchBar: Trigger phrase typed, waiting for document selection or query.");
        if(!isLoadingDocs && documentList.length === 0) fetchDocumentsForSelection();
        setShowDocSuggestions(true);
        return;
    }
    
    if (queryToActOn) {
        if (selectedDoc) {
            onSearch(queryToActOn, selectedDoc.id);
        } else if (queryToActOn.toLowerCase() !== TRIGGER_PHRASE_FOR_DOC_LIST.toLowerCase()){
            onSearch(queryToActOn);
        }
    } else if (!selectedDoc && inputValue.trim() === "") {
        // console.log("SearchBar: Input is empty.");
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (deletingDocId === docId) return; // Already deleting this one

    // Removed window.confirm() to delete immediately on click
    setDeletingDocId(docId);
    try {
      const response = await fetch('/api/sales-ai/delete-document', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ documentId: docId }),
        });
        const data = await response.json();
        if (data.success) {
          toast.success(`Document "${docName}" deleted successfully.`);
          setDocumentList(prev => prev.filter(d => d.id !== docId));
          if (selectedDoc?.id === docId) {
            handleClearSelectedDoc();
          }
        } else {
          // console.error("Error deleting document:", data.error);
          toast.error(`Failed to delete document: ${data.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        // console.error("Exception when deleting document:", err);
        toast.error(`Failed to delete document: ${err.message || 'Network error'}`);
      }
      setDeletingDocId(null);
    // Removed closing brace for window.confirm
  };
  
  // Placeholder logic: Empty by default, specific when a document is selected.
  // The main guidance for document search will now be in AnimatedPlaceholder.
  let placeholder = ""; 
  if (selectedDoc) {
    placeholder = `Search within "${selectedDoc.name.substring(0, 25)}${selectedDoc.name.length > 25 ? '...' : ''}"`;
  } else if (isFocused && !inputValue) {
    // Optional: if you want a very minimal placeholder when focused and empty, 
    // otherwise it can remain empty or rely on AnimatedPlaceholder disappearing on focus.
    // For now, let's keep it empty to give AnimatedPlaceholder full prominence when not focused.
    // placeholder = "Enter your query..."; 
  }

  return (
    // Styling for Google Search Bar look
    <>
      <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto relative group">
        {/* Main search bar container with Google-like styling */}
        <div className={`relative flex items-center bg-white border border-gray-200 rounded-full shadow hover:shadow-md focus-within:shadow-md transition-shadow duration-200 ${selectedDoc ? 'pl-1' : 'pl-4'}`}>
          {selectedDoc && (
            // Styling for selected document pill (light theme)
            <div className="flex items-center pl-2 pr-1 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full whitespace-nowrap mr-2 my-1.5">
              <span title={selectedDoc.name} className="mr-1">
                In: {selectedDoc.name.length > 15 ? selectedDoc.name.substring(0, 12) + '...' : selectedDoc.name}
              </span>
              <button
                type="button"
                onClick={handleClearSelectedDoc}
                className="text-gray-500 hover:text-gray-700 focus:outline-none text-md font-semibold"
                aria-label="Clear document selection"
              >
                &times;
              </button>
            </div>
          )}
          {/* Search Icon - always visible if no doc selected, or if doc selected but input empty */}
          <div className={`absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 ${selectedDoc ? 'hidden' : ''} ${isFocused ? 'text-blue-600' : 'text-gray-500'}`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder} // Will be empty if not selectedDoc and not focused & empty
            className={`w-full h-12 text-base bg-transparent text-gray-800 focus:outline-none transition-all ${selectedDoc ? 'pl-2' : 'pl-10'} pr-24 md:pr-32`} // Adjusted padding
          />
          {/* Animated Placeholder - Text color needs to be dark for light background */}
          {!inputValue && !selectedDoc && !isFocused && (
            <div className={`absolute ${selectedDoc ? 'left-3' : 'left-10'} top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none`}>
              <AnimatedPlaceholder /> {/* Ensure AnimatedPlaceholder uses dark text now */}
            </div>
          )}

          {/* Right side icons container */}
          <div className="absolute right-2 top-0 bottom-0 flex items-center">
              {onDriveClick && !isLoading && (
                <button
                  type="button"
                  className="p-2 text-gray-500 hover:text-blue-600 focus:outline-none disabled:opacity-50 mr-1"
                  title="Attach from Google Drive"
                  onClick={onDriveClick}
                >
                  <SiGoogledrive className="w-6 h-6" />
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading || (!actualSearchQuery.trim() && !selectedDoc && inputValue.toLowerCase().trim() !== TRIGGER_PHRASE_FOR_DOC_LIST.toLowerCase() && inputValue.trim() !== "")}
                className="p-0 text-gray-500 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Search"
              >
                {isLoading ? (
                  <div className="w-10 h-10 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                ) : (
                  // Reverted to a filled circular button with an arrow, styled for light theme
                  <div className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                      </svg>
                  </div>
                  )}
              </button>
          </div>
        </div>
      </form>

      {/* Document Suggestions Dropdown - Light theme */}
      {showDocSuggestions && (
        <div className="w-full max-w-3xl mx-auto relative z-20">
            <ul className="absolute w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto py-1 mt-1">
                {isLoadingDocs && <li className="px-4 py-2 text-gray-500 text-sm">Loading documents...</li>}
                {!isLoadingDocs && documentList.length === 0 &&
                    <li className="px-4 py-2 text-gray-500 text-sm">No analyzable documents found.</li>
                }
                {!isLoadingDocs && documentList.map(doc => (
                    <li
                        key={doc.id}
                        // onClick={() => handleDocumentSelect(doc)} // Click on text selects, click on icon deletes
                        className="flex justify-between items-center px-4 py-2 text-gray-700 text-sm hover:bg-gray-100 group cursor-pointer"
                    >
                        <span onClick={() => handleDocumentSelect(doc)} className="flex-grow truncate" title={doc.name}>
                            {doc.name} <span className="text-xs text-gray-400">({new Date(doc.created_at).toLocaleDateString()})</span>
                        </span>
                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation(); // Prevent li's onClick if it were on the li itself
                                handleDeleteDocument(doc.id, doc.name);
                            }}
                            disabled={deletingDocId === doc.id}
                            className={`p-1 rounded-md ${deletingDocId === doc.id ? 'text-gray-400' : 'text-gray-500 group-hover:text-red-500 hover:bg-red-100'} transition-colors disabled:cursor-not-allowed ml-2`}
                            aria-label="Delete document"
                        >
                            {deletingDocId === doc.id ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <span className="font-semibold text-lg">&times;</span> // Changed to an X character
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
      )}
    </>
  );
}
