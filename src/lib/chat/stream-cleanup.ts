export function clearRequestBookkeeping(
  requestId: string,
  requestIdToMessageId: Record<string, string>,
  requestIdToConversationId: Record<string, string>,
  pendingStreams: number,
): number {
  delete requestIdToMessageId[requestId];
  delete requestIdToConversationId[requestId];
  return Math.max(0, pendingStreams - 1);
}
