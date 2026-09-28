import { supabase } from "./supabase";
import type { Details, Plan, Visit } from "../project";

export const apiUrl = import.meta.env.VITE_PROJECT_API_URL?.replace(/\/$/,'');
export async function apiResult(path:string,init:RequestInit={}){try{return {data:await (await projectRequest(path,init)).json(),error:null};}catch(error){return {data:null,error};}}
export async function projectRequest(path:string,init:RequestInit={}) {
  const {data:{session}}=await client().auth.getSession();
  if(!session)throw new Error('401');
  const response=await fetch(`${apiUrl}${path}`,{...init,headers:{'Content-Type':'application/json',...init.headers,Authorization:`Bearer ${session.access_token}`},signal:AbortSignal.timeout(30000)});
  if(!response.ok){const error=await response.json().catch(()=>({error:'NETWORK'}));throw new Error(error.error || String(response.status));}
  return response;
}
export async function listProjects():Promise<ProjectRow[]> {
  if(apiUrl)return (await projectRequest('/projects')).json();
  const {data:{user}}=await client().auth.getUser();if(!user)throw new Error('401');
  const {data,error}=await client().from('projects').select('*').eq('owner_id',user.id).order('updated_at',{ascending:false}).limit(100);
  if(error)throw error;return data as ProjectRow[];
}
export async function createProject(id:string,address:string,city:string,plan:Plan):Promise<ProjectRow>{
  if(apiUrl)return (await projectRequest('/projects',{method:'POST',body:JSON.stringify({id,address,city,plan})})).json();
  const {data,error}=await client().rpc('create_project',{p_id:id,p_address:address,p_city:city,p_plan:plan});if(error)throw error;return row(data);
}

export async function setProjectCancelled(project:ProjectRow,cancelled:boolean):Promise<ProjectRow>{
  const {data,error}=await client().rpc('set_project_cancelled',{p_id:project.id,p_revision:project.revision,p_cancelled:cancelled});
  if(error)throw error;return row(data);
}

export type ReviewStatus =
  "draft" | "submitted" | "approved" | "changes_requested";
export type ProjectDraft = {
  plan: Plan;
  form: Details;
  services: string[];
  completed: boolean;
  visits: Visit[];
};
export type ProjectRow = {
  id: string;
  owner_id: string;
  plan: Plan;
  details: Partial<Details>;
  services: string[];
  completed: boolean;
  visits: Visit[];
  status: ReviewStatus;
  review_note: string | null;
  revision: number;
  updated_at: string;
  cancelled_at?: string | null;
};
export type FileRow = {
  id: string;
  project_id: string;
  owner_id: string;
  kind: "photo" | "document";
  name: string;
  size: number;
  mime_type: string;
  storage_path: string;
};
export type StoredFile = FileRow & { url: string };
export const FILE_BUCKET = "project-files";
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function client() {
  if (!supabase) throw new Error("BACKEND_NOT_CONFIGURED");
  return supabase;
}
export function errorCode(error: unknown): string {
  const value = error as { message?: string; code?: string };
  const text = `${value?.code ?? ""} ${value?.message ?? ""}`;
  if (/VISIT_SLOT_TAKEN/i.test(text)) return "SLOT_TAKEN";
  if (/revision|conflict|40001/i.test(text)) return "CONFLICT";
  if (/PHOTO_REQUIRED|photo.*required|photo.*least/i.test(text))
    return "PHOTO_REQUIRED";
  if (/VALIDATION|incomplete|invalid.*details|required|22023|23514/i.test(text))
    return "VALIDATION";
  if (/NOT_CONFIGURED/.test(text)) return "CONFIG";
  if (/JWT|session|401|42501|permission|not authenticated/i.test(text))
    return "ACCESS";
  if (/LIMIT|limit|10 MB|too many|size/i.test(text)) return "FILE_LIMIT";
  return "NETWORK";
}
function row(data: unknown): ProjectRow {
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result !== "object" || !("id" in result))
    throw new Error("INVALID_RESPONSE");
  return result as ProjectRow;
}
export async function ensureProject(): Promise<ProjectRow> {
  const { data, error } = await client().rpc("ensure_project");
  if (error) throw error;
  return row(data);
}
export async function fetchProject(id: string): Promise<ProjectRow> {
  if(apiUrl)return (await projectRequest(`/projects/${id}`)).json();
  const { data, error } = await client()
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return row(data);
}
export async function saveProject(
  current: ProjectRow,
  draft: ProjectDraft,
): Promise<ProjectRow> {
  if(apiUrl)return (await projectRequest(`/projects/${current.id}`,{method:'PUT',body:JSON.stringify({revision:current.revision,...draft})})).json();
  const { data, error } = await client().rpc("save_project", {
    p_project_id: current.id,
    p_expected_revision: current.revision,
    p_plan: draft.plan,
    p_details: draft.form,
    p_services: draft.services,
    p_completed: draft.completed,
    p_visits: draft.visits,
  });
  if (error) throw error;
  return row(data);
}
export async function submitProject(current: ProjectRow): Promise<ProjectRow> {
  if(apiUrl)return (await projectRequest(`/projects/${current.id}/submit`,{method:'POST',body:JSON.stringify({revision:current.revision})})).json();
  const { data, error } = await client().rpc("submit_project", {
    p_project_id: current.id,
    p_expected_revision: current.revision,
  });
  if (error) throw error;
  return row(data);
}
export async function listFiles(projectId: string): Promise<StoredFile[]> {
  if(apiUrl){const files:FileRow[]=await (await projectRequest(`/projects/${projectId}/files`)).json();return Promise.all(files.map(async file=>({...file,url:file.kind==='photo'?URL.createObjectURL(await (await projectRequest(`/projects/${projectId}/files/${file.id}/content`)).blob()):''})));}
  const { data, error } = await client()
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw error;
  return Promise.all(
    ((data || []) as FileRow[]).map(async (file) => {
      if (file.kind === "document") return { ...file, url: "" };
      const { data: link, error: linkError } = await client()
        .storage.from(FILE_BUCKET)
        .createSignedUrl(file.storage_path, 3600);
      if (linkError) throw linkError;
      return { ...file, url: link.signedUrl };
    }),
  );
}
export async function uploadFile(
  project: ProjectRow,
  file: File,
  kind: FileRow["kind"],
): Promise<void> {
  const extension = extensions[file.type];
  if (
    !extension ||
    (kind === "photo" && extension === "pdf") ||
    file.size === 0 ||
    file.size > 10 * 1024 * 1024 ||
    file.name.length > 255
  )
    throw new Error("FILE_LIMIT");
  const id = crypto.randomUUID();
  if(apiUrl){const buffer=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<buffer.length;i+=8192)binary+=String.fromCharCode(...buffer.subarray(i,i+8192));await projectRequest(`/projects/${project.id}/files`,{method:'POST',body:JSON.stringify({id,kind,name:file.name,mime_type:file.type,data:btoa(binary)})});return;}
  const storage_path = `${project.owner_id}/${project.id}/${id}.${extension}`;
  const { error } = await client()
    .storage.from(FILE_BUCKET)
    .upload(storage_path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { error: metadataError } = await client().from("project_files").insert({
    id,
    project_id: project.id,
    owner_id: project.owner_id,
    kind,
    name: file.name,
    size: file.size,
    mime_type: file.type,
    storage_path,
  });
  if (metadataError) {
    // Best-effort cleanup if metadata validation rejects an already uploaded object.
    await client().storage.from(FILE_BUCKET).remove([storage_path]);
    throw metadataError;
  }
}
export async function removeFile(file: FileRow): Promise<void> {
  if(apiUrl){await projectRequest(`/projects/${file.project_id}/files/${file.id}`,{method:'DELETE'});return;}
  const { error } = await client()
    .storage.from(FILE_BUCKET)
    .remove([file.storage_path]);
  if (error) throw error;
  const { error: metadataError } = await client()
    .from("project_files")
    .delete()
    .eq("id", file.id);
  if (metadataError) throw metadataError;
}
export async function downloadFile(
  file: FileRow,
  stillAuthorized: () => boolean = () => true,
): Promise<void> {
  const { data, error } = apiUrl ? {data:await (await projectRequest(`/projects/${file.project_id}/files/${file.id}/content`)).blob(),error:null} : await client()
    .storage.from(FILE_BUCKET)
    .download(file.storage_path);
  if (error) throw error;
  if (!stillAuthorized()) throw new Error("SESSION_UNAVAILABLE");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
