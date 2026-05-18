interface ApiErrorPayload {
  error?: unknown;
  message?: unknown;
}

interface ApiErrorShape {
  response?: {
    data?: ApiErrorPayload | string;
  };
  message?: unknown;
}

export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  const typedError = error as ApiErrorShape | null | undefined;

  const responseData = typedError?.response?.data;
  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.error === 'string' && responseData.error.trim()) {
      return responseData.error;
    }
    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message;
    }
  }

  if (typeof typedError?.message === 'string' && typedError.message.trim()) {
    return typedError.message;
  }

  return fallbackMessage;
}
