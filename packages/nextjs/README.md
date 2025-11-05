# Delve x402 Payment-Gated AI Demo

A Scaffold-ETH 2 application demonstrating blockchain-powered payment-gated AI interactions using the x402 payment protocol and OnchainFi.

## Overview

This application integrates Scaffold-ETH 2 with Delve's AI agent backend, enabling users to:
- Chat with AI agents using blockchain payments
- Search knowledge graphs with paid queries
- Benefit from microsub payments (pay once, query multiple times)

## Features

- **🤖 Payment-Gated AI Chat**: Interact with AI agents secured by x402 payments
- **🔍 Knowledge Graph Search**: Query structured knowledge with blockchain payments
- **💰 Microsub System**: Pay once, get multiple query credits
- **🎨 DaisyUI Components**: Clean, accessible UI built with DaisyUI
- **🔐 Secure Payments**: EIP-712 typed signatures for payment authorization

## Architecture

### Payment Flow

```
User Wallet → Sign EIP-712 → Build x402 Header → Next.js API Route → Delve Backend
                                                                          ↓
                                                                    OnchainFi API
                                                                    (Verify/Settle)
```

1. **Client Side**: User connects wallet (RainbowKit) and signs EIP-712 typed data
2. **Next.js API**: Proxies requests with payment headers to Delve backend
3. **Delve Backend**: Verifies and settles payments via OnchainFi REST API
4. **Response**: Returns AI results + payment metadata (microsub status)

## Setup Instructions

### Prerequisites

- Node.js 18+ and Yarn
- Running Delve backend with OnchainFi configured
- OnchainFi API key (for Delve backend)
- Test tokens on Abstract testnet or Base mainnet

### 1. Install Dependencies

```bash
cd demos/scaffold-eth-2-x402
yarn install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

Edit `.env.local` with your configuration:

```bash
# Delve Backend
NEXT_PUBLIC_DELVE_API_URL=http://localhost:8000

# Payment Configuration
NEXT_PUBLIC_PAYMENT_AMOUNT=0.01
NEXT_PUBLIC_CHAIN_ID=11124
NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS=0x... # Your test token address
NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS=0x... # Your receiving wallet
NEXT_PUBLIC_PAYMENT_NETWORK=abstract

# Microsub Configuration
NEXT_PUBLIC_QUERY_LIMIT=25
NEXT_PUBLIC_EXPIRATION_DAYS=30

# Optional
NEXT_PUBLIC_DEFAULT_AGENT_ID=your-agent-id
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your-project-id
```

**Important**: Payment configuration must match your Delve backend's OnchainFi settings!

### 3. Start the Development Server

```bash
cd packages/nextjs
yarn dev
```

Visit `http://localhost:3000`

### 4. Configure Delve Backend

Ensure your Delve backend is running with OnchainFi configured:

```python
# In delve's .env or environment
ONCHAINFI_API_KEY=your_onchainfi_api_key
ONCHAINFI_BASE_URL=https://api.onchain.fi
ONCHAINFI_NETWORK=abstract
ONCHAINFI_TOKEN=0x... # Same as NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS
ONCHAINFI_RECIPIENT_ADDRESS=0x... # Same as NEXT_PUBLIC_PAYMENT_RECIPIENT_ADDRESS
```

## Usage

### 1. Connect Wallet

Click "Connect Wallet" and select your wallet provider (MetaMask, WalletConnect, etc.)

### 2. Navigate to a Feature

- **AI Chat**: `/x402-chat` - Have conversations with AI agents
- **Knowledge Graph Search**: `/x402-delve` - Query the knowledge graph

### 3. Sign Payment Authorization

When you initiate an action, you'll be prompted to sign an EIP-712 typed message. This creates a payment authorization without spending gas.

### 4. View Payment Status

The UI displays:
- Payment verification status
- Settlement status
- Microsub information (queries remaining, expiration)
- Transaction hash

## Project Structure

```
packages/nextjs/
├── app/
│   ├── api/
│   │   ├── agents/[agent_id]/
│   │   │   ├── chat/route.ts          # Chat API proxy
│   │   │   └── delve/route.ts         # Search API proxy
│   │   └── knowledge_graph/
│   │       └── episode_update/route.ts # Episode API proxy
│   ├── x402-chat/page.tsx             # Chat interface page
│   ├── x402-delve/page.tsx            # Search interface page
│   └── page.tsx                        # Landing page
├── components/
│   ├── ChatMessage.tsx                 # Chat message display (DaisyUI)
│   ├── PaymentStatusBadge.tsx         # Payment status (DaisyUI)
│   ├── PaidChatInterface.tsx          # Chat UI component
│   └── PaidDelveInterface.tsx         # Search UI component
├── hooks/
│   └── usePaymentHeader.ts            # Payment header hook
├── lib/
│   ├── config.ts                       # Environment configuration
│   ├── utils.ts                        # Utility functions
│   ├── payment/
│   │   └── build-payment-header.ts    # x402 header construction
│   └── types/
│       ├── x402.ts                     # x402 protocol types
│       └── delve-api.ts                # Delve API types
└── .env.example                        # Environment template
```

## API Routes

### POST `/api/agents/[agent_id]/chat`

Payment-gated chat with AI agent.

**Request:**
```json
{
  "message": "Hello!",
  "chat_history": [],
  "graph_mode": "adaptive",
  "payment_header": "base64_encoded_payment..."
}
```

**Response:**
```json
{
  "response": "Hello! How can I help?",
  "agent_id": "agent-123",
  "payment": {
    "verified": true,
    "settled": true,
    "microsub_active": true,
    "queries_remaining": 24
  }
}
```

### POST `/api/agents/[agent_id]/delve`

Payment-gated knowledge graph search.

**Request:**
```json
{
  "query": "artificial intelligence",
  "num_results": 10,
  "payment_header": "base64_encoded_payment..."
}
```

**Response:**
```json
{
  "success": true,
  "entities": [...],
  "episodes": [...],
  "metrics": {
    "entity_count": 5,
    "episode_count": 3
  },
  "payment": { ... }
}
```

## DaisyUI Components Used

This app uses DaisyUI components for a clean, accessible UI:

- **Cards**: `card`, `card-body`, `card-title`
- **Buttons**: `btn`, `btn-primary`, `btn-secondary`
- **Inputs**: `input`, `textarea`, `select`
- **Badges**: `badge`, `badge-success`, `badge-info`
- **Alerts**: `alert`, `alert-error`, `alert-info`
- **Chat**: `chat`, `chat-bubble`, `chat-image`
- **Loading**: `loading`, `loading-spinner`, `loading-dots`
- **Stats**: `stats`, `stat`, `stat-value`
- **Tabs**: `tabs`, `tab`, `tab-active`
- **Steps**: `steps`, `step`, `step-primary`

No custom component library needed - everything uses DaisyUI!

## Troubleshooting

### "Wallet not connected" Error

Make sure you've clicked the ConnectButton and approved the connection.

### "Payment verification failed" Error

Check that:
- Token address matches between frontend and Delve backend
- Recipient address matches
- Network name matches
- You have sufficient token balance
- Delve backend is running and accessible

### "Request timeout" Error

Delve backend may be slow or down. Check backend logs and ensure it's running.

### Microsub Not Working

Verify that Delve backend has microsub enabled and configured properly. Check backend logs for microsub creation/usage.

## Development

### Adding New Features

1. Create API route in `app/api/`
2. Create component in `components/`
3. Add page in `app/`
4. Update types in `lib/types/`

### Testing Locally

1. Start Delve backend: `cd ../../ && python src/server.py`
2. Start Next.js: `yarn dev`
3. Connect wallet to testnet
4. Try payment flows

## Production Deployment

1. Set production environment variables
2. Build: `yarn build`
3. Deploy to Vercel: `yarn vercel`
4. Ensure Delve backend is deployed and accessible
5. Update `NEXT_PUBLIC_DELVE_API_URL` to production URL

## References

- [Scaffold-ETH 2 Docs](https://docs.scaffoldeth.io/)
- [DaisyUI Components](https://daisyui.com/components/)
- [RainbowKit Docs](https://www.rainbowkit.com/docs/introduction)
- [wagmi Docs](https://wagmi.sh/)
- [x402 Protocol](https://github.com/coinbase/x402)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [ERC-3009](https://eips.ethereum.org/EIPS/eip-3009)
- [OnchainFi](https://onchain.fi/)

## License

MIT

