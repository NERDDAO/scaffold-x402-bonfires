/**
 * Error types and utilities for API error handling
 */

export interface ApiError {
  message: string;
  details?: any;
  statusCode: number;
}

/**
 * Creates a standardized error object from a failed Response
 * @param response - The failed fetch Response object
 * @returns A Promise resolving to an ApiError with message, details, and statusCode
 */
export async function createErrorFromResponse(response: Response): Promise<ApiError> {
  let message = `Request failed with status ${response.status}`;
  let details: any = undefined;

  try {
    const errorData = await response.json();
    if (errorData.error) {
      message = typeof errorData.error === "string" ? errorData.error : JSON.stringify(errorData.error);
    } else if (errorData.message) {
      message = errorData.message;
    }

    if (errorData.details) {
      details = errorData.details;
    }
  } catch {
    // If response body is not JSON, try to get text
    try {
      const text = await response.text();
      if (text) {
        message = text.substring(0, 200); // Limit error message length
      }
    } catch {
      // If we can't parse the response at all, use the status text
      message = response.statusText || message;
    }
  }

  return {
    message,
    details,
    statusCode: response.status,
  };
}
