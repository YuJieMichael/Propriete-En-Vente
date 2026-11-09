import {Facebook, Instagram} from "lucide-react";
import type {Language} from "./seller-copy";

const labels = {en: "Social media", fr: "Réseaux sociaux", zh: "社交媒体"};
const icons = {
  Facebook: () => <Facebook aria-hidden="true" />,
  Instagram: () => <Instagram aria-hidden="true" />,
  X: () => <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M18.9 1.2h3.7l-8 9.2L24 22.8h-7.4l-5.8-7.6-6.7 7.6H.4l8.7-10L0 1.2h7.6l5.3 7zm-1.3 19.4h2L6.5 3.3H4.3z" />
  </svg>,
};
const profiles: Partial<Record<keyof typeof icons, string>> = {
  Facebook: "https://www.facebook.com/profile.php?id=61595691174888",
  Instagram: "https://www.instagram.com/proprieteenvente/",
};

export function SocialLinks({lang, placement = "footer"}: {lang: Language; placement?: "header" | "footer"}) {
  return <nav className={`${placement}-social`} aria-label={labels[lang]}>
    {(Object.keys(profiles) as (keyof typeof icons)[]).map(name => {
      const Icon = icons[name];
      return <a key={name} href={profiles[name]} aria-label={name} target="_blank" rel="noopener noreferrer">
        <Icon />
      </a>;
    })}
  </nav>;
}
