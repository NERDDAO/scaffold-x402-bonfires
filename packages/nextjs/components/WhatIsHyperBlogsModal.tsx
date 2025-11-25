import React, { useEffect } from "react";

interface WhatIsHyperBlogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatIsHyperBlogsModal = ({ isOpen, onClose }: WhatIsHyperBlogsModalProps) => {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (isOpen && e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open backdrop-blur-sm" onClick={onClose}>
      <div
        className="modal-box bg-base-100 max-w-2xl relative p-8 sm:p-10 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4" onClick={onClose}>
          ✕
        </button>

        <h2 className="text-3xl font-bold mb-6 font-serif text-base-content">What Are HyperBlogs?</h2>

        <div className="space-y-5 text-base-content/80 leading-relaxed text-lg">
          <p>
            HyperBlogs are AI-generated blog posts created from DataRoom knowledge graphs. Using advanced Hierarchical
            Task Network (HTN) generation, we transform structured knowledge into comprehensive, well-organized content
            that&apos;s both informative and engaging.
          </p>
          <p>
            Each HyperBlog is payment-gated using the x402 protocol with blockchain verification. When you purchase a
            blog, your payment is recorded on-chain, ensuring transparent and secure transactions.
          </p>
          <p>
            Generation happens asynchronously in 30-60 seconds, allowing our AI to carefully craft each section with
            context-aware content. Track the status in real-time and get notified when your blog is ready.
          </p>
        </div>

        <div className="modal-action mt-8">
          <button
            className="btn btn-primary px-8 shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
