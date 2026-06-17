import { useState, useEffect } from "react";

const SLASH_REGEX = /(?:^|\s)\/(\w*)$/;

export function useSlashCommand(draft: string) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

  useEffect(() => {
    const match = draft.match(SLASH_REGEX);
    if (match) {
      setShowSlashMenu(true);
      setSlashQuery(match[1] ?? "");
    } else {
      setShowSlashMenu(false);
      setSlashQuery("");
    }
  }, [draft]);

  const closeSlashMenu = () => setShowSlashMenu(false);

  return { showSlashMenu, slashQuery, closeSlashMenu };
}
