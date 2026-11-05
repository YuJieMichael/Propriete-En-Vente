let pending:Promise<unknown>|null=null;
export function ensureModelViewer(){
  return pending??=import('@google/model-viewer').catch(error=>{pending=null;throw error;});
}
