"use client";

import Link from "next/link";
import { ArrowRightIcon, ClockIcon, CurrencyDollarIcon, FolderIcon, SparklesIcon } from "@heroicons/react/24/outline";

export default function HowItWorksPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Hero Section */}
      <div className="text-center mb-16 space-y-6">
        <h1 className="text-5xl font-bold font-serif tracking-tight text-base-content">How It Works</h1>
        <p className="text-xl text-base-content/70 max-w-3xl mx-auto leading-relaxed">
          Transform knowledge graphs into comprehensive, AI-generated blog posts in four simple steps.
          Blockchain-verified payments ensure secure access to premium content.
        </p>
      </div>

      {/* Steps Overview */}
      <div className="bg-base-200/50 p-8 sm:p-12 rounded-2xl mb-16 border border-base-content/5">
        <div className="steps steps-vertical lg:steps-horizontal w-full">
          <div className="step step-primary text-sm font-medium">Browse Data Rooms</div>
          <div className="step step-primary text-sm font-medium">Connect & Pay</div>
          <div className="step step-primary text-sm font-medium">AI Generates</div>
          <div className="step step-primary text-sm font-medium">Read & Share</div>
        </div>
      </div>

      {/* Detailed Steps */}
      <div className="mb-20">
        <h2 className="text-3xl font-bold font-serif text-center mb-12">The Process</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Step 1 */}
          <div className="card-minimal bg-base-100 p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <FolderIcon className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-3">
                <div className="badge badge-primary badge-outline">Step 1</div>
                <h3 className="text-xl font-bold font-serif">Browse Data Rooms</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Explore the marketplace of data rooms, each containing curated knowledge graphs covering specific
                  topics. View pricing, content previews, and creator information before committing.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="card-minimal bg-base-100 p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-secondary/20 rounded-full flex items-center justify-center shrink-0">
                <CurrencyDollarIcon className="h-7 w-7 text-secondary-content" />
              </div>
              <div className="space-y-3">
                <div className="badge badge-secondary badge-outline">Step 2</div>
                <h3 className="text-xl font-bold font-serif">Connect & Pay</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Connect your wallet and make a secure payment using the x402 protocol. All transactions are verified
                  on-chain, ensuring transparent and trustless access to content.
                </p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="card-minimal bg-base-100 p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
                <SparklesIcon className="h-7 w-7 text-accent" />
              </div>
              <div className="space-y-3">
                <div className="badge badge-accent badge-outline">Step 3</div>
                <h3 className="text-xl font-bold font-serif">AI Generates</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Our AI system uses Hierarchical Task Networks to traverse the knowledge graph and generate
                  comprehensive blog posts. Generation typically takes 30-60 seconds and produces 2000+ word articles.
                </p>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="card-minimal bg-base-100 p-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-info/10 rounded-full flex items-center justify-center shrink-0">
                <ClockIcon className="h-7 w-7 text-info" />
              </div>
              <div className="space-y-3">
                <div className="badge badge-info badge-outline">Step 4</div>
                <h3 className="text-xl font-bold font-serif">Read & Share</h3>
                <p className="text-base-content/70 leading-relaxed">
                  Once generated, your HyperBlog is ready to read. Access your content anytime, share it with others,
                  and explore the underlying knowledge graph that powered its creation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technology Section */}
      <div className="bg-base-200/30 p-8 sm:p-12 rounded-2xl mb-16 border border-base-content/5">
        <h2 className="text-3xl font-bold font-serif text-center mb-8">Powered By</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="text-center p-4">
            <div className="font-semibold text-primary mb-2">HTN Generation</div>
            <p className="text-sm text-base-content/60">Hierarchical Task Networks for structured content</p>
          </div>
          <div className="text-center p-4">
            <div className="font-semibold text-primary mb-2">Knowledge Graphs</div>
            <p className="text-sm text-base-content/60">Graphiti-powered graph traversal</p>
          </div>
          <div className="text-center p-4">
            <div className="font-semibold text-primary mb-2">x402 Protocol</div>
            <p className="text-sm text-base-content/60">Blockchain payment verification</p>
          </div>
          <div className="text-center p-4">
            <div className="font-semibold text-primary mb-2">RainbowKit</div>
            <p className="text-sm text-base-content/60">Seamless wallet connection</p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center space-y-6">
        <h2 className="text-4xl font-bold font-serif">Ready to Get Started?</h2>
        <p className="text-xl text-base-content/70 max-w-2xl mx-auto">
          Explore data rooms and create your first AI-generated blog post today.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link href="/data-rooms" className="btn btn-primary btn-lg px-10 transition-all duration-300 gap-2">
            Browse Data Rooms
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
          <Link href="/" className="btn btn-ghost btn-lg transition-all duration-300">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
