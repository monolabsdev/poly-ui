import { describe, expect, it } from "vitest";
import { filesFromTransfer } from "../src/features/chat/hooks/useFileDragDetection";

const emptyFileList = {
  length: 0,
  item: () => null,
  [Symbol.iterator]: function* () {},
} as FileList;

describe("file drag detection", () => {
  it("extracts dropped Linux files exposed through DataTransfer items", () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const transfer = {
      files: emptyFileList,
      items: [{ kind: "file", getAsFile: () => file }],
    } as unknown as DataTransfer;

    expect(filesFromTransfer(transfer)).toEqual([file]);
  });

  it("falls back to an empty list when no files or items are present", () => {
    const transfer = { files: emptyFileList, items: [] } as unknown as DataTransfer;
    expect(filesFromTransfer(transfer)).toEqual([]);
  });
});
