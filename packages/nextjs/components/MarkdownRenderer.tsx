"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer Component
 *
 * A reusable component for rendering markdown content with GitHub Flavored Markdown support
 * and HTML anchor preservation for Table of Contents navigation.
 *
 * Features:
 * - GitHub Flavored Markdown (tables, strikethrough, task lists, autolinks)
 * - Preserves raw HTML elements (especially <a id="section-X"> anchors)
 * - XSS protection via rehype-sanitize with safe schema
 * - Theme-aware styling using Tailwind prose classes
 * - DaisyUI color integration
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  // Handle empty or null content gracefully
  if (!content) {
    return null;
  }

  // Create a custom sanitize schema that allows safe HTML elements
  // while permitting anchor tags with id attributes for TOC navigation
  const customSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      // Allow id attribute on anchor tags for section navigation
      a: [...(defaultSchema.attributes?.a || []), "id", "href", "name"],
      // Allow id on heading elements for anchor targets
      h1: [...(defaultSchema.attributes?.h1 || []), "id"],
      h2: [...(defaultSchema.attributes?.h2 || []), "id"],
      h3: [...(defaultSchema.attributes?.h3 || []), "id"],
      h4: [...(defaultSchema.attributes?.h4 || []), "id"],
      h5: [...(defaultSchema.attributes?.h5 || []), "id"],
      h6: [...(defaultSchema.attributes?.h6 || []), "id"],
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, customSchema]]}
      className={`
        prose prose-lg max-w-none
        prose-slate dark:prose-invert
        prose-headings:mb-4 prose-headings:mt-6
        prose-p:leading-relaxed
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-code:text-accent prose-code:bg-base-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-base-300 prose-pre:border prose-pre:border-base-content/10
        ${className}
      `}
    >
      {content}
    </ReactMarkdown>
  );
};
