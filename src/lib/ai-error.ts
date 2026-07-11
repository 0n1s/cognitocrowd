export const AI_TEMPORARILY_UNAVAILABLE_MESSAGE = 'AI service is temporarily unavailable. Please try again shortly.';

export function isAiEndpointErrorMessage(message: string) {
  return [
    /\b(?:400|401|403|404|408|429|500|502|503|504)\b/i,
    /request was blocked/i,
    /temporarily unavailable/i,
    /provider/i,
    /model .* unavailable/i,
    /endpoint/i,
    /openai-compatible/i,
    /generation failed/i,
    /failed to generate/i,
    /did not return/i,
    /timed out/i,
    /timeout/i,
    /network/i,
    /fetch/i,
    /quota/i,
    /rate limit/i,
    /ECONN/i,
  ].some((pattern) => pattern.test(message));
}

export function getAiUserFacingError(message: string) {
  return isAiEndpointErrorMessage(message) ? AI_TEMPORARILY_UNAVAILABLE_MESSAGE : message;
}
