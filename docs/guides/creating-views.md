# Creating Custom Views

Custom views let you replace the entire main content area (where chats normally appear)
with your own full-height page — perfect for admin panels, model browsers, settings pages,
or any feature that needs more space than a modal.

## How it works

A view is just a React component registered with the view system:

```
sidear (always visible)   │   main content area
                          │
┌──────────────────────────┤
│ Folders                  │   ┌─────────────────────────┐
│   ├── Project Alpha     │   │                         │
│   └── Research          │   │   Your custom view      │
│ Chats                    │   │   (full height,         │
│   ├── Chat A            │   │    full width)          │
│   ├── Chat B            │   │                         │
│ Profile                  │   │                         │
└──────────────────────────┘   └─────────────────────────┘
```

- The sidebar stays visible
- Chat state is preserved when switching away and back
- Your view gets `flex: 1` in the layout — it fills all available space

## Quickstart

### 1. Create your view component

```tsx
// features/my-feature/MyView.tsx
import { Box, Typography, Button } from "@mui/material";
import { useViewStore } from "@/lib/view-registry";

export function MyView() {
  return (
    <Box sx={{ p: 3, height: "100%", overflow: "auto" }}>
      <Typography variant="h4">My Custom View</Typography>
      <Button onClick={() => useViewStore.getState().setActiveView(null)}>
        Back to chat
      </Button>
    </Box>
  );
}
```

### 2. Register it

Register the view when your feature module loads — for example in a barrel export,
a component file, or wherever makes sense for your feature:

```tsx
// features/my-feature/index.ts
import { registerView } from "@/lib/view-registry";
import { MyView } from "./MyView";

registerView("my-view", MyView);
```

The `registerView` call can go anywhere that runs once. A barrel `index.ts` is
cleanest because it keeps the registration with the feature.

### 3. Wire it to a button

Any button or menu item in the app can activate your view:

```tsx
import { useViewStore } from "@/lib/view-registry";

<Button onClick={() => useViewStore.getState().setActiveView("my-view")}>
  Open My View
</Button>
```

### 4. Done

That's it. The view takes over the content area immediately. No files outside
your feature folder need to change.

## API Reference

### `registerView(id, component)`

Registers a component as a named view.

| Param | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (e.g. `"admin-settings"`) |
| `component` | `React.ComponentType` | Your view component (receives no props) |

Duplicate IDs log a warning and overwrite the previous registration.

### `useViewStore`

Zustand store for controlling which view is active.

```tsx
import { useViewStore } from "@/lib/view-registry";

// Read active view (null = chat mode)
const activeView = useViewStore((s) => s.activeView);

// Activate a view
useViewStore.getState().setActiveView("my-view");

// Go back to chat
useViewStore.getState().setActiveView(null);
```

### `getViewComponent(id)`

Returns the registered component for a view ID, or `undefined`.

### `getRegisteredViews()`

Returns an array of all registered view IDs.

## Tips

- **State preservation**: Chat state (messages, active conversation, folders)
  is untouched when switching views. Switching back restores everything.

- **Your view owns its layout**: The view fills the content area. Add your own
  padding, scrolling, and internal navigation.

- **Back navigation**: Call `setActiveView(null)` to return to chat. You can
  place this on a back button, a logo click, or any interaction.

- **Registration timing**: Register views early — in a barrel `index.ts` or
  a top-level import. Don't register inside a React component (it would
  register on every render).
