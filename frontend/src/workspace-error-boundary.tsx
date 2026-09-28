import { Component, type ErrorInfo, type ReactNode } from "react";
import type { Language } from "./seller-copy";

type Props = { lang: Language; children: ReactNode };
type State = { failed: boolean };

const copy = {
  fr: {
    title: "Impossible d’ouvrir ce projet.",
    detail: "Une erreur temporaire est survenue. Rechargez la page ou retournez à vos projets.",
    retry: "Recharger la page",
    back: "Tous les projets",
  },
  en: {
    title: "This project could not be opened.",
    detail: "A temporary error occurred. Reload the page or return to your projects.",
    retry: "Reload page",
    back: "All projects",
  },
  zh: {
    title: "项目暂时无法打开。",
    detail: "刚才发生了临时错误。可以重新加载，或返回项目列表再试一次。",
    retry: "重新加载",
    back: "返回项目列表",
  },
} satisfies Record<Language, Record<string, string>>;

export class WorkspaceErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep details in the browser console for support without showing project data.
    console.error("Workspace failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = copy[this.props.lang];
    return (
      <section className="workspace-error" role="alert">
        <h1>{t.title}</h1>
        <p>{t.detail}</p>
        <div>
          <button type="button" onClick={() => window.location.reload()}>{t.retry}</button>
          <a className="secondary" href="#projects">{t.back}</a>
        </div>
      </section>
    );
  }
}
