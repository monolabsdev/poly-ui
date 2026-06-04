export function getNextQueuedMessage<T extends { conversationId: string }>(
  queue: T[],
  conversationId: string,
): T | undefined {
  return queue.find((message) => message.conversationId === conversationId);
}
