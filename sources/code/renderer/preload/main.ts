import { contextBridge, ipcRenderer as ipc } from "electron/renderer";
import { clipboard } from "electron/common";
import { generateSafeKey, navigate } from "../modules/api";
import { wLog } from "../../common/global";
import { appInfo } from "../../common/modules/client";
import L10N from "../../common/modules/l10n";

if (window.location.protocol === "file:") {
  window.addEventListener("load", () => {
    const element = document.getElementById("logo");
    if(element && element.tagName === "IMG")
      (element as HTMLImageElement).src = appInfo.icons.app.toDataURL();
  });
  contextBridge.exposeInMainWorld(
    "webcord",
    {
      l10n: (new L10N()).web
    }
  );
} else {
  /**
   * WebCord API key used as the object name of the exposed content
   * by the Context Bridge.
   */
  const contextBridgeApiKey = generateSafeKey();

  /*
   * Expose API key back to the main process.
   */
  ipc.send("api-exposed", contextBridgeApiKey);

  /*
   * Hide orange popup about downloading the application.
   */
  window.addEventListener("load", () => window.localStorage.setItem("hideNag", "true"));

  /*
  * Workaround for clipboard content.
  */
  {
    let lock = true;
    document.addEventListener("paste", (event) => {
      const contentTypes = clipboard.availableFormats() as []|[string, string];
      if(contentTypes.length === 2 && contentTypes[0].startsWith("image/") &&
        contentTypes[1] === "text/html" && lock) {
        console.debug("[WebCord] Applying clipboard workaround to the image…");
        lock = false;
        // Electron will somehow sort the clipboard to parse it correctly.
        clipboard.write({
          image: clipboard.readImage(),
          html: clipboard.readHTML()
        });
        // Retry event, cancel other events.
        event.stopImmediatePropagation();
        ipc.send("paste-workaround", contextBridgeApiKey);
        return;
      }
      lock = true;
      return;
    }, true);
  }

  /**
   * The following is an attempt to fix a known state issue with drag and drop inside electron on linux.
   * When dragging images or links, the dragstart will fire as expected; 
   * but in cases where the drop occurs inside the window bounds on an element that is not a valid drop target
   * it appears that the dragend event does not fire causing a stuck state of constant dragging.
   * TODO: Remove this workaround when the issue is fixed in Electron.
   */
  if (process.platform === "linux") {
    console.debug("[WebCord] Applying drag/drop workaround for Linux…");
    document.addEventListener('dragstart', (e) => {
      if (e.target === null) return;
      if (!(e.target instanceof HTMLElement)) return;
      if (e.target.nodeName === "IMG" || e.target.nodeName === "A") {
        e.preventDefault();
      }
    });
  }

  /*
   * Handle WebSocket Server IPC communication
   */
  ipc.on("navigate", (_event, path:string) => {
    navigate(path);
  });
}

wLog("Everything has been preloaded successfully!");