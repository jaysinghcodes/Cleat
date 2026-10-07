import { THEME_STORAGE_KEY } from "@coachloop/theme";

/** Sets data-theme before first paint so a saved Dark or Light choice does not flash. */
export const themeBootScript = `(function(){try{var preference=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var root=document.documentElement;if(preference==="dark"||preference==="light"){root.setAttribute("data-theme",preference);}else{root.removeAttribute("data-theme");}}catch(e){}})();`;
