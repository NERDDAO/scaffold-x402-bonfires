/**
 * Payment-gated episode update API route
 * Forwards requests to delve's /paid/knowledge_graph/episode_update endpoint
 * 
 * Delve backend handles all payment verification, settlement, and microsub management.
 * This route acts as a simple proxy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createErrorFromResponse } from '@/lib/types/errors';
import type { PaidEpisodeUpdateRequest, EpisodeUpdateResponseWithPayment } from '@/lib/types/delve-api';

/**
 * POST /api/knowledge_graph/episode_update
 * 
 * Forwards payment-gated episode update requests to delve backend
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate required fields
    const errors: string[] = [];

    if (!body.bonfire_id || typeof body.bonfire_id !== 'string') {
      errors.push('bonfire_id is required and must be a string');
    }

    if (!body.agent_id || typeof body.agent_id !== 'string') {
      errors.push('agent_id is required and must be a string');
    }

    if (!body.episode || typeof body.episode !== 'object') {
      errors.push('episode is required and must be an object');
    } else {
      // Validate episode fields
      if (!body.episode.summary || typeof body.episode.summary !== 'string') {
        errors.push('episode.summary is required and must be a string');
      }

      if (!body.episode.content || typeof body.episode.content !== 'string') {
        errors.push('episode.content is required and must be a string');
      }

      if (!body.episode.window_start || typeof body.episode.window_start !== 'string') {
        errors.push('episode.window_start is required and must be an ISO timestamp string');
      }

      if (!body.episode.window_end || typeof body.episode.window_end !== 'string') {
        errors.push('episode.window_end is required and must be an ISO timestamp string');
      }

      // Validate timestamp format (basic check)
      if (body.episode.window_start) {
        const startDate = new Date(body.episode.window_start);
        if (isNaN(startDate.getTime())) {
          errors.push('episode.window_start must be a valid ISO timestamp');
        }
      }

      if (body.episode.window_end) {
        const endDate = new Date(body.episode.window_end);
        if (isNaN(endDate.getTime())) {
          errors.push('episode.window_end must be a valid ISO timestamp');
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Construct paid episode update request
    const paidRequest: PaidEpisodeUpdateRequest = {
      bonfire_id: body.bonfire_id,
      agent_id: body.agent_id,
      episode: body.episode,
      payment_header: body.payment_header,
      expected_amount: body.expected_amount || config.payment.amount,
      query_limit: body.query_limit || config.payment.queryLimit,
      expiration_days: body.expiration_days || config.payment.expirationDays,
    };

    // Forward to delve backend
    const delveUrl = `${config.delve.apiUrl}/paid/knowledge_graph/episode_update`;
    
    console.log(`Forwarding episode update request to: ${delveUrl}`);

    const delveResponse = await fetch(delveUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paidRequest),
      signal: AbortSignal.timeout(config.delve.timeout),
    });

    // Handle non-OK responses
    if (!delveResponse.ok) {
      const error = await createErrorFromResponse(delveResponse);
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.statusCode }
      );
    }

    // Parse and return successful response
    const responseData: EpisodeUpdateResponseWithPayment = await delveResponse.json();
    
    console.log('Episode update successful:', {
      bonfire_id: body.bonfire_id,
      agent_id: body.agent_id,
      episode_uuid: responseData.episode_uuid,
      payment_verified: responseData.payment?.verified,
      payment_settled: responseData.payment?.settled,
      microsub_active: responseData.payment?.microsub_active,
      queries_remaining: responseData.payment?.queries_remaining,
    });

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error in episode update API route:', error);

    // Handle timeout errors
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Request timeout. Delve backend did not respond in time.' },
        { status: 503 }
      );
    }

    // Handle network errors
    if (error instanceof Error && error.message.includes('fetch')) {
      return NextResponse.json(
        { error: 'Failed to connect to Delve backend. Please check the backend is running.' },
        { status: 503 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * OPTIONS /api/knowledge_graph/episode_update
 * 
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-payment',
    },
  });
}

