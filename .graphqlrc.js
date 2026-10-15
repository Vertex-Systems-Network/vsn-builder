import fs from "node:fs";
const projects = {
  default: {
    schema: "https://shopify.dev/admin-graphql-direct-proxy/2026-07",
    documents: ["./app/**/*.{js,jsx,ts,tsx}"],
    extensions: { vsn: { operationTypegen: "scripts/t011-graphql-typegen.mjs" } },
  },
};
for (const name of fs.readdirSync("./extensions", { withFileTypes: true }).filter((item) => item.isDirectory()).map((item) => item.name)) {
  const schema = "./extensions/" + name + "/schema.graphql";
  if (fs.existsSync(schema)) projects[name] = {
    schema,
    documents: ["./extensions/" + name + "/**/*.graphql"],
  };
}
export default { projects };
