import React, { useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Reasoning,
  ReasoningTrigger,
  ReasoningContent,
} from "@/components/ui/reasoning";

export const MemoryDisclosure = React.memo(
  ({ summaries }: { summaries?: string[] }) => {
    const [expanded, setExpanded] = useState(false);

    if (!summaries?.length) return null;

    return (
      <Reasoning open={expanded} onOpenChange={setExpanded} className="my-2">
        <ReasoningTrigger>
          <span className="inline-flex items-center gap-1.5">
            <BookOpen size={14} />
            Memory updated
          </span>
        </ReasoningTrigger>
        <ReasoningContent>
          {summaries.map((summary, index) => (
            <div key={index}>{summary}</div>
          ))}
        </ReasoningContent>
      </Reasoning>
    );
  },
);

MemoryDisclosure.displayName = "MemoryDisclosure";
