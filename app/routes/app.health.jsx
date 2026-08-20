import { redirect } from "react-router";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return redirect("/app/pages?panel=control-center");
}

export default function HealthRedirect() { return null; }
