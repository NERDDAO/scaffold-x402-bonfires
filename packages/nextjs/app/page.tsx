"use client";

import Link from "next/link";
import { HyperBlogFeed } from "@/components/HyperBlogFeed";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import { ClockIcon, CurrencyDollarIcon, SparklesIcon } from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 max-w-4xl">
          <h1 className="text-center mb-8">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-5xl font-bold">HyperBlogs</span>
            <span className="block text-xl mt-4 text-base-content/70">
              Transform knowledge graphs into comprehensive, AI-generated blog posts with blockchain-verified payments
            </span>
          </h1>

          <div className="flex justify-center my-8">
            <ConnectButton />
          </div>

          <div className="bg-base-200 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold mb-4">What Are HyperBlogs?</h2>
            <div className="space-y-3 text-base-content/80">
              <p>
                HyperBlogs are AI-generated blog posts created from DataRoom knowledge graphs. Using advanced
                Hierarchical Task Network (HTN) generation, we transform structured knowledge into comprehensive,
                well-organized content that&apos;s both informative and engaging.
              </p>
              <p>
                Each HyperBlog is payment-gated using the x402 protocol with blockchain verification. When you purchase
                a blog, your payment is recorded on-chain, ensuring transparent and secure transactions.
              </p>
              <p>
                Generation happens asynchronously in 30-60 seconds, allowing our AI to carefully craft each section with
                context-aware content. Track the status in real-time and get notified when your blog is ready.
              </p>
            </div>
          </div>

          <div className="bg-base-200 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <div className="steps steps-vertical lg:steps-horizontal w-full">
              <div className="step step-primary">Browse Data Rooms</div>
              <div className="step step-primary">Connect & Pay</div>
              <div className="step step-primary">AI Generates</div>
              <div className="step step-primary">Read & Share</div>
            </div>
          </div>
        </div>

        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-8 flex-col md:flex-row max-w-6xl mx-auto">
            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <SparklesIcon className="h-12 w-12 text-primary mb-2" />
                <h2 className="card-title">AI-Powered Generation</h2>
                <p>
                  Advanced AI generates comprehensive blog posts from knowledge graphs using hierarchical task networks.
                  Each section is crafted with context-aware content.
                </p>
                <div className="badge badge-lg badge-primary">Avg. 2000+ words</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <CurrencyDollarIcon className="h-12 w-12 text-secondary mb-2" />
                <h2 className="card-title">Payment-Gated Access</h2>
                <p>
                  Secure x402 protocol payments with blockchain verification. Each blog purchase is recorded on-chain
                  with transaction hash tracking.
                </p>
                <div className="badge badge-lg badge-secondary">Verified On-Chain</div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <ClockIcon className="h-12 w-12 text-accent mb-2" />
                <h2 className="card-title">Async Generation</h2>
                <p>
                  Blog generation happens in the background. Track status in real-time and receive notifications when
                  your blog is ready.
                </p>
                <div className="badge badge-lg badge-accent">30-60 seconds</div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-12 mb-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-base-content/70 mb-6">
              Discover data rooms and create your first AI-generated blog
            </p>
            <Link href="/data-rooms" className="btn btn-primary btn-lg">
              Browse Data Rooms
            </Link>
          </div>

          <div className="max-w-4xl mx-auto mt-12">
            <div className="collapse collapse-plus bg-base-100">
              <input type="checkbox" />
              <div className="collapse-title text-xl font-medium">Technology Stack</div>
              <div className="collapse-content">
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <strong>HTN Generation:</strong> Hierarchical Task Network for structured blog creation
                  </li>
                  <li>
                    <strong>Knowledge Graphs:</strong> Graphiti-powered knowledge graph traversal and content extraction
                  </li>
                  <li>
                    <strong>OnchainFi:</strong> Payment verification and settlement via x402 protocol
                  </li>
                  <li>
                    <strong>Async Processing:</strong> Background task processing with status polling
                  </li>
                  <li>
                    <strong>RainbowKit + wagmi:</strong> Wallet connection and transaction signing
                  </li>
                  <li>
                    <strong>EIP-712:</strong> Typed data signatures for secure payments
                  </li>
                  <li>
                    <strong>ERC-3009:</strong> TransferWithAuthorization for gasless payments
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Latest HyperBlogs Section */}
          <div className="max-w-6xl mx-auto mt-16 mb-12">
            <h2 className="text-3xl font-bold mb-2 text-center">Latest HyperBlogs</h2>
            <p className="text-base-content/70 text-center mb-8">
              Explore AI-generated blogs from knowledge graphs across all DataRooms
            </p>
            <div className="card bg-base-100 shadow-xl p-6">
              <HyperBlogFeed showFilters={true} title="" autoRefreshInterval={60000} initialLimit={6} />
            </div>
            <div className="text-center mt-8">
              <Link href="/data-rooms" className="btn btn-primary btn-wide">
                Browse All DataRooms →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Home;
