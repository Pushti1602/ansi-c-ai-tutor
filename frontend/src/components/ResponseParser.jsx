import React, { useState } from 'react';

/**
 * Parses raw tutor response text into Definition, Explanation, Syntax, and Program.
 * Clean up literal \n text sequences and escaped quotes, and separate text into sections.
 */
export function parseTutorResponse(rawText) {
  if (!rawText) return {};

  // Clean up any literal "\n" strings (backslash + n) and convert to actual newlines
  let text = rawText.replace(/\\n/g, '\n');
  
  // Clean up escaped quotes \" or \' if any
  text = text.replace(/\\"/g, '"').replace(/\\'/g, "'");

  const sections = {
    definition: '',
    explanation: '',
    syntax: '',
    program: ''
  };

  // Match section headers case-insensitively, allowing optional colon and trailing spaces
  const definitionMatch = text.match(/^(?:Definition|DEFINITION)[:\s]*/m);
  const explanationMatch = text.match(/^(?:Explanation|EXPLANATION)[:\s]*/m);
  const syntaxMatch = text.match(/^(?:Syntax|SYNTAX)[:\s]*/m);
  const programMatch = text.match(/^(?:Program|PROGRAM)[:\s]*/m);

  const markers = [];
  if (definitionMatch) markers.push({ type: 'definition', index: definitionMatch.index, length: definitionMatch[0].length });
  if (explanationMatch) markers.push({ type: 'explanation', index: explanationMatch.index, length: explanationMatch[0].length });
  if (syntaxMatch) markers.push({ type: 'syntax', index: syntaxMatch.index, length: syntaxMatch[0].length });
  if (programMatch) markers.push({ type: 'program', index: programMatch.index, length: programMatch[0].length });

  // Sort markers chronologically by appearance in text
  markers.sort((a, b) => a.index - b.index);

  if (markers.length === 0) {
    // If no section headers matched, treat the whole text as explanation
    sections.explanation = text;
    return sections;
  }

  // Handle any text before the first section marker as part of definition
  if (markers[0].index > 0) {
    const preamble = text.slice(0, markers[0].index).trim();
    if (preamble) {
      sections.definition = preamble;
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const startIdx = current.index + current.length;
    const endIdx = next ? next.index : text.length;
    
    let content = text.slice(startIdx, endIdx).trim();
    
    // Strip markdown code block markers from the Program section
    if (current.type === 'program') {
      content = content.replace(/^```c\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    }
    
    sections[current.type] = content;
  }

  return sections;
}

/**
 * Parses inline Markdown-like markers (**bold**, *italic*, `code`) and replaces them with HTML elements.
 */
export function renderTextWithInlineFormatting(text) {
  if (!text) return null;

  // Split by bold (**), italic (*), and inline code (`)
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\n)/);
  
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code className="inline-code" key={index}>{part.slice(1, -1)}</code>;
    }
    if (part === '\n') {
      return <br key={index} />;
    }
    return part;
  });
}

/**
 * Splitting text by double newlines to render formatted paragraphs and bullet lists.
 */
export function renderParagraphs(text) {
  if (!text) return null;
  const paras = text.split(/\n\n+/);
  return paras.map((para, i) => {
    const trimmed = para.trim();
    // Render simple unordered lists if paragraph represents a list block
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items = trimmed.split(/\n[*-]\s+/);
      return (
        <ul className="parsed-bullet-list" key={i}>
          {items.map((item, j) => {
            const cleanedItem = j === 0 ? item.replace(/^[*-]\s+/, '') : item;
            return (
              <li className="parsed-bullet-item" key={j}>
                {renderTextWithInlineFormatting(cleanedItem)}
              </li>
            );
          })}
        </ul>
      );
    }
    return (
      <p className="parsed-paragraph" key={i}>
        {renderTextWithInlineFormatting(para)}
      </p>
    );
  });
}

/**
 * C Syntax Highlighter - lightweight regex replacement for presentation
 */
export function highlightCCode(code) {
  if (!code) return '';

  // Escape HTML entities first to prevent rendering bugs
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Store comments and strings out of highlighters to avoid double-highlighting
  const comments = [];
  html = html.replace(/(\/\*[\s\S]*?\*\/|\/\/.*)/g, (match) => {
    comments.push(match);
    return `___COMMENT_${comments.length - 1}___`;
  });

  const strings = [];
  html = html.replace(/("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/g, (match) => {
    strings.push(match);
    return `___STRING_${strings.length - 1}___`;
  });

  // Highlight preprocessors and brackets
  html = html.replace(/^(#\s*(?:include|define|undef|ifdef|ifndef|if|else|elif|endif|pragma|error))\b/gm, '<span class="c-preprocessor">$1</span>');
  html = html.replace(/(&lt;[a-zA-Z0-9_\.\/]+&gt;)/g, '<span class="c-string">$1</span>');

  // Highlight C keywords
  const keywords = /\b(return|if|else|for|while|do|switch|case|default|break|continue|struct|union|typedef|sizeof|static|extern|const|volatile|enum|goto)\b/g;
  html = html.replace(keywords, '<span class="c-keyword">$1</span>');

  // Highlight types
  const types = /\b(int|char|float|double|void|short|long|signed|unsigned|FILE|size_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t)\b/g;
  html = html.replace(types, '<span class="c-type">$1</span>');

  // Highlight numbers
  html = html.replace(/\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="c-number">$1</span>');

  // Restore strings and comments back to HTML
  html = html.replace(/___STRING_(\d+)___/g, (match, index) => {
    return `<span class="c-string">${strings[parseInt(index)]}</span>`;
  });

  html = html.replace(/___COMMENT_(\d+)___/g, (match, index) => {
    return `<span class="c-comment">${comments[parseInt(index)]}</span>`;
  });

  return html;
}

export default function ResponseParser({ answer }) {
  const sections = parseTutorResponse(answer);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async (codeText) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div className="parsed-response">
      {/* Definition Section */}
      {sections.definition && (
        <div className="parsed-section">
          <div className="parsed-heading definition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
            Definition
          </div>
          <div className="parsed-content">
            {renderParagraphs(sections.definition)}
          </div>
        </div>
      )}

      {/* Explanation Section */}
      {sections.explanation && (
        <div className="parsed-section">
          <div className="parsed-heading explanation">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Explanation
          </div>
          <div className="parsed-content">
            {renderParagraphs(sections.explanation)}
          </div>
        </div>
      )}

      {/* Syntax Section */}
      {sections.syntax && (
        <div className="parsed-section">
          <div className="parsed-heading syntax">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Syntax
          </div>
          <div className="parsed-content">
            <pre className="syntax-box">
              <code>{sections.syntax}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Program / Code Block Section */}
      {sections.program && (
        <div className="parsed-section">
          <div className="parsed-heading program">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M9 17V7l7 5z"/></svg>
            Program
          </div>
          <div className="code-container">
            <div className="code-header">
              <span className="code-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="8 17 12 12 8 7"/><line x1="12" x2="20" y1="17" y2="17"/></svg>
                ANSI C
              </span>
              <button 
                className="code-copy-btn" 
                onClick={() => handleCopyCode(sections.program)}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <pre className="code-body">
              <code dangerouslySetInnerHTML={{ __html: highlightCCode(sections.program) }} />
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
