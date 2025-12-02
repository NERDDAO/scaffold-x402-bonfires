# HyperBlog Creation Journey

This document traces the complete journey of creating a HyperBlog, from user interaction to final blog generation.

## Overview

A HyperBlog is an AI-generated blog post created from a DataRoom's knowledge graph. The creation process involves:
1. User selects a DataRoom
2. User fills out a creation form
3. Payment is signed and verified via x402 protocol
4. Blog generation request is sent to backend
5. Frontend polls for generation status
6. Blog becomes available once generation completes

---

## Entry Points

Users can initiate HyperBlog creation from two locations:

### 1. DataRoom Marketplace (`/data-rooms`)
- **Component**: `DataRoomMarketplaceCard` 
- **File**: `packages/nextjs/components/DataRoomMarketplaceCard.tsx`
- **Trigger**: Click "📝 Create Blog" button on any active DataRoom card
- **Requirements**: Wallet must be connected, DataRoom must be active

```337:339:packages/nextjs/components/DataRoomMarketplaceCard.tsx
              <button className="btn btn-secondary btn-sm" onClick={handleOpenHyperBlogModal}>
                📝 Create Blog
              </button>
```

### 2. DataRoom Detail Page (`/data-rooms/[dataroomId]`)
- **Component**: `DataRoomDetailPage`
- **File**: `packages/nextjs/app/data-rooms/[dataroomId]/page.tsx`
- **Trigger**: Click "Create HyperBlog" button on the detail page
- **Requirements**: Wallet must be connected, DataRoom must be active

---

## Step-by-Step Flow

### Step 1: Modal Opens - HyperBlogCreator Component

**File**: `packages/nextjs/components/HyperBlogCreator.tsx`

When the user clicks "Create Blog", the `HyperBlogCreator` modal opens:

```20:27:packages/nextjs/components/HyperBlogCreator.tsx
export const HyperBlogCreator: React.FC<HyperBlogCreatorProps> = ({
  dataroomId,
  dataroomDescription,
  dataroomPrice,
  isOpen,
  onClose,
  onSuccess,
}) => {
```

**Initial State**:
- Form fields: `userQuery`, `isPublic`, `blogLength`
- Loading states: `isLoading`, `generationStatus`
- Result tracking: `hyperblogId`, `wordCount`, `preview`

**User Requirements**:
- Wallet must be connected (checked via `useAccount()` hook)
- If not connected, shows ConnectButton prompt

```330:334:packages/nextjs/components/HyperBlogCreator.tsx
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-center text-lg opacity-80">Please connect your wallet to create a blog</p>
            <ConnectButton />
          </div>
```

### Step 2: User Fills Form

**Form Fields**:

1. **Blog Topic** (userQuery)
   - Textarea input (3-500 characters)
   - Real-time character count validation
   - Placeholder examples provided

```346:360:packages/nextjs/components/HyperBlogCreator.tsx
                <textarea
                  ref={textareaRef}
                  className={`textarea textarea-bordered h-24 sm:h-32 w-full ${
                    !isQueryValid && userQuery.length > 0 ? "textarea-error" : ""
                  }`}
                  placeholder="e.g., 'How to play white in chess openings' or 'Introduction to quantum computing'"
                  value={userQuery}
                  onChange={e => setUserQuery(e.target.value)}
                  maxLength={500}
                  disabled={isLoading || generationStatus === "generating"}
                />
```

2. **Blog Length** (blogLength)
   - Options: "short" (2 min), "medium" (5 min), "long" (10 min)
   - Default: "medium"

```367:395:packages/nextjs/components/HyperBlogCreator.tsx
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "short" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("short")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Short
                    <span className="text-xs opacity-70">(2 min)</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "medium" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("medium")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Medium
                    <span className="text-xs opacity-70">(5 min)</span>
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm flex-1 ${blogLength === "long" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setBlogLength("long")}
                    disabled={isLoading || generationStatus === "generating"}
                  >
                    Long
                    <span className="text-xs opacity-70">(10 min)</span>
                  </button>
                </div>
```

3. **Visibility Toggle** (isPublic)
   - Checkbox: "Make blog public (visible in dataroom feed)"
   - Default: `true`

```401:413:packages/nextjs/components/HyperBlogCreator.tsx
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    disabled={isLoading || generationStatus === "generating"}
                  />
                  <span className="label-text">Make blog public (visible in dataroom feed)</span>
                </label>
              </div>
```

### Step 3: User Clicks "Create Blog" Button

**Handler**: `handleSubmit` function

```154:164:packages/nextjs/components/HyperBlogCreator.tsx
  const handleSubmit = useCallback(async () => {
    // Pre-validation
    if (!isConnected || !address) {
      setError("Please connect your wallet to create a blog");
      notification.error("Please connect your wallet");
      return;
    }

    if (userQuery.trim().length < 3 || userQuery.length > 500) {
      return;
    }
```

**Validation**:
- Wallet connected check
- Query length validation (3-500 chars)
- Sets `isLoading = true`

### Step 4: Payment Amount Calculation

The component fetches or uses the DataRoom price:

```169:183:packages/nextjs/components/HyperBlogCreator.tsx
    try {
      // Calculate payment amount
      let priceUsd: number;

      if (dataroomPrice !== undefined) {
        priceUsd = dataroomPrice;
      } else {
        // Fetch dataroom details to get price
        const dataroomResponse = await fetch(`/api/datarooms/${dataroomId}`);
        if (!dataroomResponse.ok) {
          throw new Error("Failed to fetch dataroom details");
        }
        const dataroomData = await dataroomResponse.json();
        priceUsd = dataroomData.price_usd;
      }
```

### Step 5: Payment Header Creation & Signing

**Hook**: `usePaymentHeader` from `packages/nextjs/hooks/usePaymentHeader.ts`

```188:194:packages/nextjs/components/HyperBlogCreator.tsx
      // Build and sign payment
      notification.info("Signing payment...");
      const paymentHeader = await buildAndSignPaymentHeader(amount);

      if (!paymentHeader) {
        throw new Error("Payment signing cancelled or failed");
      }
```

**Payment Header Process**:
1. Uses `buildAndSignPaymentHeader(amount)` hook
2. Creates typed data for EIP-712 signature
3. User signs with wallet (RainbowKit/wagmi)
4. Returns encoded `X402PaymentHeader` string

**Payment Header Hook** (`usePaymentHeader.ts`):
- Builds EIP-712 typed data
- Signs with `useSignTypedData` from wagmi
- Encodes payment header with signature
- Returns `X402PaymentHeader` object

```44:79:packages/nextjs/hooks/usePaymentHeader.ts
  const buildAndSignPaymentHeader = useCallback(
    async (amount?: string, skipSigning?: boolean): Promise<X402PaymentHeader | null> => {
      try {
        setError(null);
        setIsProcessing(true);

        // Early return if using existing microsub (skipSigning mode)
        // In this case, the caller should provide tx_hash instead of payment_header
        if (skipSigning === true) {
          return null;
        }

        if (!isConnected || !address) {
          throw new Error("Wallet not connected. Please connect your wallet to continue.");
        }

        const paymentAmount = amount || config.payment.amount;
        // Sign to OnchainFi intermediary address for /v1/pay endpoint
        // Backend will specify final recipient in "to" field
        const typedData = buildPaymentTypedData({
          tokenAddress: config.payment.tokenAddress,
          recipientAddress: config.payment.intermediaryAddress, // Sign to intermediary
          amount: paymentAmount,
          network: config.payment.network,
          chainId: config.payment.chainId,
          userAddress: address,
        });

        const signature = await signTypedDataAsync({
          domain: typedData.domain as any,
          types: typedData.types as any,
          primaryType: typedData.primaryType,
          message: typedData.message as any,
        });

        return encodePaymentHeader(typedData.message, signature, config.payment.network);
```

### Step 6: API Request - Purchase HyperBlog

**Endpoint**: `POST /api/hyperblogs/purchase`

**Request Body** (`PurchaseHyperBlogRequest`):
```typescript
{
  payment_header: string;      // Signed payment header
  dataroom_id: string;          // Target DataRoom ID
  user_query: string;           // User's blog topic query
  is_public?: boolean;          // Visibility (default: true)
  blog_length?: "short" | "medium" | "long";  // Length preference
  expected_amount?: string;     // Payment amount
}
```

**Frontend Call**:

```196:213:packages/nextjs/components/HyperBlogCreator.tsx
      // Build request body
      const requestBody: PurchaseHyperBlogRequest = {
        payment_header: paymentHeader,
        dataroom_id: dataroomId,
        user_query: userQuery.trim(),
        is_public: isPublic,
        blog_length: blogLength,
      };

      // Call purchase API
      notification.info("Creating blog...");
      const response = await fetch("/api/hyperblogs/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
```

### Step 7: API Route - Forward to Delve Backend

**File**: `packages/nextjs/app/api/hyperblogs/purchase/route.ts`

**Process**:
1. Validates request body fields
2. Constructs `PurchaseHyperBlogRequest`
3. Forwards to Delve backend: `${config.delve.apiUrl}/hyperblogs/purchase`
4. Returns response or error

```18:61:packages/nextjs/app/api/hyperblogs/purchase/route.ts
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
    }

    // Validate required fields
    if (!body.payment_header || typeof body.payment_header !== "string") {
      return NextResponse.json({ error: "Missing required field: payment_header" }, { status: 400 });
    }

    if (!body.dataroom_id || typeof body.dataroom_id !== "string") {
      return NextResponse.json({ error: "Missing required field: dataroom_id" }, { status: 400 });
    }

    if (!body.user_query || typeof body.user_query !== "string") {
      return NextResponse.json({ error: "Missing required field: user_query" }, { status: 400 });
    }

    // Construct purchase request
    const purchaseRequest: PurchaseHyperBlogRequest = {
      payment_header: body.payment_header,
      dataroom_id: body.dataroom_id,
      user_query: body.user_query,
      is_public: body.is_public ?? true,
      expected_amount: body.expected_amount,
    };

    // Forward to delve backend
    const delveUrl = `${config.delve.apiUrl}/hyperblogs/purchase`;

    console.log(`Forwarding HyperBlog purchase request to: ${delveUrl}`);

    const delveResponse = await fetch(delveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(purchaseRequest),
      signal: AbortSignal.timeout(config.delve.timeout),
    });
```

**Backend Processing** (Delve):
- Verifies payment header signature
- Validates payment amount
- Settles payment via x402 protocol
- Creates HyperBlog record with status "generating"
- Queues blog generation task
- Returns `PurchaseHyperBlogResponse` with initial HyperBlog info

### Step 8: Handle Purchase Response

**Response Type** (`PurchaseHyperBlogResponse`):
```typescript
{
  hyperblog: HyperBlogInfo;  // Initial blog record
  payment: PaymentMetadata;  // Payment verification details
}
```

**Frontend Handling**:

```220:241:packages/nextjs/components/HyperBlogCreator.tsx
      const data: PurchaseHyperBlogResponse = await response.json();

      // Handle success
      const createdHyperblogId = data.hyperblog.id;
      const status = data.hyperblog.generation_status;

      setHyperblogId(createdHyperblogId);
      setGenerationStatus(status);

      notification.success("Blog purchase successful! Generating content...");

      // Start polling if generating
      if (status === "generating") {
        await startPolling(createdHyperblogId);
      } else if (status === "completed") {
        setWordCount(data.hyperblog.word_count);
        setPreview(data.hyperblog.preview);
        notification.success("Blog generated successfully!");
        if (onSuccess) {
          onSuccess(createdHyperblogId);
        }
      }
```

**Status Handling**:
- **"generating"**: Starts polling for status updates
- **"completed"**: Shows success, calls `onSuccess` callback
- **"failed"**: Shows error message

### Step 9: Status Polling (If Generating)

**Polling Function**: `startPolling`

**Process**:
1. Polls every 5 seconds: `GET /api/hyperblogs/${hyperblogId}`
2. Checks `generation_status` field
3. Updates UI with status, word count, preview
4. Stops polling when status is "completed" or "failed"

```105:151:packages/nextjs/components/HyperBlogCreator.tsx
  const startPolling = useCallback(
    async (hyperblogIdToCheck: string) => {
      // Clear existing interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      // Poll function
      const pollStatus = async () => {
        try {
          const response = await fetch(`/api/hyperblogs/${hyperblogIdToCheck}`);
          if (!response.ok) {
            console.error("Failed to fetch hyperblog status:", response.statusText);
            return;
          }

          const data: HyperBlogInfo = await response.json();
          setGenerationStatus(data.generation_status);

          if (data.generation_status === "completed") {
            setWordCount(data.word_count);
            setPreview(data.preview);
            stopPolling();
            notification.success("Blog generation completed!");
            if (onSuccess) {
              onSuccess(hyperblogIdToCheck);
            }
          } else if (data.generation_status === "failed") {
            stopPolling();
            setError("Blog generation failed. Please try again.");
            notification.error("Blog generation failed");
          }
          // If "generating", continue polling
        } catch (err) {
          console.error("Error polling hyperblog status:", err);
          // Don't stop polling on error - will retry on next interval
        }
      };

      // Call immediately
      await pollStatus();

      // Set up interval
      pollingIntervalRef.current = setInterval(pollStatus, 5000);
    },
    [stopPolling, onSuccess],
  );
```

**Status Polling API Route**:

**File**: `packages/nextjs/app/api/hyperblogs/[hyperblogId]/route.ts`

**Endpoint**: `GET /api/hyperblogs/[hyperblogId]`

**Process**:
1. Extracts `hyperblogId` from route params
2. Forwards to Delve: `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}`
3. Returns `HyperBlogInfo` with current status

```18:69:packages/nextjs/app/api/hyperblogs/[hyperblogId]/route.ts
export async function GET(request: NextRequest, { params }: { params: Promise<{ hyperblogId: string }> }) {
  try {
    // Extract hyperblogId from route params (await required in Next.js 15+)
    const { hyperblogId } = await params;

    // Validate hyperblogId
    if (!hyperblogId || typeof hyperblogId !== "string" || hyperblogId.trim() === "") {
      return NextResponse.json({ error: "Invalid hyperblogId parameter" }, { status: 400 });
    }

    // Forward to delve backend
    // Updated to use the new /datarooms/hyperblogs/{id} path
    const delveUrl = `${config.delve.apiUrl}/datarooms/hyperblogs/${hyperblogId}`;

    console.log(`Fetching HyperBlog status from: ${delveUrl}`);

    const delveResponse = await fetch(delveUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application-Type": "application/json",
      },
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // Handle non-OK responses
    if (!delveResponse.ok) {
      const error = await createErrorFromResponse(delveResponse);

      // Special handling for 404
      if (delveResponse.status === 404) {
        return NextResponse.json({ error: "HyperBlog not found" }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode },
      );
    }

    // Parse and return successful response
    const responseData: HyperBlogInfo = await delveResponse.json();

    console.log("HyperBlog status fetched successfully:", {
      hyperblog_id: responseData.id,
      generation_status: responseData.generation_status,
      word_count: responseData.word_count,
    });

    return NextResponse.json(responseData, { status: 200 });
```

### Step 10: Generation Complete

**When Status = "completed"**:

1. **Polling Stops**: `stopPolling()` is called
2. **UI Updates**:
   - Status badge changes to "✓ Completed"
   - Word count displayed
   - Preview text shown
   - "View Blog" button appears

```422:460:packages/nextjs/components/HyperBlogCreator.tsx
              {hyperblogId && (
                <div className="card bg-base-200">
                  <div className="card-body p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold">Status:</span>
                      {generationStatus === "generating" && (
                        <span className="badge badge-warning gap-2">
                          <span className="loading loading-spinner loading-xs"></span>
                          Generating...
                        </span>
                      )}
                      {generationStatus === "completed" && <span className="badge badge-success">✓ Completed</span>}
                      {generationStatus === "failed" && <span className="badge badge-error">✗ Failed</span>}
                    </div>

                    {generationStatus === "completed" && wordCount && (
                      <div className="text-sm space-y-2">
                        <p>
                          <span className="font-semibold">Word Count:</span> {wordCount.toLocaleString()} words
                        </p>
                        {preview && (
                          <div>
                            <p className="font-semibold mb-1">Preview:</p>
                            <p className="text-xs opacity-80 italic">{preview}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {generationStatus === "generating" && (
                      <p className="text-sm opacity-70">
                        Your blog is being generated. This may take 30-60 seconds. You can close this and check back
                        later.
                      </p>
                    )}
                  </div>
                </div>
              )}
```

3. **Success Callback**: `onSuccess(hyperblogId)` is called
   - In `DataRoomMarketplaceCard`: Refreshes DataRoom list, closes modal
   - In `DataRoomDetailPage`: Refreshes HyperBlog feed

```134:139:packages/nextjs/components/DataRoomMarketplaceCard.tsx
  const handleHyperBlogSuccess = (hyperblogId: string) => {
    notification.success(`Blog created successfully! ID: ${hyperblogId}`);
    onHyperBlogCreated?.(dataroom.id);
    setIsHyperBlogModalOpen(false);
    console.log("HyperBlog created:", hyperblogId);
  };
```

4. **User Can View Blog**:
   - Click "View Blog" button navigates to `/hyperblogs/${hyperblogId}`
   - Or find it in the HyperBlog feed

---

## Data Flow Summary

```
User Action
    ↓
HyperBlogCreator Modal Opens
    ↓
User Fills Form (query, length, visibility)
    ↓
User Clicks "Create Blog"
    ↓
Payment Header Created & Signed (usePaymentHeader hook)
    ↓
POST /api/hyperblogs/purchase
    ↓
Next.js API Route Forwards to Delve Backend
    ↓
Delve: Payment Verification → Settlement → Blog Creation
    ↓
Response: PurchaseHyperBlogResponse with initial status
    ↓
If status = "generating": Start Polling (every 5s)
    ↓
GET /api/hyperblogs/[hyperblogId] (polling)
    ↓
Status Updates: "generating" → "completed" | "failed"
    ↓
Polling Stops, UI Updates, Success Callback
    ↓
Blog Available in Feed & Detail Page
```

---

## Key Components & Files

### Frontend Components
- **`HyperBlogCreator.tsx`**: Main creation modal component
- **`DataRoomMarketplaceCard.tsx`**: Entry point from marketplace
- **`DataRoomDetailPage`**: Entry point from detail page
- **`HyperBlogFeed.tsx`**: Displays created blogs
- **`HyperBlogDetail.tsx`**: Full blog view component

### API Routes
- **`/api/hyperblogs/purchase`**: Purchase endpoint (forwards to Delve)
- **`/api/hyperblogs/[hyperblogId]`**: Status polling endpoint

### Hooks
- **`usePaymentHeader.ts`**: Payment header creation & signing

### Types
- **`PurchaseHyperBlogRequest`**: Request payload
- **`PurchaseHyperBlogResponse`**: Response payload
- **`HyperBlogInfo`**: Blog data structure

---

## Error Handling

### Payment Errors
- User cancels signing → `paymentHeader` is null → Error shown
- Payment verification fails → Backend returns 402 → Error shown
- Network errors → 503 status → Error shown

### Generation Errors
- Status = "failed" → Polling stops, error message shown
- Polling errors → Retries on next interval (doesn't stop)
- Timeout errors → 503 status → Error shown

### Validation Errors
- Query too short/long → Button disabled, validation message
- Wallet not connected → ConnectButton shown
- DataRoom inactive → Button disabled with tooltip

---

## User Experience Flow

1. **Discovery**: User browses DataRooms on `/data-rooms` or home page
2. **Selection**: User clicks "Create Blog" on a DataRoom card
3. **Form**: Modal opens, user enters blog topic and preferences
4. **Payment**: User signs payment transaction in wallet
5. **Submission**: "Creating blog..." notification appears
6. **Processing**: Status shows "Generating..." with spinner
7. **Polling**: Status updates every 5 seconds (user can close modal)
8. **Completion**: Success notification, word count and preview shown
9. **Viewing**: User can view blog in feed or detail page

---

## Technical Notes

- **Async Generation**: Blog generation happens server-side, frontend polls for status
- **Payment Verification**: Handled by Delve backend via x402 protocol
- **Polling Interval**: 5 seconds (configurable in `startPolling`)
- **Timeout**: Uses `AbortSignal.timeout(config.delve.timeout)`
- **State Management**: Local component state with React hooks
- **Cleanup**: Polling intervals cleared on unmount and modal close

