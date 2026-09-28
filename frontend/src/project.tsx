import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Language } from "./seller-copy";
import { useAuth } from "./auth";
import { SerialQueue } from "./lib/serial-queue";
import {
  ensureProject,
  fetchProject,
  saveProject,
  submitProject,
  listFiles,
  uploadFile,
  removeFile,
  downloadFile,
  errorCode,
  type ProjectDraft,
  type ProjectRow,
  type StoredFile,
} from "./lib/project-api";

export type Plan = "with" | "without";
export type Details = {
  address: string;
  city: string;
  postal: string;
  type: string;
  price: string;
  broker: string;
  timeline: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  language: Language;
  notes: string;
  consent: boolean;
};
export type Photo = StoredFile;
export type Document = StoredFile;
export type Visit = { date: string; time: string; name: string };
export const isVisitSlotTaken = (visits: Visit[], date: string, time: string) =>
  visits.some((visit) => visit.date === date && visit.time === time);
export type Buyer = {
  name: string;
  initials: string;
  source: string;
  status: number;
};
const initialDetails = (): Details => ({
  address: "",
  city: "",
  postal: "",
  type: "0",
  price: "",
  broker: "0",
  timeline: "0",
  name: "",
  email: "",
  phone: "",
  date: "",
  time: "0",
  language: "fr",
  notes: "",
  consent: false,
});
const initialDraft = (): ProjectDraft => ({
  plan: "without",
  form: initialDetails(),
  services: [],
  completed: false,
  visits: [],
});
export type SaveState = "loading" | "saved" | "dirty" | "saving" | "error";
type Project = ProjectDraft & {
  setPlan: Dispatch<SetStateAction<Plan>>;
  setForm: Dispatch<SetStateAction<Details>>;
  setServices: Dispatch<SetStateAction<string[]>>;
  setCompleted: Dispatch<SetStateAction<boolean>>;
  setVisits: Dispatch<SetStateAction<Visit[]>>;
  sample: boolean;
  setSample: Dispatch<SetStateAction<boolean>>;
  buyers: Buyer[];
  setBuyers: Dispatch<SetStateAction<Buyer[]>>;
  photos: Photo[];
  docs: Document[];
  isDemo: boolean;
  loading: boolean;
  saveState: SaveState;
  error: string | null;
  project: ProjectRow | null;
  busy: boolean;
  saveNow: () => Promise<boolean>;
  reloadProject: () => Promise<void>;
  completeProject: () => Promise<boolean>;
  submitForReview: () => Promise<boolean>;
  addFiles: (files: File[], kind: "photo" | "document") => Promise<boolean>;
  deleteFile: (file: StoredFile) => Promise<boolean>;
  downloadDocument: (file: StoredFile) => Promise<boolean>;
};
const ProjectContext = createContext<Project | null>(null);
type RequestScope = { generation: number; identity: string };

// File triggers may change revision/status, but never these seller-owned values.
// A different payload means another tab changed the project; adopting only its
// revision would allow the stale local draft to overwrite that remote edit.
function sameContent(left: ProjectRow, right: ProjectRow) {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  const content = (row: ProjectRow) => ({
    plan: row.plan,
    details: row.details,
    services: row.services,
    completed: row.completed,
    visits: row.visits,
  });
  return (
    JSON.stringify(canonical(content(left))) ===
    JSON.stringify(canonical(content(right)))
  );
}

export function ProjectProvider({
  children,
  mode = "cloud",
  projectId,
}: {
  children: ReactNode;
  mode?: "cloud" | "demo";
  projectId?: string | null;
}) {
  const { user } = useAuth();
  const isDemo = mode === "demo";
  const identity = `${mode}:${user?.id || ""}:${projectId ?? ""}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const [draft, setDraft] = useState<ProjectDraft>(initialDraft);
  const draftRef = useRef(draft);
  const projectRef = useRef<ProjectRow | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [files, setFiles] = useState<StoredFile[]>([]);
  useEffect(()=>()=>{for(const file of files)if(file.url.startsWith('blob:'))URL.revokeObjectURL(file.url);},[files]);
  const [sample, setSample] = useState(isDemo);
  const [buyers, setBuyers] = useState<Buyer[]>([
    { name: "Camille R.", initials: "CR", source: "Web", status: 0 },
    { name: "Alex M.", initials: "AM", source: "Web", status: 1 },
    { name: "Lin W.", initials: "LW", source: "Web", status: 2 },
  ]);
  const [loading, setLoading] = useState(!isDemo);
  const [saveState, setSaveState] = useState<SaveState>(
    isDemo ? "saved" : "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const active = useRef(true);
  const sequence = useRef(0);
  const savedSequence = useRef(0);
  const queue = useRef(new SerialQueue());
  const scope = useCallback(
    (): RequestScope => ({
      generation: generation.current,
      identity: identityRef.current,
    }),
    [],
  );
  const isCurrent = useCallback(
    (ticket: RequestScope) =>
      active.current &&
      ticket.generation === generation.current &&
      ticket.identity === identityRef.current,
    [],
  );
  const assertCurrent = useCallback(
    (ticket: RequestScope) => {
      if (!isCurrent(ticket)) throw new Error("SESSION_UNAVAILABLE");
    },
    [isCurrent],
  );

  const acceptRow = useCallback((record: ProjectRow) => {
    projectRef.current = record;
    if (active.current) setProject(record);
  }, []);
  const fail = useCallback((cause: unknown) => {
    const code = errorCode(cause);
    errorRef.current = code;
    if (active.current) {
      setError(code);
      setSaveState("error");
    }
  }, []);
  const clearError = useCallback(() => {
    errorRef.current = null;
    setError(null);
  }, []);
  const reloadProject = useCallback(async () => {
    if (isDemo || !user || projectId === null) return;
    generation.current += 1;
    const ticket = scope();
    queue.current = new SerialQueue();
    busyRef.current = false;
    setBusy(false);
    setLoading(true);
    setSaveState("loading");
    clearError();
    try {
      const fetched = projectId ? await fetchProject(projectId) : await ensureProject();
      // Older rows and partially migrated API responses can omit JSON fields.
      // Normalize optional collections before rendering so a single null value
      // cannot crash the entire project workspace.
      const record: ProjectRow = {
        ...fetched,
        details: fetched.details && typeof fetched.details === "object" ? fetched.details : {},
        services: Array.isArray(fetched.services) ? fetched.services : [],
        visits: Array.isArray(fetched.visits) ? fetched.visits : [],
      };
      assertCurrent(ticket);
      if (record.owner_id !== user.id) throw new Error("SESSION_UNAVAILABLE");
      const media = await listFiles(record.id);
      if (!isCurrent(ticket)) return;
      const next: ProjectDraft = {
        plan: record.plan,
        form: { ...initialDetails(), ...record.details },
        services: record.services,
        completed: record.completed,
        visits: record.visits,
      };
      draftRef.current = next;
      sequence.current = 0;
      savedSequence.current = 0;
      setDraft(next);
      acceptRow(record);
      setFiles(media);
      setSample(false);
      setSaveState("saved");
    } catch (cause) {
      if (isCurrent(ticket)) fail(cause);
    } finally {
      if (isCurrent(ticket)) setLoading(false);
    }
  }, [
    isDemo,
    user?.id,
    projectId,
    acceptRow,
    clearError,
    fail,
    scope,
    isCurrent,
    assertCurrent,
  ]);
  useEffect(() => {
    active.current = true;
    generation.current += 1;
    queue.current = new SerialQueue();
    busyRef.current = false;
    setBusy(false);
    projectRef.current = null;
    setProject(null);
    setFiles([]);
    const blank = initialDraft();
    draftRef.current = blank;
    setDraft(blank);
    sequence.current = 0;
    savedSequence.current = 0;
    setSample(isDemo);
    clearError();
    setLoading(!isDemo && !!user && projectId !== null);
    setSaveState(!isDemo && user && projectId !== null ? "loading" : "saved");
    void reloadProject();
    return () => {
      active.current = false;
      generation.current += 1;
    };
  }, [reloadProject]);

  function update<K extends keyof ProjectDraft>(
    key: K,
    action: SetStateAction<ProjectDraft[K]>,
  ) {
    if (!isDemo && (loading || !projectRef.current)) return;
    const old = draftRef.current[key];
    const value =
      typeof action === "function"
        ? (action as (previous: ProjectDraft[K]) => ProjectDraft[K])(old)
        : action;
    draftRef.current = { ...draftRef.current, [key]: value };
    sequence.current += 1;
    setDraft(draftRef.current);
    if (!isDemo && !errorRef.current) setSaveState("dirty");
  }

  const persist = useCallback(
    async (ticket: RequestScope) => {
      assertCurrent(ticket);
      if (isDemo) return;
      if (!projectRef.current) throw new Error("SESSION_UNAVAILABLE");
      if (sequence.current === savedSequence.current) return;
      if (errorRef.current === "CONFLICT") throw new Error("REVISION_CONFLICT");
      const savingSequence = sequence.current;
      const snapshot = draftRef.current;
      const current = projectRef.current;
      setSaveState("saving");
      const result = await saveProject(current, snapshot);
      assertCurrent(ticket);
      if (result.id !== current.id || result.owner_id !== current.owner_id)
        throw new Error("SESSION_UNAVAILABLE");
      acceptRow(result);
      savedSequence.current = savingSequence;
      clearError();
      setSaveState(sequence.current === savingSequence ? "saved" : "dirty");
    },
    [isDemo, acceptRow, clearError, assertCurrent],
  );
  const saveNow = useCallback(async () => {
    const ticket = scope();
    try {
      await queue.current.run(async () => {
        do {
          await persist(ticket);
        } while (!isDemo && sequence.current !== savedSequence.current);
      });
      // An unrelated file/download error is retained, but does not make an
      // already-persisted draft unsaved or trap the user in a signed-in session.
      return isCurrent(ticket);
    } catch (cause) {
      if (isCurrent(ticket)) fail(cause);
      return false;
    }
  }, [persist, fail, scope, isCurrent, isDemo]);
  useEffect(()=>{
    if(isDemo || !projectId)return;
    let leaving=false;
    const guard=(event:HashChangeEvent)=>{
      const next=new URL(event.newURL).hash;
      if(next.startsWith(`#projects/${projectId}`))return;
      if(sequence.current===savedSequence.current&&!busyRef.current)return;
      event.stopImmediatePropagation();history.replaceState(null,'',event.oldURL);
      if(leaving)return;leaving=true;
      void saveNow().then(saved=>{leaving=false;if(saved)location.hash=next;});
    };
    addEventListener('hashchange',guard,true);
    return()=>removeEventListener('hashchange',guard,true);
  },[isDemo,projectId,saveNow]);
  useEffect(() => {
    if (
      isDemo ||
      loading ||
      error ||
      sequence.current === savedSequence.current
    )
      return;
    const timer = setTimeout(() => {
      void saveNow();
    }, 900);
    return () => clearTimeout(timer);
  }, [draft, loading, error, isDemo, saveNow]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDemo && (sequence.current !== savedSequence.current || busy)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    addEventListener("beforeunload", beforeUnload);
    return () => removeEventListener("beforeunload", beforeUnload);
  }, [isDemo, busy]);
  useEffect(() => {
    if (isDemo) return;
    const timer = setInterval(
      () => {
        const ticket = scope();
        if (projectRef.current)
          void queue.current
            .run(async () => {
              assertCurrent(ticket);
              const id = projectRef.current!.id;
              const media = await listFiles(id);
              if (isCurrent(ticket) && projectRef.current?.id === id)
                setFiles(media);
            })
            .catch((cause) => {
              if (isCurrent(ticket)) fail(cause);
            });
      },
      45 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [isDemo, fail, scope, assertCurrent, isCurrent]);

  async function operation(
    task: (ticket: RequestScope, current: ProjectRow) => Promise<void>,
  ): Promise<boolean> {
    if (isDemo || loading || !projectRef.current || busyRef.current)
      return false;
    const ticket = scope();
    busyRef.current = true;
    setBusy(true);
    try {
      await queue.current.run(async () => {
        assertCurrent(ticket);
        if (errorRef.current === "CONFLICT")
          throw new Error("REVISION_CONFLICT");
        await persist(ticket);
        assertCurrent(ticket);
        await task(ticket, projectRef.current!);
        assertCurrent(ticket);
      });
      if (isCurrent(ticket)) {
        clearError();
        setSaveState(
          sequence.current === savedSequence.current ? "saved" : "dirty",
        );
      }
      return true;
    } catch (cause) {
      if (isCurrent(ticket)) fail(cause);
      return false;
    } finally {
      if (isCurrent(ticket)) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }
  async function refreshFiles(ticket: RequestScope, baseline: ProjectRow) {
    assertCurrent(ticket);
    const [record, media] = await Promise.all([
      fetchProject(baseline.id),
      listFiles(baseline.id),
    ]);
    assertCurrent(ticket);
    if (record.owner_id !== baseline.owner_id || record.id !== baseline.id)
      throw new Error("SESSION_UNAVAILABLE");
    if (!sameContent(record, baseline)) throw new Error("REVISION_CONFLICT");
    acceptRow(record);
    setFiles(media);
  }
  async function addFiles(incoming: File[], kind: "photo" | "document") {
    if (incoming.length === 0) return false;
    if (
      files.filter((file) => file.kind === kind).length + incoming.length >
      (kind === "photo" ? 8 : 10)
    ) {
      fail(new Error("FILE_LIMIT"));
      return false;
    }
    return operation(async (ticket, current) => {
      try {
        for (const file of incoming) {
          assertCurrent(ticket);
          await uploadFile(current, file, kind);
        }
      } finally {
        if (isCurrent(ticket)) await refreshFiles(ticket, current);
      }
    });
  }
  async function deleteFile(file: StoredFile) {
    return operation(async (ticket, current) => {
      if (file.project_id !== current.id || file.owner_id !== current.owner_id)
        throw new Error("SESSION_UNAVAILABLE");
      try {
        await removeFile(file);
      } finally {
        if (isCurrent(ticket)) await refreshFiles(ticket, current);
      }
    });
  }
  async function downloadDocument(file: StoredFile) {
    if (isDemo) return false;
    const ticket = scope();
    if (
      file.project_id !== projectRef.current?.id ||
      file.owner_id !== projectRef.current.owner_id
    )
      return false;
    try {
      await downloadFile(file, () => isCurrent(ticket));
      return isCurrent(ticket);
    } catch (cause) {
      if (isCurrent(ticket)) fail(cause);
      return false;
    }
  }
  async function completeProject() {
    update("completed", true);
    return saveNow();
  }
  async function submitForReview() {
    return operation(async (ticket, current) => {
      const result = await submitProject(current);
      assertCurrent(ticket);
      acceptRow(result);
    });
  }
  return (
    <ProjectContext.Provider
      value={{
        ...draft,
        setPlan: (value) => update("plan", value),
        setForm: (value) => update("form", value),
        setServices: (value) => update("services", value),
        setCompleted: (value) => update("completed", value),
        setVisits: (value) => update("visits", value),
        sample,
        setSample,
        buyers,
        setBuyers,
        photos: files.filter((file) => file.kind === "photo"),
        docs: files.filter((file) => file.kind === "document"),
        isDemo,
        loading,
        saveState,
        error,
        project,
        busy,
        saveNow,
        reloadProject,
        completeProject,
        submitForReview,
        addFiles,
        deleteFile,
        downloadDocument,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}
export function useProject() {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("ProjectProvider is required");
  return value;
}
