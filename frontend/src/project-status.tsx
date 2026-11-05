import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Cloud, AlertCircle, LoaderCircle, Send, X } from 'lucide-react';
import { useProject } from './project';
import type { Language } from './seller-copy';
import './project-status.css';

export function ProjectStatus({ lang, review = false }: { lang: Language; review?: boolean }) {
  const p = useProject();
  const [manualSaving, setManualSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const saving = useRef(false);
  const request = useRef(0);
  useEffect(() => {
    setSavedNotice(false);
    setManualSaving(false);
    saving.current = false;
    return () => { request.current += 1; };
  }, [p.project?.id]);
  useEffect(() => {
    if (!savedNotice) return;
    const timer = window.setTimeout(() => setSavedNotice(false), 5000);
    return () => window.clearTimeout(timer);
  }, [savedNotice]);
  async function save() {
    if (saving.current) return;
    const ticket = request.current;
    saving.current = true;
    setManualSaving(true);
    setSavedNotice(false);
    try {
      const success = await p.saveNow();
      if (ticket === request.current) setSavedNotice(success);
    } finally {
      if (ticket === request.current) {
        saving.current = false;
        setManualSaving(false);
      }
    }
  }
  const t = (fr: string, en: string, zh: string) => ({ fr, en, zh })[lang];
  if (p.isDemo) return null;
  const errors: Record<string, string> = {
    CONFLICT: t('Ce dossier a été modifié ailleurs. Rechargez la version du serveur avant de continuer.', 'This project changed elsewhere. Load the server version before continuing.', '项目已在其他页面被修改。请载入云端版本后继续，避免覆盖他人的更改。'),
    ACCESS: t('Votre session ou vos permissions ont changé. Reconnectez-vous.', 'Your session or permissions changed. Please sign in again.', '登录状态或权限已变化，请重新登录。'),
    VALIDATION: t('Vérifiez les coordonnées, le code postal et les champs obligatoires.', 'Check contact details, postal code and required fields.', '请检查联系方式、邮编和必填资料。'),
    SLOT_TAKEN: t('Ce créneau figure déjà dans votre calendrier. Choisissez-en un autre.', 'That time is already on this calendar. Choose another slot.', '这个时间已在日历中安排，请选择其他时段。'),
    PHOTO_REQUIRED: t('Ajoutez au moins une photo avant de demander une vérification.', 'Add at least one photo before submitting for review.', '提交审核前，请先上传至少一张房屋照片。'),
    FILE_LIMIT: t('Vérifiez le type, la taille et le nombre de fichiers (10 Mo maximum chacun).', 'Check file type, count and size (10 MB maximum each).', '请检查文件类型、数量和大小（每个最多 10 MB）。'),
    CONFIG: t('Le serveur n’est pas encore connecté.', 'The backend is not connected yet.', '后端尚未连接。'),
    NETWORK: t('L’opération a échoué. Vérifiez votre connexion et réessayez. Vos modifications restent sur cette page.', 'The operation failed. Check your connection and retry. Your edits remain on this page.', '操作未成功。请检查网络后重试，当前修改仍保留在此页面。'),
  };
  const status = p.project?.status ?? 'draft';
  const reviewLabels = {
    draft: t('Brouillon privé', 'Private draft', '私有草稿'),
    submitted: t('En cours de vérification', 'Submitted for review', '已提交，待审核'),
    approved: t('Dossier vérifié', 'Review approved', '资料审核通过'),
    changes_requested: t('Modifications demandées', 'Changes requested', '请按反馈修改'),
  };
  async function reload() {
    if (p.saveState !== 'saved' && !window.confirm(t('Recharger abandonnera vos modifications non enregistrées. Continuer ?', 'Reloading discards unsaved edits. Continue?', '重新载入会放弃尚未保存的修改，是否继续？'))) return;
    await p.reloadProject();
  }
  return <section className={`project-sync ${p.error ? 'has-error' : ''}`} aria-label={t('Enregistrement du dossier', 'Project saving', '项目保存状态')}>
    <div className="sync-line" role="status">
      {p.loading || manualSaving || p.saveState === 'saving' || p.busy ? <LoaderCircle className="sync-spin" /> : p.error ? <AlertCircle /> : p.saveState === 'saved' ? <CheckCircle2 /> : <Cloud />}
      <span>{p.error ? errors[p.error] ?? errors.NETWORK : p.loading ? t('Chargement…', 'Loading…', '正在载入…') : manualSaving || p.busy || p.saveState === 'saving' ? t('Enregistrement en cours…', 'Saving…', '正在保存…') : p.saveState === 'dirty' ? t('Modifications à enregistrer', 'Unsaved changes', '有修改等待保存') : t('À jour', 'Up to date', '已更新')}</span>
      {!p.loading && !p.busy && <button type="button" className="text-button" disabled={manualSaving || p.saveState === 'saving'} onClick={() => { if (p.error === 'CONFLICT' || !p.project) void reload(); else void save(); }}>
        {p.error === 'CONFLICT' || !p.project ? t('Recharger', 'Reload', '载入云端版本') : t('Enregistrer', 'Save now', '立即保存')}
      </button>}
    </div>
    {savedNotice && createPortal(<div className="project-save-toast" role="status">
      <CheckCircle2 aria-hidden="true" />
      <span>{t('Modifications enregistrées', 'Changes saved', '修改已保存')}</span>
      <button type="button" aria-label={t('Fermer', 'Dismiss', '关闭')} onClick={() => setSavedNotice(false)}><X aria-hidden="true" /></button>
    </div>, document.body)}
    {review && p.project && <div className="review-state">
      <div><strong>{reviewLabels[status]}</strong><p>{t('La vérification ne publie pas votre dossier. Modifier les informations ou les fichiers remet le dossier en brouillon.', 'Review does not publish your project. Editing information or files returns it to draft.', '审核不会公开您的私人资料。修改资料或文件后，需要重新提交审核。')}</p>{p.project.review_note && <p className="review-note">{p.project.review_note}</p>}</div>
      <button type="button" disabled={p.busy || p.loading || !!p.error || !p.completed || p.photos.length === 0 || status === 'submitted' || status === 'approved'} onClick={() => void p.submitForReview()}><Send />{t('Soumettre pour vérification', 'Submit for review', '提交审核')}</button>
      {(!p.completed || p.photos.length === 0) && <small>{t('Complétez le parcours et ajoutez au moins une photo.', 'Complete your seller details and add at least one photo.', '请完成卖房资料流程，并上传至少一张房屋照片。')}</small>}
    </div>}
  </section>;
}
