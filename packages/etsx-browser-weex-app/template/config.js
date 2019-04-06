/* eslint-disable */
export const wapf = <%= JSON.stringify(wapFramework) %>;
export const webf = <%= JSON.stringify(webFramework) %>;
export const bootf = <%= JSON.stringify(bootFramework) %>;
export const modules = {
  <%
  aysncModules.forEach(function (m) { %> "<%=m%>": () => import("<%= m %>"),
  <% }); %>
};
export const components = {
  <%
getComponents.forEach(function ([key, str]) { %> <%=JSON.stringify(key) %>: <%= str %>,
  <% }); %>
};
export const createElements = {
  <%
createElements.forEach(function ([key, str]) { %> <%=JSON.stringify(key) %>: <%= str %>,
  <% }); %>
};
export const renderToDoms = {
  <%
renderToDoms.forEach(function ([key, str]) { %> <%=JSON.stringify(key)%>: <%= str %>,
  <% }); %>
};
export const getDefault = (mod) => ((mod && mod.__esModule) ? mod['default'] : mod)
export const importModule = (name, isGetDefault) => (Promise.resolve()
  .then(() => modules[name] ? modules[name]() : Promise.reject(new Error('不存在该框架')))
  .then((mod) => isGetDefault === false ? mod : getDefault(mod)))