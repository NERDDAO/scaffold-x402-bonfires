# Agent Selector Implementation

## Overview

Implemented a bonfire and agent selection system modeled after the graph-viz-webapp pattern. This provides users with dropdowns to select bonfires and agents dynamically from the backend API.

## Implementation

### 1. Types (`lib/types/delve-api.ts`)

Added TypeScript interfaces for:
- `BonfireInfo`: Bonfire metadata including id, name, taxonomy labels, and groups
- `AgentInfo`: Agent metadata including id, username, name, active status, and bonfire association
- `BonfireListResponse`: Response format for listing bonfires
- `BonfireAgentsResponse`: Response format for listing agents per bonfire
- `AgentSelectionState`: Combined state object for component rendering

### 2. Hook (`hooks/useAgentSelection.ts`)

Created a custom React hook that:
- Fetches available bonfires from `/bonfires` endpoint on mount
- Fetches agents for selected bonfire from `/bonfires/{id}/agents` endpoint
- Manages selection state for both bonfires and agents
- Supports initial values from URL params
- Handles loading and error states separately for bonfires and agents
- Provides callbacks for changing selections
- Returns a complete selection state object for component consumption

**Key Features:**
- Automatic cascading: Selecting a bonfire fetches its agents
- URL param initialization: Can pre-select bonfire/agent from URL
- Loading states: Separate loading indicators for each dropdown
- Error handling: Graceful error messages for each API call
- Cleanup: Proper cleanup of async operations on unmount

### 3. Component (`components/AgentSelector.tsx`)

Created a reusable UI component that:
- Renders two cascading dropdowns (Bonfire → Agent)
- Displays loading skeletons during API calls
- Shows error alerts when API calls fail
- Provides clear buttons to reset selections
- Disables agent dropdown until bonfire is selected
- Uses DaisyUI styling for consistency

**UI States:**
- Loading: Skeleton loaders
- Error: Alert messages with error details
- Empty: Placeholder text guiding user selection
- Selected: Shows selected value with clear button

### 4. Page Integration

Updated both main pages to use the selector:

#### x402-chat page
- Added agent selector card before chat interface
- Shows info alert when no agent is selected
- Only renders chat interface when agent is selected
- Supports URL params for direct linking (`?bonfire=X&agent=Y`)

#### x402-delve page
- Added agent selector card before delve interface
- Shows info alert when no agent is selected
- Only renders delve interface when agent is selected
- Supports URL params for direct linking (`?bonfire=X&agent=Y`)

## API Endpoints Used

The implementation uses Next.js API routes as proxies to avoid CORS issues with direct backend calls.

### GET /api/bonfires
Next.js API route that proxies to Delve backend `/bonfires` endpoint.

**Response:**
```typescript
{
  bonfires: BonfireInfo[]
}
```

**Backend endpoint:** `GET /bonfires`

### GET /api/bonfires/{bonfire_id}/agents
Next.js API route that proxies to Delve backend `/bonfires/{bonfire_id}/agents` endpoint.

**Response:**
```typescript
{
  bonfire_id: string;
  agents: AgentInfo[];
  total_agents: number;
  active_agents: number;
}
```

**Backend endpoint:** `GET /bonfires/{bonfire_id}/agents`

### Why API Routes?

Using Next.js API routes as proxies instead of direct backend calls:
- ✅ Avoids CORS issues (same-origin requests)
- ✅ Consistent with existing pattern (chat/delve routes)
- ✅ Allows middleware/auth at Next.js layer
- ✅ Better error handling and transformation
- ✅ Timeout management with AbortSignal

## Usage Example

```typescript
// In a page component
import { useAgentSelection } from "@/hooks/useAgentSelection";
import { AgentSelector } from "@/components/AgentSelector";

export default function MyPage() {
  const agentSelection = useAgentSelection({
    initialBonfireId: urlBonfireId,
    initialAgentId: urlAgentId,
  });

  const agentId = agentSelection.selectedAgentId || "fallback-id";

  return (
    <div>
      <AgentSelector
        state={agentSelection.selectionState}
        onBonfireChange={agentSelection.selectBonfire}
        onAgentChange={agentSelection.selectAgent}
      />
      
      {agentSelection.selectedAgent ? (
        <MyFeature agentId={agentId} />
      ) : (
        <div>Please select an agent</div>
      )}
    </div>
  );
}
```

## Benefits

1. **User Experience**: Clear visual hierarchy guiding users to select bonfire first, then agent
2. **Type Safety**: Full TypeScript support with proper interfaces
3. **Error Handling**: Graceful degradation with informative error messages
4. **Performance**: Separate loading states prevent blocking the entire UI
5. **Reusability**: Hook and component can be used across multiple pages
6. **URL Support**: Direct linking to specific bonfire/agent combinations
7. **Consistency**: Matches the pattern used in graph-viz-webapp

## Pattern Source

This implementation follows the pattern established in:
- `submodules/graph-viz-webapp/src/hooks/useAgentSelection.ts`
- `submodules/graph-viz-webapp/src/components/AgentSelector.tsx`

Adapted for Next.js App Router and DaisyUI styling conventions.

## Troubleshooting

### "Failed to fetch" error even with 200 response

**Problem:** Direct calls to Delve backend from browser cause CORS errors.

**Solution:** Use Next.js API routes (`/api/bonfires` and `/api/bonfires/[id]/agents`) which proxy to the backend. These routes are already implemented.

**Check:**
1. Ensure Next.js dev server is running: `yarn start` or `npm run dev`
2. API routes should be accessible at `http://localhost:3000/api/bonfires`
3. Check browser console for actual error messages
4. Verify `NEXT_PUBLIC_DELVE_API_URL` is set in `.env.local`

### Empty dropdowns or loading forever

**Problem:** Backend not returning data or not running.

**Solution:**
1. Ensure Delve backend is running: `python src/server.py`
2. Verify backend is accessible at the configured URL
3. Check backend logs for errors
4. Test endpoints directly: `curl http://localhost:8000/bonfires`

### Agent dropdown not populating

**Problem:** Bonfire selected but agents don't load.

**Solution:**
1. Check that the bonfire has registered agents in the database
2. Verify `/bonfires/{id}/agents` endpoint returns data
3. Check browser network tab for API call errors

