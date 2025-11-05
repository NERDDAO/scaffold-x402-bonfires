/**
 * Payment-gated delve search API route
 * Forwards requests to delve's /paid/delve endpoint
 * 
 * Delve backend handles all payment verification, settlement, and microsub management.
 * This route acts as a simple proxy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { createErrorFromResponse } from '@/lib/types/errors';
import type { PaidDelveRequest, DelveResponseWithPayment } from '@/lib/types/delve-api';

/**
 * POST /api/agents/[agent_id]/delve
 * 
 * Forwards payment-gated delve search requests to delve backend
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agent_id: string }> }
) {
  try {
    // Extract agent_id from route params
    const { agent_id } = await params;

    if (!agent_id || typeof agent_id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid agent_id parameter' },
        { status: 400 }
      );
    }

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
    if (!body.query || typeof body.query !== 'string' || body.query.trim() === '') {
      return NextResponse.json(
        { error: 'Missing or empty required field: query' },
        { status: 400 }
      );
    }

    // Construct paid delve request
    const paidRequest: PaidDelveRequest = {
      ...body,
      agent_config_id: agent_id,  // Auto-populate from route param
      payment_header: body.payment_header,
      expected_amount: body.expected_amount || config.payment.amount,
      query_limit: body.query_limit || config.payment.queryLimit,
      expiration_days: body.expiration_days || config.payment.expirationDays,
    };

    // Forward to delve backend
    const delveUrl = `${config.delve.apiUrl}/paid/delve`;
    
    console.log(`Forwarding delve search request to: ${delveUrl}`);

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
    const responseData: DelveResponseWithPayment = await delveResponse.json();
    
    console.log('Delve search successful:', {
      agent_id,
      query: body.query,
      payment_verified: responseData.payment?.verified,
      payment_settled: responseData.payment?.settled,
      microsub_active: responseData.payment?.microsub_active,
      queries_remaining: responseData.payment?.queries_remaining,
      entity_count: responseData.metrics?.entity_count,
      episode_count: responseData.metrics?.episode_count,
    });

    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Error in delve API route:', error);

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
 * OPTIONS /api/agents/[agent_id]/delve
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

