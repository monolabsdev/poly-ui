import { useState, type ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Source, SourceContent, SourceTrigger } from "@/components/ui/source";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { ThinkingDisclosure } from "@/features/chat/components/Message/ThinkingDisclosure";
import { WebSearchDisclosure } from "@/features/chat/components/Message/WebSearchDisclosure";
import { EmbeddedWebviewFrame } from "@/features/embedded-webview/EmbeddedWebviewFrame";
import { useNotificationStore } from "@/store/notificationStore";
import type { SearchResultItem } from "@/types/chat";

const WEBVIEW_URL_A = "https://example.com";
const WEBVIEW_URL_B = "https://developer.mozilla.org";

const sampleSources: SearchResultItem[] = [
  {
    title: "Poly UI component notes",
    url: "https://example.com/poly-ui/components",
    highlights: ["Shared components should be checked in the real app shell."],
  },
  {
    title: "Design system changelog",
    url: "https://example.com/poly-ui/changelog",
    highlights: ["Disclosure rows use the same Reasoning indicator as chat."],
  },
];

function GallerySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function ComponentGallery() {
  const [webSearchOpen, setWebSearchOpen] = useState(true);
  const [webviewMounted, setWebviewMounted] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState(WEBVIEW_URL_A);

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-8 py-7">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            Component Gallery
          </h1>
          <p className="text-sm text-muted-foreground">
            Dev-only samples for the shared UI components.
          </p>
        </header>

        <GallerySection title="Buttons">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </GallerySection>

        <GallerySection title="Badges">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </GallerySection>

        <GallerySection title="Fields">
          <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-input">Input</Label>
              <Input id="gallery-input" placeholder="Placeholder" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-textarea">Textarea</Label>
              <Textarea id="gallery-textarea" placeholder="Write something" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox defaultChecked />
              Checked option
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch defaultChecked />
              Enabled setting
            </label>
          </div>
        </GallerySection>

        <GallerySection title="Motion and citations">
          <div className="grid w-full gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Text shimmer</CardTitle>
                <CardDescription>Used by streaming status rows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <TextShimmer as="p" className="text-sm" duration={2} spread={12}>
                  Searching project context...
                </TextShimmer>
                <TextShimmer as="p" className="text-base" duration={1.6} spread={10}>
                  Thinking through the next step
                </TextShimmer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sources</CardTitle>
                <CardDescription>Hover the source badges for previews.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Source href="https://example.com/poly-ui/components">
                  <SourceTrigger label={1} showFavicon className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs" />
                  <SourceContent
                    title="Poly UI component notes"
                    description="A compact citation preview for component references."
                  />
                </Source>
                <Source href="https://example.com/poly-ui/changelog">
                  <SourceTrigger label="Changelog" showFavicon className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-xs" />
                  <SourceContent
                    title="Design system changelog"
                    description="Recent component polish and disclosure behavior."
                  />
                </Source>
              </CardContent>
            </Card>
          </div>
        </GallerySection>

        <GallerySection title="Disclosures">
          <div className="grid w-full gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Thinking disclosure</CardTitle>
                <CardDescription>Shows the shared disclosure indicator.</CardDescription>
              </CardHeader>
              <CardContent>
                <ThinkingDisclosure
                  isThinking={false}
                  thinkingDuration={7}
                  processedThinking="Checked the available components, reused the chat disclosure, and kept the sample static."
                  status="complete"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Web search disclosure</CardTitle>
                <CardDescription>Expanded source results with the same trigger.</CardDescription>
              </CardHeader>
              <CardContent>
                <WebSearchDisclosure
                  isSearching={false}
                  query="component gallery samples"
                  results={sampleSources}
                  isExpanded={webSearchOpen}
                  onToggle={() => setWebSearchOpen((open) => !open)}
                />
              </CardContent>
            </Card>
          </div>
        </GallerySection>

        <GallerySection title="Surfaces">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Supporting description text.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Body copy inside the card content area.
              </p>
            </CardContent>
          </Card>
          <Alert className="max-w-md">
            <AlertTitle>Alert title</AlertTitle>
            <AlertDescription>Useful status text for a dev sample.</AlertDescription>
          </Alert>
        </GallerySection>

        <GallerySection title="Loading">
          <div className="w-full max-w-sm space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Separator />
            <Skeleton className="h-20 w-full" />
          </div>
        </GallerySection>

        <GallerySection title="Embedded webview">
          <div className="w-full space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="gallery-webview"
                  checked={webviewMounted}
                  onCheckedChange={setWebviewMounted}
                />
                <Label htmlFor="gallery-webview">Mount webview</Label>
              </div>
              <Button
                variant="secondary"
                disabled={!webviewMounted}
                onClick={() => setWebviewUrl((url) => (url === WEBVIEW_URL_A ? WEBVIEW_URL_B : WEBVIEW_URL_A))}
              >
                Navigate
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Dialog over page</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogTitle>Airspace check</DialogTitle>
                  <DialogDescription>
                    The page below should be a snapshot while this is open, and restore without a flash on close.
                  </DialogDescription>
                </DialogContent>
              </Dialog>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary">Popover over page</Button>
                </PopoverTrigger>
                <PopoverContent>Open and close this rapidly to exercise the race token.</PopoverContent>
              </Popover>
              <Button
                variant="secondary"
                onClick={() =>
                  useNotificationStore.getState().actions.add({
                    type: "info",
                    message: "Toast over the page",
                    description: "The webview hides until the toast expires.",
                  })
                }
              >
                Fire toast
              </Button>
            </div>
            {webviewMounted ? (
              <EmbeddedWebviewFrame
                label="gallery-demo"
                url={webviewUrl}
                className="h-80 w-full rounded-lg border border-border"
              />
            ) : null}
            <p className="text-xs text-muted-foreground">
              Also try: ⌘K over the page, sidebar collapse, window resize, and moving the window between monitors.
            </p>
          </div>
        </GallerySection>
      </div>
    </div>
  );
}
