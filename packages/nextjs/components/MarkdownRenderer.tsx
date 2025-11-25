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
        prose prose-base sm:prose-lg lg:prose-xl max-w-none
        prose-slate dark:prose-invert
        prose-headings:font-serif prose-headings:tracking-tight
        prose-headings:mb-4 prose-headings:mt-8
        prose-p:leading-loose
        prose-body:text-base-content/90
        prose-strong:text-base-content prose-strong:font-semibold
        prose-a:text-primary prose-a:underline prose-a:decoration-1 prose-a:underline-offset-2 hover:prose-a:decoration-2
        prose-code:text-accent prose-code:bg-base-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
        prose-pre:bg-base-300 prose-pre:border prose-pre:border-base-content/5
        ${className}
      `}
    >
      {content}
    </ReactMarkdown>
  );
};
