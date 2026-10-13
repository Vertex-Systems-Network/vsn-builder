import fs from "fs";
import { ApiVersion } from "@shopify/shopify-app-react-router/server";
import { shopifyApiProject, ApiType } from "@shopify/api-codegen-preset";
function getConfig() {
  const config = {
    projects: {
      default: shopifyApiProject({
        apiType: ApiType.Admin,
        apiVersion: ApiVersion.July26,
        documents: [
          "./app/**/*.{js,ts,jsx,tsx}",
          "./app/.server/**/*.{js,ts,jsx,tsx}",
        ],
        outputDir: "./app/types",
      }),
    },
  };
  let extensions = [];
  try {
    extensions = fs.readdirSync("./extensions");
  } catch {
    // ignore if no extensions
  }
  for (const entry of extensions) {
    // Extension directory names enter GraphQL Tools glob patterns. Never pass
    // arbitrary filesystem names into a vulnerable transitive brace parser.
    // Reject glob metacharacters, long names, symlinks and non-directories.
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(entry)) {
      continue;
    }
    const extensionPath = `./extensions/${entry}`;
    try {
      if (!fs.lstatSync(extensionPath).isDirectory()) continue;
    } catch {
      continue;
    }
    const schema = `${extensionPath}/schema.graphql`;
    if (!fs.existsSync(schema)) {
      continue;
    }
    config.projects[entry] = {
      schema,
      documents: [`${extensionPath}/**/*.graphql`],
    };
  }
  return config;
}
const config = getConfig();
export default config;
