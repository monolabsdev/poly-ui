import * as React from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { ExternalLink, FileText, Globe } from "lucide-react";
import { getRepository } from "@/lib/repositories";
import { useChatStore } from "@/store/chatStore";
import { useFolderStore } from "@/store/folderStore";
import type { Folder, SearchResultItem } from "@/types/chat";

type FolderSourcesProps = {
  folder: Folder;
};

type ContextSource = {
  id: string;
  name: string;
  size: number;
  folderName: string;
};

type WebSource = SearchResultItem & {
  count: number;
  folderNames: Set<string>;
};

function FolderChip({ name }: { name: string }) {
  return (
    <Box
      component="span"
      sx={{ px: 0.75, py: 0.25, borderRadius: "10px", bgcolor: "action.selected", color: "text.secondary", fontSize: "11px" }}
    >
      {name}
    </Box>
  );
}

export function FolderSources({ folder }: FolderSourcesProps) {
  const folders = useFolderStore((state) => state.folders);
  const conversations = useChatStore((state) => state.conversations);
  const [webSources, setWebSources] = React.useState<WebSource[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const scopedFolders = React.useMemo(() => {
    const ids = new Set([folder.id]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((candidate) => {
        if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
          ids.add(candidate.id);
          changed = true;
        }
      });
    }
    return folders.filter((candidate) => ids.has(candidate.id));
  }, [folder.id, folders]);

  const contextSources = React.useMemo<ContextSource[]>(
    () => scopedFolders.flatMap((candidate) =>
      (candidate.contextFiles ?? []).map((file) => ({
        id: `${candidate.id}-${file.id}`,
        name: file.name,
        size: file.size,
        folderName: candidate.name,
      }))),
    [scopedFolders],
  );

  React.useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      setIsLoading(true);
      setError(null);
      try {
        const repo = await getRepository();
        const folderNames = new Map(scopedFolders.map((candidate) => [candidate.id, candidate.name]));
        const chats = conversations.filter((conversation) => conversation.folderId && folderNames.has(conversation.folderId));
        const chatFolderNames = new Map(chats.map((chat) => [chat.id, folderNames.get(chat.folderId ?? "")]));
        const messages = (await Promise.all(chats.map((chat) => repo.getMessages(chat.id, 99999, 0)))).flat();
        const byUrl = new Map<string, WebSource>();

        messages.forEach((message) => {
          const folderName = chatFolderNames.get(message.conversationId);
          if (!folderName) return;
          message.webSearch?.results?.forEach((result) => {
            const existing = byUrl.get(result.url);
            if (existing) {
              existing.count += 1;
              existing.folderNames.add(folderName);
              if (!existing.highlights?.length && result.highlights?.length) existing.highlights = result.highlights;
            } else {
              byUrl.set(result.url, { ...result, count: 1, folderNames: new Set([folderName]) });
            }
          });
        });

        if (!cancelled) setWebSources([...byUrl.values()]);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadSources();
    return () => { cancelled = true; };
  }, [conversations, scopedFolders]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Box>
        <Typography sx={{ mb: 1.25, fontSize: "13px", fontWeight: 600 }}>Folder context</Typography>
        {scopedFolders.filter((candidate) => candidate.systemPrompt?.trim()).map((candidate) => (
          <Box key={`${candidate.id}-prompt`} sx={{ mb: 1.5, px: 1.25, py: 1, borderRadius: "8px", bgcolor: "action.hover" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
              <Typography sx={{ flex: 1, fontSize: "12px", fontWeight: 600 }}>System prompt</Typography>
              <FolderChip name={candidate.name} />
            </Box>
            <Typography sx={{ fontSize: "12px", lineHeight: 1.5, color: "text.secondary", whiteSpace: "pre-wrap" }}>{candidate.systemPrompt}</Typography>
          </Box>
        ))}
        {contextSources.length === 0 ? (
          scopedFolders.some((candidate) => candidate.systemPrompt?.trim()) ? null : (
            <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>No folder context added.</Typography>
          )
        ) : contextSources.map((source) => (
          <Box key={source.id} sx={{ display: "flex", alignItems: "center", gap: 1, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <FileText size={15} />
            <Typography sx={{ flex: 1, minWidth: 0, fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source.name}</Typography>
            <FolderChip name={source.folderName} />
            <Typography sx={{ fontSize: "11px", color: "text.secondary" }}>{Math.ceil(source.size / 1024)} KB</Typography>
          </Box>
        ))}
      </Box>

      <Box>
        <Typography sx={{ mb: 1.25, fontSize: "13px", fontWeight: 600 }}>Web sources</Typography>
        {isLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
            <CircularProgress size={14} /><Typography sx={{ fontSize: "12px" }}>Loading sources...</Typography>
          </Box>
        ) : error ? (
          <Typography role="alert" sx={{ fontSize: "12px", color: "error.main" }}>Failed to load sources: {error}</Typography>
        ) : webSources.length === 0 ? (
          <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>No web sources used yet.</Typography>
        ) : webSources.map((source) => (
          <Box key={source.url} sx={{ py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Globe size={14} />
              <Link href={source.url} target="_blank" rel="noopener noreferrer" underline="hover" sx={{ flex: 1, minWidth: 0, fontSize: "13px", fontWeight: 600 }}>
                {source.title || source.url} <ExternalLink size={11} />
              </Link>
              {source.count > 1 ? <Typography sx={{ fontSize: "11px", color: "text.secondary" }}>{source.count} uses</Typography> : null}
            </Box>
            {source.highlights?.[0] ? <Typography sx={{ mt: 0.5, fontSize: "12px", lineHeight: 1.5, color: "text.secondary" }}>{source.highlights[0]}</Typography> : null}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
              {[...source.folderNames].map((name) => <FolderChip key={name} name={name} />)}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
