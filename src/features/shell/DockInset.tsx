import { createContext, useContext } from 'react';

/** Height of the floating dock, so every screen can leave room for it at the bottom. */
export const DockInsetContext = createContext(0);
export const useDockInset = () => useContext(DockInsetContext);

/** A focused workspace can give the dock's space back to its content. */
export const DockVisibilityContext = createContext<(hidden: boolean) => void>(() => {});
export const useSetDockHidden = () => useContext(DockVisibilityContext);
