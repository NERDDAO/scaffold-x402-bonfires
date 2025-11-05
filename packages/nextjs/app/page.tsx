"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import type { NextPage } from "next";
import { ChatBubbleLeftRightIcon, CurrencyDollarIcon, MagnifyingGlassCircleIcon } from "@heroicons/react/24/outline";

const Home: NextPage = () => {
  return (
    <>
      <div className="flex items-center flex-col grow pt-10">
        <div className="px-5 max-w-4xl">
          <h1 className="text-center mb-8">
            <span className="block text-2xl mb-2">Welcome to</span>
            <span className="block text-5xl font-bold">Delve x402 Payment Demo</span>
            <span className="block text-xl mt-4 text-base-content/70">Blockchain-Powered AI Interactions</span>
          </h1>

          <div className="flex justify-center my-8">
            <ConnectButton />
          </div>

          <div className="alert alert-info mb-8">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              className="stroke-current shrink-0 w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <div>
              <h3 className="font-bold">x402 Payment Protocol</h3>
              <div className="text-sm">
                Connect your wallet and sign payment authorizations to access AI-powered features using OnchainFi.
              </div>
            </div>
          </div>

          <div className="bg-base-200 p-6 rounded-lg mb-8">
            <h2 className="text-2xl font-bold mb-4">How It Works</h2>
            <div className="steps steps-vertical lg:steps-horizontal w-full">
              <div className="step step-primary">Connect Wallet</div>
              <div className="step step-primary">Sign Payment</div>
              <div className="step step-primary">Access AI</div>
              <div className="step step-primary">Get Results</div>
            </div>
          </div>
        </div>

        <div className="grow bg-base-300 w-full mt-16 px-8 py-12">
          <div className="flex justify-center items-center gap-8 flex-col md:flex-row max-w-6xl mx-auto">
            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <ChatBubbleLeftRightIcon className="h-12 w-12 text-primary mb-2" />
                <h2 className="card-title">AI Agent Chat</h2>
                <p>
                  Have conversations with AI agents using blockchain payments. Each interaction is secured by x402
                  payment protocol.
                </p>
                <div className="card-actions">
                  <Link href="/x402-chat" className="btn btn-primary">
                    Start Chatting
                  </Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <MagnifyingGlassCircleIcon className="h-12 w-12 text-secondary mb-2" />
                <h2 className="card-title">Knowledge Graph Search</h2>
                <p>
                  Search the knowledge graph and discover connections. Payment enables access to structured knowledge.
                </p>
                <div className="card-actions">
                  <Link href="/x402-delve" className="btn btn-secondary">
                    Search Graph
                  </Link>
                </div>
              </div>
            </div>

            <div className="card bg-base-100 shadow-xl max-w-sm">
              <div className="card-body items-center text-center">
                <CurrencyDollarIcon className="h-12 w-12 text-accent mb-2" />
                <h2 className="card-title">Microsub Payments</h2>
                <p>
                  Pay once, query multiple times. The microsub system tracks your usage and gives you query credits.
                </p>
                <div className="badge badge-lg badge-accent">Smart Payments</div>
              </div>
            </div>
          </div>

          <div className="max-w-4xl mx-auto mt-12">
            <div className="collapse collapse-plus bg-base-100">
              <input type="checkbox" />
              <div className="collapse-title text-xl font-medium">Technology Stack</div>
              <div className="collapse-content">
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <strong>OnchainFi:</strong> Payment verification and settlement via REST API
                  </li>
                  <li>
                    <strong>Delve Backend:</strong> Knowledge graph and AI agent management
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
        </div>
      </div>
    </>
  );
};

export default Home;
