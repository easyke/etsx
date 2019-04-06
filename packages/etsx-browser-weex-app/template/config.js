/* eslint-disable */
export const wapf = <%= JSON.stringify(wapFramework) %>;
export const webf = <%= JSON.stringify(webFramework) %>;
export const bootf = <%= JSON.stringify(bootFramework) %>;
export const modules = {
  <%
  aysncModules.forEach(function (m) { %> "<%=m%>": () => import("<%= m %>"),
  <% }); %>
};