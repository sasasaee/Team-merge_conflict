import { useEffect, useState } from "react";

// Two pages, no router library: "#/plan" opens the planner, anything else is home.
export type Page = "home" | "plan";

const read = (): Page => (window.location.hash === "#/plan" ? "plan" : "home");

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