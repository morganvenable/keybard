import { createContext, useContext, type ReactNode } from "react";

/** The standalone shell supplies navigation; Keybard keeps its existing inline controls. */
export const PracticePresentation = createContext<{ standalone: boolean; title: string; chooseKeymap?: () => void; actions?: ReactNode }>({ standalone: false, title: "Practice" });
export const usePracticePresentation = () => useContext(PracticePresentation);
