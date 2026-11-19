import { localize } from "../constants.mjs";
import { toThemePath } from "../theme/design.mjs";
import { picker, worldRoot } from "../theme/store.mjs";

export function pickImage({ current } = {}) {
  if (!game.user.can("FILES_BROWSE")) {
    ui.notifications.warn(localize("Fields.askGM"));
    return Promise.resolve(undefined);
  }
  return new Promise(resolve => {
    const app = new (picker())({ type: "image", current: current ?? `${worldRoot()}/img`, callback: path => resolve(toThemePath(path, worldRoot())) });
    const close = app.close.bind(app);
    app.close = options => {
      resolve(undefined);
      return close(options);
    };
    app.render({ force: true });
  });
}
