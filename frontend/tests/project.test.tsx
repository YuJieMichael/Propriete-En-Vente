// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type {
  ProjectRow,
  ProjectDraft,
  StoredFile,
} from "../src/lib/project-api";

const mock = vi.hoisted(() => ({
  userId: "alice" as string | null,
  ensure: vi.fn(),
  fetch: vi.fn(),
  save: vi.fn(),
  submit: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../src/auth", () => ({
  useAuth: () => ({ user: mock.userId ? { id: mock.userId } : null }),
}));
vi.mock("../src/lib/project-api", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/project-api")>(
    "../src/lib/project-api",
  );
  return {
    ...actual,
    ensureProject: mock.ensure,
    fetchProject: mock.fetch,
    saveProject: mock.save,
    submitProject: mock.submit,
    listFiles: mock.list,
    uploadFile: mock.upload,
    removeFile: mock.remove,
    downloadFile: mock.download,
  };
});
import { isVisitSlotTaken, ProjectProvider, useProject } from "../src/project";

let root: Root;
let container: HTMLDivElement;
let state: ReturnType<typeof useProject>;
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
it("marks only an already scheduled date and time as occupied", () => {
  const visits = [{ name: "Buyer", date: "2026-10-03", time: "10:30" }];
  expect(isVisitSlotTaken(visits, "2026-10-03", "10:30")).toBe(true);
  expect(isVisitSlotTaken(visits, "2026-10-03", "12:00")).toBe(false);
  expect(isVisitSlotTaken(visits, "2026-10-04", "10:30")).toBe(false);
});
function Probe() {
  state = useProject();
  return null;
}
async function render() {
  await act(async () => {
    root.render(
      <ProjectProvider>
        <Probe />
      </ProjectProvider>,
    );
    await tick();
  });
}
async function flush() {
  await act(async () => {
    await tick();
  });
}
function row(owner = "alice", revision = 0): ProjectRow {
  return {
    id: `project-${owner}`,
    owner_id: owner,
    plan: "without",
    details: { address: `${owner}'s house`, city: "Montréal" },
    services: [],
    completed: false,
    visits: [],
    status: "draft",
    review_note: "",
    revision,
    updated_at: "2026-09-23T00:00:00Z",
  };
}
function saved(current: ProjectRow, draft: ProjectDraft): ProjectRow {
  return {
    ...current,
    plan: draft.plan,
    details: draft.form,
    services: draft.services,
    completed: draft.completed,
    visits: draft.visits,
    revision: current.revision + 1,
  };
}
function media(id = "photo-one"): StoredFile {
  return {
    id,
    project_id: "project-alice",
    owner_id: "alice",
    kind: "photo",
    name: "house.jpg",
    size: 100,
    mime_type: "image/jpeg",
    storage_path: `alice/project-alice/${id}.jpg`,
    url: "https://private.example/photo",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  mock.userId = "alice";
  mock.ensure.mockImplementation(async () => row(mock.userId!));
  mock.fetch.mockImplementation(async () => row(mock.userId!));
  mock.save.mockImplementation(
    async (current: ProjectRow, draft: ProjectDraft) => saved(current, draft),
  );
  mock.submit.mockImplementation(async (current: ProjectRow) => ({
    ...current,
    status: "submitted",
    revision: current.revision + 1,
  }));
  mock.list.mockResolvedValue([]);
  mock.upload.mockResolvedValue(undefined);
  mock.remove.mockResolvedValue(undefined);
  mock.download.mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("seller project persistence boundaries", () => {
  it("discards old-account save responses and queued writes after switching accounts", async () => {
    await render();
    const pending = deferred<ProjectRow>();
    mock.save.mockReturnValueOnce(pending.promise);
    await act(async () =>
      state.setForm((previous) => ({ ...previous, address: "Alice edited" })),
    );
    let first!: Promise<boolean>;
    let queued!: Promise<boolean>;
    await act(async () => {
      first = state.saveNow();
      queued = state.saveNow();
      await tick();
    });
    expect(mock.save).toHaveBeenCalledTimes(1);
    mock.userId = "bob";
    await render();
    expect(state.project?.owner_id).toBe("bob");
    await act(async () => {
      pending.resolve({
        ...row("alice", 1),
        details: { address: "Alice edited" },
      });
      await Promise.all([first, queued]);
    });
    expect(await first).toBe(false);
    expect(await queued).toBe(false);
    expect(mock.save).toHaveBeenCalledTimes(1);
    expect(state.project?.owner_id).toBe("bob");
    expect(state.form.address).toBe("bob's house");
    expect(state.error).toBeNull();
  });

  it("removes the previous account's records immediately on sign-out", async () => {
    mock.list.mockResolvedValue([media()]);
    await render();
    expect(state.photos).toHaveLength(1);
    mock.userId = null;
    await render();
    expect(state.project).toBeNull();
    expect(state.photos).toHaveLength(0);
    expect(state.form.address).toBe("");
    expect(state.loading).toBe(false);
  });

  it("flushes new edits made while an earlier save is in flight before resolving", async () => {
    await render();
    const pending = deferred<ProjectRow>();
    mock.save.mockReturnValueOnce(pending.promise);
    await act(async () =>
      state.setForm((previous) => ({ ...previous, address: "First edit" })),
    );
    let first!: Promise<boolean>;
    await act(async () => {
      first = state.saveNow();
      await tick();
    });
    const firstDraft = mock.save.mock.calls[0][1] as ProjectDraft;
    await act(async () =>
      state.setForm((previous) => ({ ...previous, address: "Second edit" })),
    );
    await act(async () => {
      pending.resolve(saved(row(), firstDraft));
      await first;
    });
    expect(await first).toBe(true);
    expect(state.form.address).toBe("Second edit");
    expect(mock.save.mock.calls[1][0].revision).toBe(1);
    expect(mock.save.mock.calls[1][1].form.address).toBe("Second edit");
    expect(state.saveState).toBe("saved");
  });

  it("refreshes partial uploads and preserves a file error when an already-saved draft is flushed", async () => {
    await render();
    mock.upload
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("connection lost"));
    mock.fetch.mockResolvedValue(row("alice", 1));
    mock.list.mockResolvedValue([media()]);
    let result!: boolean;
    await act(async () => {
      result = await state.addFiles(
        [
          new File(["a"], "one.jpg", { type: "image/jpeg" }),
          new File(["b"], "two.jpg", { type: "image/jpeg" }),
        ],
        "photo",
      );
    });
    expect(result).toBe(false);
    expect(state.project?.revision).toBe(1);
    expect(state.photos).toHaveLength(1);
    expect(state.error).toBe("NETWORK");
    await act(async () => {
      expect(await state.saveNow()).toBe(true);
    });
    expect(state.error).toBe("NETWORK");
    expect(state.saveState).toBe("error");
    await act(async () =>
      state.setForm((previous) => ({ ...previous, name: "Alice" })),
    );
    await act(async () => {
      expect(await state.saveNow()).toBe(true);
    });
    expect(mock.save.mock.calls[0][0].revision).toBe(1);
    expect(state.error).toBeNull();
  });

  it("detects other-tab edits during file refresh instead of silently adopting their revision", async () => {
    await render();
    mock.fetch.mockResolvedValue({
      ...row("alice", 2),
      details: { address: "Changed in another tab", city: "Montréal" },
    });
    await act(async () => {
      expect(
        await state.addFiles(
          [new File(["a"], "one.jpg", { type: "image/jpeg" })],
          "photo",
        ),
      ).toBe(false);
    });
    expect(state.error).toBe("CONFLICT");
    expect(state.project?.revision).toBe(0);
    expect(state.form.address).toBe("alice's house");
    await act(async () =>
      state.setForm((previous) => ({ ...previous, name: "Unsaved name" })),
    );
    await act(async () => {
      expect(await state.saveNow()).toBe(false);
    });
    expect(mock.save).not.toHaveBeenCalled();
  });

  it("accepts the two revision increments produced by storage and metadata deletion", async () => {
    mock.list.mockResolvedValueOnce([media()]);
    await render();
    mock.fetch.mockResolvedValue(row("alice", 2));
    await act(async () => {
      expect(await state.deleteFile(media())).toBe(true);
    });
    expect(state.photos).toHaveLength(0);
    expect(state.project?.revision).toBe(2);
    await act(async () => state.setServices(["photo"]));
    await act(async () => {
      expect(await state.saveNow()).toBe(true);
    });
    expect(mock.save.mock.calls[0][0].revision).toBe(2);
  });

  it("blocks a second mutation in the same event tick", async () => {
    await render();
    const pending = deferred<void>();
    mock.upload.mockReturnValueOnce(pending.promise);
    let uploading!: Promise<boolean>;
    let submitting!: Promise<boolean>;
    await act(async () => {
      uploading = state.addFiles(
        [new File(["a"], "one.jpg", { type: "image/jpeg" })],
        "photo",
      );
      submitting = state.submitForReview();
      await tick();
    });
    expect(await submitting).toBe(false);
    expect(mock.submit).not.toHaveBeenCalled();
    await act(async () => {
      pending.resolve();
      await uploading;
    });
    expect(state.busy).toBe(false);
  });

  it("a reload releases the busy state and invalidates the older mutation", async () => {
    await render();
    const pending = deferred<void>();
    mock.upload.mockReturnValueOnce(pending.promise);
    let uploading!: Promise<boolean>;
    await act(async () => {
      uploading = state.addFiles(
        [new File(["a"], "one.jpg", { type: "image/jpeg" })],
        "photo",
      );
      await tick();
    });
    expect(state.busy).toBe(true);
    await act(async () => {
      await state.reloadProject();
    });
    expect(state.busy).toBe(false);
    await act(async () => {
      pending.resolve();
      expect(await uploading).toBe(false);
    });
    expect(state.error).toBeNull();
    expect(state.project?.owner_id).toBe("alice");
  });

  it("ignores a late file-operation failure after an account change", async () => {
    await render();
    const pending = deferred<void>();
    mock.upload.mockReturnValueOnce(pending.promise);
    let uploading!: Promise<boolean>;
    await act(async () => {
      uploading = state.addFiles(
        [new File(["a"], "one.jpg", { type: "image/jpeg" })],
        "photo",
      );
      await tick();
    });
    mock.userId = "bob";
    await render();
    await act(async () => {
      pending.reject(new Error("old account request failed"));
      expect(await uploading).toBe(false);
    });
    expect(state.project?.owner_id).toBe("bob");
    expect(state.error).toBeNull();
    expect(state.busy).toBe(false);
  });
});

it('does not implicitly create a project on the list page', async () => {
  await act(async()=>{root.render(<ProjectProvider projectId={null}><Probe/></ProjectProvider>);await tick();});
  expect(mock.ensure).not.toHaveBeenCalled();
  expect(state.project).toBeNull();
});
it('loads a selected project and discards a late response after switching', async () => {
  const old=deferred<ProjectRow>();
  mock.fetch.mockImplementation((id:string)=>id==='first'?old.promise:Promise.resolve({...row(),id}));
  await act(async()=>{root.render(<ProjectProvider projectId="first"><Probe/></ProjectProvider>);await tick();});
  await act(async()=>{root.render(<ProjectProvider projectId="second"><Probe/></ProjectProvider>);await tick();});
  await act(async()=>{old.resolve({...row(),id:'first'});await tick();});
  expect(state.project?.id).toBe('second');
  expect(mock.ensure).not.toHaveBeenCalled();
});
it('normalizes missing JSON collections on older project records', async () => {
  mock.fetch.mockResolvedValue({ ...row(), details: null, services: null, visits: null });
  await act(async()=>{root.render(<ProjectProvider projectId="project-alice"><Probe/></ProjectProvider>);await tick();});
  expect(state.project?.details).toEqual({});
  expect(state.services).toEqual([]);
  expect(state.visits).toEqual([]);
  expect(state.error).toBeNull();
});
it('saves dirty edits before leaving a project through hash navigation', async () => {
  history.replaceState(null,'','#projects/project-alice/overview');
  await act(async()=>{root.render(<ProjectProvider projectId="project-alice"><Probe/></ProjectProvider>);await tick();});
  const pending=deferred<ProjectRow>();mock.save.mockReturnValueOnce(pending.promise);
  await act(async()=>state.setForm({...state.form,address:'Unsaved home'}));
  await act(async()=>{const oldURL=location.href;history.replaceState(null,'','#projects');dispatchEvent(new HashChangeEvent('hashchange',{oldURL,newURL:location.href}));await tick();});
  expect(location.hash).toBe('#projects/project-alice/overview');
  expect(mock.save).toHaveBeenCalledOnce();
  await act(async()=>{pending.resolve({...row(),details:{address:'Unsaved home'},revision:1});await tick();});
  expect(location.hash).toBe('#projects');
});
