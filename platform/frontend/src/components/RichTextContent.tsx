import type { ReactNode } from "react";
import { descriptionToHtml } from "@/lib/richText";

type RichTextContentProps = {
  value?: string | null;
  fallback?: ReactNode;
  className?: string;
};

export function RichTextContent({
  value,
  fallback = null,
  className = "",
}: RichTextContentProps) {
  const html = descriptionToHtml(value);
  if (!html) return <>{fallback}</>;

  return (
    <div
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
