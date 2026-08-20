export const VSN_SUPPORTED_NODE_RANGES = Object.freeze([
  { major: 22, minimumMinor: 18, label: "Node 22.18+ LTS" },
]);

export function parseNodeVersion(version = process.versions.node) {
  const [major = "0", minor = "0", patch = "0"] = String(version || "").split(".");
  return { major: Number(major), minor: Number(minor), patch: Number(patch), raw: String(version || "") };
}

export function getNodeRuntimeCompatibility(version = process.versions.node) {
  const parsed = parseNodeVersion(version);
  const match = VSN_SUPPORTED_NODE_RANGES.find((item) => item.major === parsed.major);
  const supported = Boolean(match && parsed.minor >= match.minimumMinor);
  return {
    ...parsed,
    supported,
    recommended: "Node 22.18+ LTS",
    supportedLabels: VSN_SUPPORTED_NODE_RANGES.map((item) => item.label),
  };
}

export function assertSupportedNodeRuntime({ version = process.versions.node, context = "VSN" } = {}) {
  const result = getNodeRuntimeCompatibility(version);
  if (result.supported) return result;
  throw new Error(
    `${context} does not support Node.js ${result.raw}. Use ${result.recommended}. ` +
    `This project intentionally pins the tested Node 22 LTS line; Node 25/current odd releases are rejected for Prisma/Shopify stability.`,
  );
}
