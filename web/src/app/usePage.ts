import { useEffect, useState } from "react";

// Pages without a router library: the URL hash picks the page.
export const PAGES = ["#/", "#/plan", "#/rescue", "#/calendar", "#/sites", "#/kit"] as const;
export type Page = (typeof PAGES)[number];

const read = (): Page => {
  const h = window.location.hash as Page;
  return PAGES.includes(h) ? h : "#/";
};

export function usePage(): Page {
  const [page, setPage] = useState<Page>(read);
  useEffect(() => {
    const onChange = () => {
      setPage(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return page;
}