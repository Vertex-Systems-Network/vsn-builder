export function buildEditorBindingContext({ product=null, collection=null, article=null, blog=null, search=null } = {}) {
  return { product, collection, article, blog, search, customer:{ name:'Preview Customer', email:'customer@example.com', loggedIn:false } };
}
