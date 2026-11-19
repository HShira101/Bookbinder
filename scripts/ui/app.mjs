const { ApplicationV2 } = foundry.applications.api;

export class HTMLApplication extends ApplicationV2 {
  static DEFAULT_OPTIONS = { classes: ["bookbinder-app"], window: { resizable: true } };

  async _renderHTML(context, options) {
    return this.html(context, options);
  }

  _replaceHTML(result, content) {
    content.innerHTML = result;
  }
}

export class ShellApplication extends HTMLApplication {
  _replaceHTML(result, content) {
    if (!content.firstElementChild) content.innerHTML = result;
  }
}
