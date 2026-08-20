export async function safeAdminGraphql(admin, query, variables = {}, label = "Admin GraphQL") {
  try {
    const response = await admin.graphql(query, { variables });
    const result = await response.json();
    if (result.errors?.length) {
      console.error(`VSN ${label} errors:`, result.errors);
      return null;
    }
    return result.data || null;
  } catch (error) {
    console.error(`VSN ${label} failed:`, error);
    return null;
  }
}
