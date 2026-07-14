# Responsive viewport drawer

## Problem

The persisted viewport drawer width can exceed the space available beside chat. Because the drawer does not shrink, the main container clips its right side.

## Design

Keep the persisted user width unchanged. Clamp only the rendered drawer width so at least 320px remains for chat. Use native CSS sizing on the existing drawer; add no breakpoint, resize observer, state, or dependency.

Hidden drawers remain zero-width. Existing drag limits and persistence remain unchanged.

## Verification

Build the frontend and verify the drawer width rule preserves 320px for chat when a saved 900px drawer opens in a narrower window.
