import { memo } from "react";
import type { MessageProps } from "./types";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

export type { MessageProps };

export const Message = memo(function Message(props: MessageProps) {
  if (props.role === "user") {
    return <UserMessage {...props} />;
  }
  return <AssistantMessage {...props} />;
});
