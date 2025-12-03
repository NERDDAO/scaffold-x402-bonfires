"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HyperBlogFeed } from "@/components/HyperBlogFeed";
import { WhatIsHyperBlogsModal } from "@/components/WhatIsHyperBlogsModal";
import type { NextPage } from "next";
import { ClockIcon, CurrencyDollarIcon, SparklesIcon } from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  useEffect(() => {
    const hasSeenInfo = localStorage.getItem("hasSeenHyperBlogsInfo");
    if (!hasSeenInfo) {
      setIsInfoModalOpen(true);
      localStorage.setItem("hasSeenHyperBlogsInfo", "true");
    }
  }, []);

  return (
    <>
      <div className="flex items-center flex-col grow pt-10 min-h-screen">
        <div className="px-5 max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-section animate-fade-in">
            <div>
              <span className="block text-2xl mb-4 text-base-content/60 font-medium tracking-wide">Welcome to</span>
              <h1 className="block text-5xl sm:text-6xl lg:text-7xl font-bold font-serif tracking-tight mb-6 text-base-content">
                HyperBlogs
              </h1>
              <p className="block text-xl mt-4 text-base-content/70 leading-relaxed max-w-2xl mx-auto">
                Transform knowledge graphs into comprehensive, AI-generated blog posts with blockchain-verified payments
              </p>
            </div>

            <div className="flex justify-center items-center">
              <button
                className="btn btn-ghost btn-sm text-base-content/60 hover:text-primary hover:bg-transparent"
                onClick={() => setIsInfoModalOpen(true)}
              >
                What are HyperBlogs?
              </button>
            </div>
          </div>

          {/* Latest HyperBlogs Section */}
          <div className="max-w-6xl mx-auto mb-20 w-full space-y-8">
            <div className="flex flex-col items-center gap-2 text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold font-serif text-base-content">Latest HyperBlogs</h2>
              <p className="text-base-content/60 text-lg">
                Explore AI-generated blogs from knowledge graphs across all DataRooms
              </p>
            </div>

            <div className="p-1 bg-transparent">
              <HyperBlogFeed showFilters={true} title="" autoRefreshInterval={60000} initialLimit={6} />
            </div>

            <div className="text-center mt-12">
              <Link href="/data-rooms" className="btn btn-primary btn-lg transition-all duration-300 px-8">
                Browse All DataRooms →
              </Link>
            </div>
          </div>

          {/* Learn How It Works CTA */}
          <div className="bg-base-200/50 p-8 sm:p-10 rounded-2xl mb-20 w-full border border-base-content/5 text-center">
            <h2 className="text-2xl font-bold mb-3 font-serif">New to HyperBlogs?</h2>
            <p className="text-base-content/70 mb-6">
              Learn how knowledge graphs transform into AI-generated blog posts with blockchain payments.
            </p>
            <Link href="/how-it-works" className="btn btn-outline btn-primary transition-all duration-300">
              Learn How It Works →
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="grow bg-base-200/30 w-full mt-12 px-6 py-20 border-t border-base-content/5">
          <div className="flex justify-center gap-8 flex-col md:flex-row max-w-6xl mx-auto">
            <div className="card-minimal flex-1 bg-base-100 animate-slide-up">
              <div className="items-center text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <SparklesIcon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold font-serif">AI-Powered Generation</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Advanced AI generates comprehensive blog posts from knowledge graphs using hierarchical task networks.
                </p>
                <div className="badge badge-outline badge-primary mt-2">Avg. 2000+ words</div>
              </div>
            </div>

            <div className="card-minimal flex-1 bg-base-100 animate-slide-up" style={{ animationDelay: "100ms" }}>
              <div className="items-center text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-secondary/20 rounded-full flex items-center justify-center mb-4">
                  <CurrencyDollarIcon className="h-8 w-8 text-secondary-content" />
                </div>
                <h3 className="text-xl font-bold font-serif">Payment-Gated Access</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Secure x402 protocol payments with blockchain verification and on-chain transaction tracking.
                </p>
                <div className="badge badge-outline badge-secondary mt-2">Verified On-Chain</div>
              </div>
            </div>

            <div className="card-minimal flex-1 bg-base-100 animate-slide-up" style={{ animationDelay: "200ms" }}>
              <div className="items-center text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4">
                  <ClockIcon className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-xl font-bold font-serif">Async Generation</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Blog generation happens in the background. Track status in real-time with instant notifications.
                </p>
                <div className="badge badge-outline badge-accent mt-2">30-60 seconds</div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-4xl mx-auto mt-24 mb-12 text-center space-y-6">
            <h2 className="text-4xl font-bold font-serif">Ready to Get Started?</h2>
            <p className="text-xl text-base-content/70 mb-8">
              Discover data rooms and create your first AI-generated blog
            </p>
            <Link href="/data-rooms" className="btn btn-primary btn-lg px-10 transition-all duration-300">
              Browse Data Rooms
            </Link>
          </div>

          {/* Tech Stack */}
          <div className="max-w-3xl mx-auto mt-20">
            <div className="collapse collapse-plus bg-base-100 border border-base-content/5 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl">
              <input type="checkbox" />
              <div className="collapse-title text-xl font-medium font-serif px-8 py-6">Technology Stack</div>
              <div className="collapse-content px-8 pb-8">
                <ul className="space-y-4 text-base-content/80 leading-relaxed">
                  <li className="flex gap-3">
                    <span className="font-semibold text-primary min-w-[140px]">HTN Generation:</span>
                    <span>Hierarchical Task Network for structured blog creation</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-primary min-w-[140px]">Knowledge Graphs:</span>
                    <span>Graphiti-powered knowledge graph traversal and content extraction</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-primary min-w-[140px]">OnchainFi:</span>
                    <span>Payment verification and settlement via x402 protocol</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-primary min-w-[140px]">Async Processing:</span>
                    <span>Background task processing with status polling</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-semibold text-primary min-w-[140px]">RainbowKit + wagmi:</span>
                    <span>Wallet connection and transaction signing</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WhatIsHyperBlogsModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </>
  );
};

export default Home;
