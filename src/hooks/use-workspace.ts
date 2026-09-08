import { useEffect, useState } from "react";
import {
  DEFAULT_WORKSPACE,
  WORKSPACE_CHANGED_EVENT,
  getWorkspace,
  saveWorkspace,
  type CompanyWorkspace,
} from "@/lib/plants";

/** Reactive access to the company workspace (company name + plants). */
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<CompanyWorkspace>(DEFAULT_WORKSPACE);

  useEffect(() => {
    setWorkspace(getWorkspace());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<CompanyWorkspace>).detail;
      if (detail) setWorkspace(detail);
    };
    window.addEventListener(WORKSPACE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(WORKSPACE_CHANGED_EVENT, onChange);
  }, []);

  return {
    workspace,
    plants: workspace.plants,
    companyName: workspace.companyName,
    update: (next: CompanyWorkspace) => {
      saveWorkspace(next);
      setWorkspace(next);
    },
  };
}
