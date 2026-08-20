import { registerVsnPlugin, vsnElement } from "../../../app/sdk/index.js";
import manifest from "./manifest.json" with { type: "json" };

export function registerPlugin() {
  return registerVsnPlugin({
    manifest,
    setup(api) {
      api.registerWidget({
        id: "notice-card",
        label: "Notice Card",
        category: "Plugin",
        defaults: { props: { title: "Important notice", body: "Add your message." }, styles: {} },
        controls: [
          { key: "title", type: "text", label: "Title" },
          { key: "body", type: "textarea", label: "Message" },
        ],
        renderers: {
          editor: ({ node }) => vsnElement("aside", { role: "note" }, [
            vsnElement("strong", {}, node.props?.title || "Notice"),
            vsnElement("p", {}, node.props?.body || ""),
          ]),
          storefront: ({ node }) => vsnElement("aside", { role: "note" }, [
            vsnElement("strong", {}, node.props?.title || "Notice"),
            vsnElement("p", {}, node.props?.body || ""),
          ]),
        },
        hooks: { mount({ element }) { element?.setAttribute("data-acme-notice", "mounted"); } },
      });
    },
  });
}
