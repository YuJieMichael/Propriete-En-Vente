// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorkspaceErrorBoundary } from "../src/workspace-error-boundary";

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

it("shows recovery actions instead of leaving a failed project route blank", async () => {
  function BrokenProject() {
    throw new Error("render failed");
  }

  await act(async () => {
    root.render(<WorkspaceErrorBoundary lang="zh"><BrokenProject /></WorkspaceErrorBoundary>);
  });

  expect(container.textContent).toContain("项目暂时无法打开");
  expect(container.querySelector('a[href="#projects"]')?.textContent).toBe("返回项目列表");
  expect(container.querySelector("button")?.textContent).toBe("重新加载");
});
