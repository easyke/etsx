/* eslint-disable */
export const wapf = <%= JSON.stringify(wapFramework) %>;
export const webf = <%= JSON.stringify(webFramework) %>;
export const headf = <%= JSON.stringify(headFramework) %>;
export const modules = {
  <%
  aysncModules.forEach(function (m) { %> "<%=m%>": () => import("<%= m %>"),
  <% }); %>
};
export const getDefault = (mod) => ((mod && mod.__esModule) ? mod['default'] : mod)
export const importModule = (name, isGetDefault) => (Promise.resolve()
  .then(() => modules[name] ? modules[name]() : Promise.reject(new Error('不存在该框架')))
  .then((mod) => isGetDefault === false ? mod : getDefault(mod)))