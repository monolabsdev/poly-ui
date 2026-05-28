import { useState, useEffect } from "react";

/**
 * Detects when the user has typed a slash command trigger in the draft
 * and manages the open/close state of the slash command menu.
 */
export function useSlashCommand(draft: string) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);

  useEffect(() => {
    const isSlashTrigger = draft === "/" || draft.endsWith(" /");
    setShowSlashMenu(isSlashTrigger);
  }, [draft]);

  const closeSlashMenu = () => setShowSlashMenu(false);

  return { showSlashMenu, closeSlashMenu };
}
