export type GlobalSearchResultKind =
  | "Gig"
  | "Staff"
  | "Shift"
  | "Gig file"
  | "Staff document";

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchResultKind;
  title: string;
  subtitle: string;
  detail?: string;
  href: string;
  badge?: string;
}
