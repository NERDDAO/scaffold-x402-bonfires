# DataRoom Price Format Fix

## Problem

When creating a DataRoom with a price of 5 USDC and attempting to subscribe, the frontend was sending `expected_amount: "5000000"` (smallest units) instead of `expected_amount: "5.00"` (decimal USD format).

### Root Cause

The frontend had two issues:

1. **Wrong value source**: Components were using `config.payment.amount` (a hardcoded default from `.env`) instead of the actual DataRoom's `price_usd` field.

2. **Format confusion**: The backend's `expected_amount` parameter expects **decimal USD format** (e.g., "5.00"), NOT smallest units format (e.g., "5000000").

## Technical Context

### Payment Flow Architecture

1. **Payment Signature** (blockchain side):
   - Uses `buildAndSignPaymentHeader(amount)` 
   - Internally converts decimal → smallest units via `parseTokenAmount()`
   - Example: "5.00" → "5000000" (for USDC with 6 decimals)
   - This is CORRECT and should remain unchanged

2. **Payment Verification** (backend API side):
   - Uses `expected_amount` parameter in request body
   - Backend expects decimal USD format: "5.00", "0.01", etc.
   - Backend validates this format and rejects smallest units (see `_validate_decimal_amount()`)

## Files Fixed

### 1. `components/DataRoomMarketplaceCard.tsx`

**Before:**
```typescript
const paymentHeader = await buildAndSignPaymentHeader();

const requestBody: any = {
  dataroom_id: dataroom.id,
  payment_header: paymentHeader,
  expected_amount: config.payment.amount,  // ❌ Wrong: uses default, not dataroom price
};
```

**After:**
```typescript
const priceDecimal = dataroom.price_usd.toFixed(2);

const paymentHeader = await buildAndSignPaymentHeader(priceDecimal);

const requestBody: any = {
  dataroom_id: dataroom.id,
  payment_header: paymentHeader,
  expected_amount: priceDecimal,  // ✅ Correct: uses actual dataroom price
};
```

### 2. `app/chat/[dataroomId]/page.tsx`

**Before:**
```typescript
const paymentHeader = await buildAndSignPaymentHeader();

const requestBody: any = {
  payment_header: paymentHeader,
  dataroom_id: params.dataroomId,
  expected_amount: config.payment.amount,  // ❌ Wrong: uses default, not dataroom price
};
```

**After:**
```typescript
const priceDecimal = dataRoom.price_usd.toFixed(2);

const paymentHeader = await buildAndSignPaymentHeader(priceDecimal);

const requestBody: any = {
  payment_header: paymentHeader,
  dataroom_id: params.dataroomId,
  expected_amount: priceDecimal,  // ✅ Correct: uses actual dataroom price
};
```

## Backend Validation

The backend's `PaymentController._validate_decimal_amount()` now correctly:
- Accepts decimal format: "0.01", "5.00", "100.50" ✅
- Rejects smallest units: "5000000", "100000000" ❌
- Returns helpful error messages explaining the format

Example validation logic (already implemented):
```python
if '.' not in amount and amount.isdigit():
    amount_int = int(amount)
    if amount_int > 1000:
        raise HTTPException(
            status_code=400,
            detail=(
                f"{name} appears to be in smallest units format ({amount}). "
                f"Please provide amount in decimal USD format (e.g., '5.00' not '5000000')"
            )
        )
```

## Testing Checklist

- [x] DataRoom subscription from marketplace page uses correct price
- [x] DataRoom subscription from chat page uses correct price
- [x] HyperBlog purchase already correctly uses `priceUsd.toFixed(2)` (no changes needed)
- [x] Payment signature still converts to smallest units for blockchain
- [x] Backend validation accepts decimal format
- [x] Backend validation rejects smallest units with helpful error

## Related Files (No Changes Needed)

These files already handle the format correctly:

- `components/HyperBlogCreator.tsx` - Already uses `priceUsd.toFixed(2)` ✅
- `lib/payment/build-payment-header.ts` - Correctly converts decimal → smallest units for signature ✅
- `src/core/controllers/payment_controller.py` - Already has validation logic ✅

## Example: Correct Flow

1. User clicks "Subscribe" on a DataRoom with `price_usd: 5.00`
2. Frontend extracts: `const priceDecimal = dataroom.price_usd.toFixed(2);` → `"5.00"`
3. Frontend builds payment header: `buildAndSignPaymentHeader("5.00")`
   - Internally converts to smallest units: `"5000000"` for signature
4. Frontend sends request body:
   ```json
   {
     "payment_header": "base64EncodedPaymentHeader...",
     "dataroom_id": "673e...",
     "expected_amount": "5.00"
   }
   ```
5. Backend validates `expected_amount: "5.00"` ✅
6. Backend verifies payment signature (which contains `"5000000"` for blockchain)
7. Both sides agree on the amount, payment succeeds ✅

## Summary

The fix ensures that:
1. The **payment signature** uses smallest units (for blockchain) ✅
2. The **API request** uses decimal USD format (for backend validation) ✅
3. The **actual DataRoom price** is used (not a hardcoded default) ✅

This resolves the issue where creating a 5 USDC DataRoom and trying to subscribe would send "5000000" instead of "5.00" to the backend, causing payment verification to fail.

